import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AppAuditService } from '../../services/app-audit.service';
import { AppAuditLog, AuditLogFilter, AuditAction } from '../../models/app-audit-log.model';
import { AzureApiService } from '../../services/azure-api.service';
import { MessageService } from 'primeng/api';
import { User } from '../../models/user.model';

export interface EnrichedAuditLog extends AppAuditLog {
  targetUser?: {
    displayName: string;
    email: string;
  };
}

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    DialogModule,
    ToastModule,
    DatePickerModule,
    SelectModule,
    InputTextModule,
    CardModule,
    ProgressSpinnerModule
  ],
  providers: [MessageService],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.scss']
})

export class AuditLogsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  auditLogs: AppAuditLog[] = [];
  filteredLogs: EnrichedAuditLog[] = [];
  loading = false;
  private userCache = new Map<string, User>();
  
  // Filter properties
  filter: AuditLogFilter = {
    startDate: undefined,
    endDate: undefined,
    action: undefined,
    targetType: undefined,
    userId: undefined
  };
  
  // Available filter options
  actionOptions: { label: string; value: AuditAction }[] = [
    { label: 'Permission Added', value: 'permission_added' },
    { label: 'Permission Removed', value: 'permission_removed' },
    { label: 'Bulk Permissions Removed', value: 'bulk_permissions_removed' },
    { label: 'Lock Added', value: 'lock_added' },
    { label: 'Lock Removed', value: 'lock_removed' }
  ];
  
  resourceTypeOptions = [
    { label: 'Storage Account', value: 'storage_account' }
  ];
  
  constructor(
    private auditService: AppAuditService,
    private azureApiService: AzureApiService,
    private message: MessageService
  ) {}
  
  ngOnInit(): void {
    this.loadAuditLogs();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  loadAuditLogs(): void {
    this.loading = true;
    this.auditService.getAuditLogs()
      .pipe(
        map(logs => this.enrichLogsWithUserInfo(logs)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (enrichedLogs) => {
          enrichedLogs.subscribe({
            next: (logs) => {
              this.auditLogs = logs;
              this.applyFilters();
              this.loading = false;
            },
            error: (error) => {
              console.error('Error enriching audit logs:', error);
              this.message.add({ severity: 'error', summary: 'Error', detail: 'Failed to enrich audit logs' });
              this.loading = false;
            }
          });
        },
        error: (error) => {
          console.error('Error loading audit logs:', error);
          this.message.add({ severity: 'error', summary: 'Error', detail: 'Failed to load audit logs' });
          this.loading = false;
        }
      });
  }
  
  applyFilter(): void {
    this.loadAuditLogs();
  }
  
  clearFilter(): void {
    this.filter = {
      startDate: undefined,
      endDate: undefined,
      action: undefined,
      targetType: undefined,
      userId: undefined
    };
    this.loadAuditLogs();
  }
  
  private enrichLogsWithUserInfo(logs: AppAuditLog[]) {
    const userRequests = logs
      .filter(log => log.action === 'permission_added' && log.details?.principalId)
      .map(log => log.details!.principalId!)
      .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
      .map(principalId => this.getUserInfo(principalId));

    if (userRequests.length === 0) {
      return of(logs.map(log => ({ ...log } as EnrichedAuditLog)));
    }

    return forkJoin(userRequests).pipe(
      map(users => {
        const userMap = new Map<string, User>();
        users.forEach(user => {
          if (user) {
            userMap.set(user.id, user);
          }
        });

        return logs.map(log => {
          const enrichedLog: EnrichedAuditLog = { ...log };
          if (log.action === 'permission_added' && log.details?.principalId) {
            const targetUser = userMap.get(log.details.principalId);
            if (targetUser) {
              enrichedLog.targetUser = {
                displayName: targetUser.displayName || targetUser.userPrincipalName || 'Unknown User',
                email: targetUser.mail || targetUser.userPrincipalName || ''
              };
            }
          }
          return enrichedLog;
        });
      }),
      catchError(error => {
        console.error('Error enriching logs with user info:', error);
        return of(logs.map(log => ({ ...log } as EnrichedAuditLog)));
      })
    );
  }

  private getUserInfo(userId: string) {
    if (this.userCache.has(userId)) {
      return of(this.userCache.get(userId)!);
    }

    return this.azureApiService.getUserById(userId).pipe(
      map(user => {
        if (user) {
          this.userCache.set(userId, user);
        }
        return user;
      }),
      catchError(error => {
        console.error(`Error fetching user ${userId}:`, error);
        return of(null);
      })
    );
  }

  applyFilters(): void {
    let filtered = [...this.auditLogs] as EnrichedAuditLog[];

    // Apply date range filter
    if (this.filter.startDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= this.filter.startDate!);
    }
    if (this.filter.endDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= this.filter.endDate!);
    }

    // Apply user filter
    if (this.filter.userId) {
      filtered = filtered.filter(log => 
        log.userId?.toLowerCase().includes(this.filter.userId!.toLowerCase()) ||
        log.userName?.toLowerCase().includes(this.filter.userId!.toLowerCase())
      );
    }

    // Apply action filter
    if (this.filter.action) {
      filtered = filtered.filter(log => log.action === this.filter.action);
    }

    // Apply resource type filter
    if (this.filter.targetType) {
      filtered = filtered.filter(log => log.targetType === this.filter.targetType);
    }

    this.filteredLogs = filtered;
  }
  
  getActionColor(action: AuditAction): string {
    switch (action) {
      case 'permission_added':
      case 'lock_added':
        return 'green';
      case 'permission_removed':
      case 'bulk_permissions_removed':
      case 'lock_removed':
        return 'red';
      default:
        return 'blue';
    }
  }
  
  getActionSeverity(action: AuditAction): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (action) {
      case 'permission_added':
      case 'lock_added':
        return 'success';
      case 'permission_removed':
      case 'bulk_permissions_removed':
      case 'lock_removed':
        return 'danger';
      default:
        return 'info';
    }
  }
  
  getActionLabel(action: AuditAction): string {
    const option = this.actionOptions.find(opt => opt.value === action);
    return option ? option.label : action;
  }
  
  formatDetails(details: any): string {
    if (!details) return 'N/A';
    
    const entries = Object.entries(details)
      .filter(([key, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`);
    
    return entries.join(', ');
  }
}