import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { AppAuditLog, AuditAction, AuditDetails, AuditLogFilter, RevertOperation } from '../models/app-audit-log.model';
import { AzureApiService } from './azure-api.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AppAuditService {
  private readonly STORAGE_KEY = 'azure_app_audit_logs';
  private auditLogsSubject = new BehaviorSubject<AppAuditLog[]>([]);
  public auditLogs$ = this.auditLogsSubject.asObservable();

  constructor(
    private azureApiService: AzureApiService,
    private authService: AuthService
  ) {
    this.loadAuditLogs();
  }

  /**
   * Log an audit entry
   */
  logAction(
    action: AuditAction,
    targetType: 'user' | 'storage_account' | 'lock',
    targetId: string,
    targetName: string,
    details: AuditDetails,
    reversible: boolean = false
  ): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    const auditLog: AppAuditLog = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: currentUser.localAccountId || currentUser.homeAccountId || 'unknown',
      userName: currentUser.name || currentUser.username || 'Unknown User',
      action,
      targetType,
      targetId,
      targetName,
      details,
      reversible,
      reverted: false
    };

    const currentLogs = this.auditLogsSubject.value;
    const updatedLogs = [auditLog, ...currentLogs];
    
    this.saveAuditLogs(updatedLogs);
    this.auditLogsSubject.next(updatedLogs);

  }

  /**
   * Get filtered audit logs
   */
  getAuditLogs(filter?: AuditLogFilter): Observable<AppAuditLog[]> {
    return this.auditLogs$.pipe(
      map(logs => {
        if (!filter) return logs;

        return logs.filter(log => {
          if (filter.startDate && log.timestamp < filter.startDate) return false;
          if (filter.endDate && log.timestamp > filter.endDate) return false;
          if (filter.userId && log.userId !== filter.userId) return false;
          if (filter.action && log.action !== filter.action) return false;
          if (filter.targetType && log.targetType !== filter.targetType) return false;
          if (filter.reversible !== undefined && log.reversible !== filter.reversible) return false;
          if (filter.reverted !== undefined && log.reverted !== filter.reverted) return false;
          
          return true;
        });
      })
    );
  }

  /**
   * Revert an operation
   */
  revertOperation(auditLogId: string): Observable<RevertOperation> {
    const currentLogs = this.auditLogsSubject.value;
    const auditLog = currentLogs.find(log => log.id === auditLogId);

    if (!auditLog) {
      return of({
        auditLogId,
        success: false,
        message: 'Audit log not found'
      });
    }

    if (!auditLog.reversible) {
      return of({
        auditLogId,
        success: false,
        message: 'This operation is not reversible'
      });
    }

    if (auditLog.reverted) {
      return of({
        auditLogId,
        success: false,
        message: 'This operation has already been reverted'
      });
    }

    return this.performRevert(auditLog).pipe(
      map(result => {
        if (result.success) {
          // Mark as reverted
          auditLog.reverted = true;
          auditLog.revertedAt = new Date();
          
          // Update storage
          this.saveAuditLogs(currentLogs);
          this.auditLogsSubject.next([...currentLogs]);

          // Log the revert action
          this.logAction(
            this.getRevertAction(auditLog.action),
            auditLog.targetType,
            auditLog.targetId,
            auditLog.targetName,
            {
              ...auditLog.details,
              additionalInfo: `Reverted operation ${auditLog.id}`
            },
            false
          );
        }
        
        return result;
      }),
      catchError(error => {
        console.error('Failed to revert operation:', error);
        return of({
          auditLogId,
          success: false,
          message: 'Failed to revert operation',
          error
        });
      })
    );
  }

  /**
   * Clear all audit logs
   */
  clearAuditLogs(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.auditLogsSubject.next([]);
  }

  /**
   * Export audit logs to JSON
   */
  exportAuditLogs(): Blob {
    const logs = this.auditLogsSubject.value;
    const jsonContent = JSON.stringify(logs, null, 2);
    return new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  }

  private performRevert(auditLog: AppAuditLog): Observable<RevertOperation> {
    switch (auditLog.action) {
      case 'permission_added':
        return this.revertPermissionAdded(auditLog);
      case 'permission_removed':
        return this.revertPermissionRemoved(auditLog);
      case 'lock_created':
        return this.revertLockCreated(auditLog);
      case 'lock_removed':
        return this.revertLockRemoved(auditLog);
      default:
        return of({
          auditLogId: auditLog.id,
          success: false,
          message: `Revert not implemented for action: ${auditLog.action}`
        });
    }
  }

  private revertPermissionAdded(auditLog: AppAuditLog): Observable<RevertOperation> {
    if (!auditLog.details.assignmentId) {
      return of({
        auditLogId: auditLog.id,
        success: false,
        message: 'Missing assignment ID for permission revert'
      });
    }

    return this.azureApiService.removeUserRole({
      assignmentId: auditLog.details.assignmentId
    }).pipe(
      map(result => ({
        auditLogId: auditLog.id,
        success: result.success,
        message: result.success ? 'Permission successfully reverted' : result.message || 'Failed to revert permission'
      }))
    );
  }

  private revertPermissionRemoved(auditLog: AppAuditLog): Observable<RevertOperation> {
    // Note: Re-adding permissions would require additional API calls and role assignment logic
    // This is a placeholder for the implementation
    return of({
      auditLogId: auditLog.id,
      success: false,
      message: 'Permission re-assignment revert not yet implemented'
    });
  }

  private revertLockCreated(auditLog: AppAuditLog): Observable<RevertOperation> {
    if (!auditLog.details.lockId) {
      return of({
        auditLogId: auditLog.id,
        success: false,
        message: 'Missing lock ID for lock revert'
      });
    }

    return this.azureApiService.deleteStorageAccountLock(auditLog.details.lockId).pipe(
      map(() => ({
        auditLogId: auditLog.id,
        success: true,
        message: 'Lock successfully reverted (removed)'
      })),
      catchError(error => of({
        auditLogId: auditLog.id,
        success: false,
        message: 'Failed to revert lock creation',
        error
      }))
    );
  }

  private revertLockRemoved(auditLog: AppAuditLog): Observable<RevertOperation> {
    if (!auditLog.details.lockLevel) {
      return of({
        auditLogId: auditLog.id,
        success: false,
        message: 'Missing lock details for lock recreation'
      });
    }

    return this.azureApiService.createStorageAccountLock(
      auditLog.targetId,
      `restored-${Date.now()}`,
      auditLog.details.lockLevel,
      auditLog.details.lockNotes || 'Lock restored from audit log'
    ).pipe(
      map(() => ({
        auditLogId: auditLog.id,
        success: true,
        message: 'Lock successfully reverted (recreated)'
      })),
      catchError(error => of({
        auditLogId: auditLog.id,
        success: false,
        message: 'Failed to revert lock removal',
        error
      }))
    );
  }

  private getRevertAction(originalAction: AuditAction): AuditAction {
    const revertMap: Record<AuditAction, AuditAction> = {
      'permission_added': 'permission_removed',
      'permission_removed': 'permission_added',
      'permission_modified': 'permission_modified',
      'bulk_permissions_removed': 'bulk_permissions_removed',
      'lock_added': 'lock_removed',
      'lock_created': 'lock_removed',
      'lock_removed': 'lock_added',
      'lock_modified': 'lock_modified'
    };
    
    return revertMap[originalAction] || originalAction;
  }

  private loadAuditLogs(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const logs: AppAuditLog[] = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        logs.forEach(log => {
          log.timestamp = new Date(log.timestamp);
          if (log.revertedAt) {
            log.revertedAt = new Date(log.revertedAt);
          }
        });
        this.auditLogsSubject.next(logs);
      }
    } catch (error) {
      console.error('Failed to load audit logs from localStorage:', error);
      this.auditLogsSubject.next([]);
    }
  }

  private saveAuditLogs(logs: AppAuditLog[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to save audit logs to localStorage:', error);
    }
  }

  private generateId(): string {
    return 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}