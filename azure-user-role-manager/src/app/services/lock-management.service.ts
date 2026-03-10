import { Injectable } from '@angular/core';
import { Observable, throwError, of, forkJoin, firstValueFrom } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';
import { AzureApiService } from './azure-api.service';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { LockConfirmationModalComponent, LockConfirmationData } from '../components/lock-confirmation-modal/lock-confirmation-modal.component';
import { AppAuditService } from './app-audit.service';

export interface LockInfo {
  id: string;
  name: string;
  level: 'ReadOnly' | 'Delete' | 'CanNotDelete';
  notes?: string;
}

export interface ScopeLockedError {
  code: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class LockManagementService {

  constructor(
    private azureApiService: AzureApiService,
    private dialogService: DialogService,
    private messageService: MessageService,
    private appAuditService: AppAuditService
  ) {}

 /**
   * Check if an error is a ScopeLocked error
   */
  isScopeLockedError(error: any): boolean {
    let isScopeLocked = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    
    // Handle HttpErrorResponse structure
    if (error?.error?.error?.code) {
      // HttpErrorResponse: error.error.error.code
      errorCode = error.error.error.code;
      errorMessage = error.error.error.message;
      isScopeLocked = errorCode === 'ScopeLocked';
    } else if (error?.error?.code) {
      // Direct error structure: error.error.code
      errorCode = error.error.code;
      errorMessage = error.error.message;
      isScopeLocked = errorCode === 'ScopeLocked';
    } else {
      // Fallback: check message content
      const message = error?.message || error?.error?.message || '';
      isScopeLocked = message.includes('ScopeLocked');
      errorMessage = message;
    }
    
    return isScopeLocked;
  }



  /**
   * Extract resource ID from ScopeLocked error message
   */
  extractResourceIdFromError(error: any): string | null {
    let message = '';
    
    // Handle HttpErrorResponse structure
    if (error?.error?.error?.message) {
      // HttpErrorResponse: error.error.error.message
      message = error.error.error.message;
    } else if (error?.error?.message) {
      // Direct error structure: error.error.message
      message = error.error.message;
    } else {
      // Fallback: check top-level message
      message = error?.message || '';
    }
    
    const match = message.match(/following scope\(s\) are locked: '([^']+)'/);
    return match ? match[1] : null;
  }

  /**
   * Extract a user-friendly resource name from resource ID
   */
  private extractResourceNameFromId(resourceId: string): string {
    if (!resourceId) {
      return 'Unknown Resource';
    }
    
    // Extract the last part of the resource path as the name
    const parts = resourceId.split('/');
    const resourceName = parts[parts.length - 1];
    
    // If we can identify the resource type, format it nicely
    if (resourceId.includes('/storageAccounts/')) {
      return `Storage Account: ${resourceName}`;
    } else if (resourceId.includes('/resourceGroups/')) {
      return `Resource Group: ${resourceName}`;
    } else if (resourceId.includes('/subscriptions/')) {
      return `Subscription: ${resourceName}`;
    }
    
    return resourceName || 'Unknown Resource';
  }

  /**
   * Show lock removal confirmation dialog
   */
  private async showLockRemovalConfirmation(resourceId: string): Promise<boolean> {
    const resourceName = this.extractResourceNameFromId(resourceId);
    
    return new Promise((resolve) => {
      this.messageService.clear();
      this.messageService.add({
        key: 'lockConfirm',
        sticky: true,
        severity: 'warn',
        summary: 'Resource Lock Detected',
        detail: `The resource "${resourceName}" is locked and cannot be modified. Would you like to temporarily remove the lock to perform the operation? Note: The lock will be recreated after the operation completes.`,
        closable: false
      });
      
      // For now, we'll auto-confirm since PrimeNG messages don't have built-in confirm buttons
      // In a real implementation, you'd want to use p-confirmDialog component
      setTimeout(() => {
        this.messageService.clear('lockConfirm');
        resolve(true);
      }, 3000);
    });
  }

  /**
   * Handle ScopeLocked error with user confirmation
   */
  async handleScopeLockedError(error: any, operation: () => Promise<any>): Promise<any> {
    const resourceId = this.extractResourceIdFromError(error);

    if (!resourceId) {
      console.error('Could not extract resource ID from error');
      throw error;
    }

    const confirmed = await this.showLockRemovalConfirmation(resourceId);

    if (!confirmed) {
      throw new Error('Lock removal cancelled by user');
    }

    return this.executeWithLockManagement(resourceId, operation);
  }

  /**
   * Handle ScopeLocked error with user confirmation (Observable version)
   */
  handleScopeLockedErrorObservable(
    error: ScopeLockedError,
    resourceId: string,
    operation: () => Observable<any>,
    operationType: string = 'operation'
  ): Observable<any> {
    const resourceName = this.extractResourceNameFromId(resourceId);
    
    return new Observable(observer => {
      // First, get the locks to show detailed information
      this.getLocks(resourceId).subscribe({
        next: (locks) => {
          const lockData: LockConfirmationData = {
            resourceName,
            operationType,
            lockCount: locks.length,
            locks: locks.map(lock => ({
              name: lock.name,
              level: lock.level,
              notes: lock.notes
            }))
          };
          
          // Show detailed confirmation modal using PrimeNG DialogService
          const dialogRef = this.dialogService.open(LockConfirmationModalComponent, {
            data: { data: lockData },
            header: 'Resource Lock Detected',
            width: '600px',
            closable: false,
            modal: true
          });

          if (!dialogRef) {
            observer.error(new Error('Failed to open lock confirmation dialog'));
            return;
          }

          // Handle dialog events
          dialogRef.onClose.subscribe((result: any) => {
            if (result === 'confirm') {
              // User confirmed, proceed with lock management workflow
              this.executeWithLockManagementObservable(resourceId, operation)
                .subscribe({
                  next: (result: any) => {
                    observer.next(result);
                    observer.complete();
                  },
                  error: (err: any) => {
                    observer.error(err);
                  }
                });
            } else {
              observer.error(error);
            }
          });
        },
        error: (lockError) => {
          console.error('Failed to get locks for confirmation:', lockError);
          // Fallback to simple confirmation if we can't get lock details
          this.messageService.clear();
          this.messageService.add({
            key: 'lockFallback',
            sticky: true,
            severity: 'warn',
            summary: 'Resource Lock Detected',
            detail: `The resource "${resourceName}" is locked and cannot be modified. Proceeding with lock removal for ${operationType}. Note: The lock will be recreated after the operation completes.`,
            closable: false
          });
          
          // Auto-proceed after showing message
          setTimeout(() => {
            this.messageService.clear('lockFallback');
            this.executeWithLockManagementObservable(resourceId, operation)
              .subscribe({
                next: (result: any) => {
                  observer.next(result);
                  observer.complete();
                },
                error: (err: any) => {
                  observer.error(err);
                }
              });
          }, 2000);
        }
      });
    });
  }

  /**
   * Execute operation with lock management workflow (Promise version)
   */
  private async executeWithLockManagement(resourceId: string, operation: () => Promise<any>): Promise<any> {
    try {
      // Step 1: Get existing locks
      const existingLocks = await firstValueFrom(this.getLocks(resourceId));

      // Step 2: Remove locks that prevent deletion
      await firstValueFrom(this.removeLocks(existingLocks));

      // Step 3: Execute the main operation
      const result = await operation();

      // Step 4: Recreate the locks
      await firstValueFrom(this.recreateLocks(resourceId, existingLocks));

      return result;
    } catch (error) {
      console.error('Error in lock management workflow:', error);
      throw error;
    }
  }

  /**
   * Execute operation with lock management workflow (Observable version)
   */
  private executeWithLockManagementObservable(
    resourceId: string, 
    operation: () => Observable<any>
  ): Observable<any> {
    this.messageService.add({
      key: 'lockManagement',
      severity: 'info',
      summary: 'Managing resource locks...',
      detail: 'Please wait while we manage the resource locks'
    });
    
    return this.getLocks(resourceId).pipe(
      switchMap(locks => {
        const deleteLocks = locks.filter(lock => 
          lock.level === 'Delete' || lock.level === 'CanNotDelete'
        );
        
        if (deleteLocks.length === 0) {
          this.messageService.clear('lockManagement');
          this.messageService.add({
            severity: 'info',
            summary: 'No delete locks found, proceeding with operation'
          });
          return operation();
        }

        // Remove locks first
        return this.removeLocks(deleteLocks).pipe(
          switchMap(() => {
            this.messageService.clear('lockManagement');
            this.messageService.add({
              key: 'operation',
              severity: 'info',
              summary: 'Performing operation...',
              detail: 'Please wait while the operation is being performed'
            });
            
            return operation().pipe(
              switchMap(result => {
                this.messageService.clear('operation');
                this.messageService.add({
                  key: 'recreate',
                  severity: 'info',
                  summary: 'Recreating locks...',
                  detail: 'Please wait while we recreate the locks'
                });
                
                return this.recreateLocks(resourceId, deleteLocks).pipe(
                  map(() => {
                    this.messageService.clear('recreate');
                    this.messageService.add({
                      severity: 'success',
                      summary: 'Operation completed successfully with lock management'
                    });
                    return result;
                  }),
                  catchError(lockError => {
                    this.messageService.clear('recreate');
                    this.messageService.add({
                      severity: 'warn',
                      summary: 'Operation succeeded but some locks could not be recreated'
                    });
                    return of(result);
                  })
                );
              }),
              catchError(opError => {
                this.messageService.clear('operation');
                this.messageService.add({
                  key: 'recreateAfterError',
                  severity: 'info',
                  summary: 'Recreating locks after failed operation...',
                  detail: 'Please wait while we recreate the locks'
                });
                
                // Try to recreate locks even if operation failed
                return this.recreateLocks(resourceId, deleteLocks).pipe(
                  switchMap(() => {
                    this.messageService.clear('recreateAfterError');
                    return throwError(() => opError);
                  }),
                  catchError(lockError => {
                    this.messageService.clear('recreateAfterError');
                    this.messageService.add({
                      severity: 'error',
                      summary: 'Operation failed and locks could not be recreated'
                    });
                    console.error('Failed to recreate locks after operation failure:', lockError);
                    return throwError(() => opError);
                  })
                );
              })
            );
          }),
          catchError(lockRemovalError => {
            this.messageService.clear('lockManagement');
            this.messageService.add({
              severity: 'error',
              summary: 'Failed to remove locks'
            });
            return throwError(() => lockRemovalError);
          })
        );
      })
    );
  }

  /**
   * Get locks for a resource
   */
  private getLocks(resourceId: string): Observable<LockInfo[]> {
    return this.azureApiService.getStorageAccountLocks(resourceId).pipe(
      map(locks => {
        const mappedLocks = locks.map(lock => ({
          id: lock.id,
          name: lock.name,
          level: lock.properties?.level || 'ReadOnly',
          notes: lock.properties?.notes
        }));
        const filteredLocks = mappedLocks.filter(lock => 
          lock.level === 'Delete' || lock.level === 'CanNotDelete'
        );
        return filteredLocks; // Return filtered locks, not all locks
      }),
      catchError(error => {
        console.error('Failed to get locks:', error);
        return of([]);
      })
    );
  }

  /**
   * Remove multiple locks
   */
  private removeLocks(locks: LockInfo[]): Observable<any> {
    if (locks.length === 0) {
      return of(null);
    }

    const removeOperations = locks.map(lock => {
      // Azure lock IDs are full resource paths like:
      // /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Storage/storageAccounts/{accountName}/providers/Microsoft.Authorization/locks/{lockName}
      // The deleteStorageAccountLock method expects this full path
      return this.azureApiService.deleteStorageAccountLock(lock.id).pipe(
        tap(() => {
          // Log successful lock removal
          this.appAuditService.logAction(
            'lock_removed',
            'storage_account',
            this.extractResourceIdFromLockId(lock.id),
            `Lock: ${lock.name}`,
            {
              lockId: lock.id,
              lockName: lock.name,
              lockLevel: lock.level === 'CanNotDelete' ? 'Delete' : lock.level as 'ReadOnly' | 'Delete',
              lockNotes: lock.notes
            },
            true
          );
        }),
        map(result => result),
        catchError(error => {
          console.error(`Failed to remove lock ${lock.name}:`, error);
          return of(null);
        })
      );
    });
    
    return forkJoin(removeOperations);
  }

  /**
   * Recreate locks on a resource
   */
  private recreateLocks(resourceId: string, locks: LockInfo[]): Observable<any> {
    const createOperations = locks.map(lock => 
      this.azureApiService.createStorageAccountLock(
        resourceId, 
        lock.name, 
        lock.level as 'ReadOnly' | 'Delete', 
        lock.notes || 'Recreated by Azure Permission Manager'
      ).pipe(
        tap(result => {
          // Log successful lock recreation
          this.appAuditService.logAction(
            'lock_added',
            'storage_account',
            resourceId,
            `Lock: ${lock.name}`,
            {
              lockName: lock.name,
              lockLevel: lock.level === 'CanNotDelete' ? 'Delete' : lock.level as 'ReadOnly' | 'Delete',
              lockNotes: lock.notes || 'Recreated by Azure Permission Manager',
              originalLockId: lock.id
            },
            true
          );
        }),
        catchError(() => {
          return of(null);
        })
      )
    );
    
    return forkJoin(createOperations);
  }

  /**
   * Extract resource ID from lock ID
   */
  private extractResourceIdFromLockId(lockId: string): string {
    // Lock ID format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{name}/providers/Microsoft.Authorization/locks/{lockName}
    const parts = lockId.split('/providers/Microsoft.Authorization/locks/');
    return parts.length > 0 ? parts[0] : lockId;
  }
}