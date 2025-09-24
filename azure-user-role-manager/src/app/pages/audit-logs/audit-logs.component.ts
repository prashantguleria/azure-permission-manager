import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AppAuditService } from '../../services/app-audit.service';
import { AppAuditLog, AuditLogFilter, AuditAction } from '../../models/app-audit-log.model';
import { NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzModalModule,
    NzMessageModule,
    NzDatePickerModule,
    NzSelectModule,
    NzInputModule,
    NzCardModule,
    NzSpaceModule,
    NzPopconfirmModule,
    NzEmptyModule,
    NzGridModule
  ],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.scss']
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  auditLogs: AppAuditLog[] = [];
  filteredLogs: AppAuditLog[] = [];
  loading = false;
  
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
    private message: NzMessageService
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
    this.auditService.getAuditLogs(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (logs) => {
          this.auditLogs = logs;
          this.filteredLogs = [...logs];
          this.loading = false;
        },
        error: (error: any) => {
          console.error('Failed to load audit logs:', error);
          this.message.error('Failed to load audit logs');
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
  
  clearAllLogs(): void {
    this.auditService.clearAuditLogs();
    this.message.success('All audit logs cleared successfully');
    this.loadAuditLogs();
  }
  
  revertOperation(log: AppAuditLog): void {
    if (!log.reversible) {
      this.message.warning('This operation cannot be reverted');
      return;
    }
    
    this.auditService.revertOperation(log.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.message.success('Operation reverted successfully');
          this.loadAuditLogs();
        },
        error: (error: any) => {
          console.error('Failed to revert operation:', error);
          this.message.error('Failed to revert operation: ' + (error.message || 'Unknown error'));
        }
      });
  }
  
  exportLogs(): void {
    const blob = this.auditService.exportAuditLogs();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.message.success('Audit logs exported successfully');
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