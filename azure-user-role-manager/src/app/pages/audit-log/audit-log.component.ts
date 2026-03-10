import {
  Component,
  signal,
  inject,
  DestroyRef,
  afterNextRender,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';

// PrimeNG imports
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

// Services and Models
import { AuthService } from '../../services/auth.service';
import { AppAuditService } from '../../services/app-audit.service';
import { AuditLog } from '../../models/audit.model';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterModule,
    TableModule,
    TagModule,
    ProgressSpinnerModule,
    TooltipModule,
    SelectModule,
    DatePickerModule,
    InputTextModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss'
})
export class AuditLogComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly appAuditService = inject(AppAuditService);
  private readonly message = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchSubject = new Subject<string>();

  // Data signals
  readonly auditLogs = signal<AuditLog[]>([]);
  readonly filteredLogs = signal<AuditLog[]>([]);

  // Pagination signals
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);

  // UI state signals
  readonly loading = signal(false);
  readonly exporting = signal(false);

  // Current user info
  readonly currentUser = signal<any>(null);

  // Filter signals
  readonly searchTerm = signal('');
  readonly selectedActivity = signal('');
  readonly selectedUser = signal('');
  readonly dateRange = signal<Date[]>([]);

  // Filter options
  activityOptions = [
    { label: 'All Activities', value: '' },
    { label: 'Role Assignment', value: 'role_assignment' },
    { label: 'Role Removal', value: 'role_removal' },
    { label: 'User Login', value: 'user_login' },
    { label: 'User Logout', value: 'user_logout' },
    { label: 'Permission Change', value: 'permission_change' },
    { label: 'Tenant Switch', value: 'tenant_switch' }
  ];

  constructor() {
    afterNextRender(() => {
      this.initializeComponent();
      this.setupSearch();
    });
  }

  onRefresh(): void {
    this.loadAuditLogs();
  }

  onClearFilters(): void {
    this.searchTerm.set('');
    this.selectedActivity.set('');
    this.selectedUser.set('');
    this.dateRange.set([]);
    this.applyFilters();
  }

  private initializeComponent(): void {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user: AccountInfo | null) => {
        this.currentUser.set(user);
      });
    this.loadAuditLogs();
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  private loadAuditLogs(): void {
    this.loading.set(true);
    this.appAuditService.getAuditLogs()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (appLogs) => {
          // Map AppAuditLog entries to the AuditLog display format
          const logs: AuditLog[] = appLogs.map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            adminUserId: log.userId,
            adminEmail: log.userName,
            tenantId: '',
            affectedUserId: log.targetId,
            affectedUserEmail: log.targetName,
            actionType: log.action.includes('added') || log.action.includes('created') ? 'ROLE_ADDED' : 'ROLE_REMOVED',
            roleDetails: {
              roleDefinitionId: log.details.roleDefinitionId || '',
              scope: log.targetId || '',
              roleName: log.details.roleName
            },
            status: 'SUCCESS',
            activity: log.action,
            activityDisplayName: log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            userDisplayName: log.userName,
            userPrincipalName: log.userName,
            targetResource: log.targetName,
            details: log.details.additionalInfo || '',
            result: log.reverted ? 'Reverted' : 'Success'
          }));
          this.auditLogs.set(logs);
          this.total.set(logs.length);
          this.applyFilters();
        },
        error: (error: unknown) => {
          console.error('Error loading audit logs:', error);
          this.message.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load audit logs.'
          });
          this.auditLogs.set([]);
          this.total.set(0);
          this.totalCount.set(0);
          this.filteredLogs.set([]);
        }
      });
  }

  applyFilters(): void {
    let filtered = [...this.auditLogs()];

    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(log =>
        log.userDisplayName?.toLowerCase().includes(term) ||
        log.userPrincipalName?.toLowerCase().includes(term) ||
        log.activityDisplayName?.toLowerCase().includes(term) ||
        log.targetResource?.toLowerCase().includes(term) ||
        log.details?.toLowerCase().includes(term)
      );
    }

    if (this.selectedActivity()) {
      filtered = filtered.filter(log => log.activity === this.selectedActivity());
    }

    if (this.selectedUser()) {
      filtered = filtered.filter(log =>
        log.userPrincipalName?.toLowerCase().includes(this.selectedUser().toLowerCase())
      );
    }

    if (this.dateRange() && this.dateRange().length === 2) {
      const startDate = this.dateRange()[0];
      const endDate = this.dateRange()[1];
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= startDate && logDate <= endDate;
      });
    }

    this.filteredLogs.set(filtered);
    this.totalCount.set(filtered.length);
  }

  onSearch(event: any): void {
    const value = (event.target as HTMLInputElement)?.value || '';
    this.searchTerm.set(value);
    this.searchSubject.next(value);
  }

  onActivityChange(value: string): void {
    this.selectedActivity.set(value);
    this.applyFilters();
  }

  onExportCSV(): void {
    this.exporting.set(true);
    const csvContent = this.generateCSV(this.filteredLogs());
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.exporting.set(false);
    this.message.add({ severity: 'success', summary: 'Success', detail: 'Audit logs exported to CSV successfully' });
  }

  onExportJSON(): void {
    this.exporting.set(true);
    const jsonContent = JSON.stringify(this.filteredLogs(), null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.exporting.set(false);
    this.message.add({ severity: 'success', summary: 'Success', detail: 'Audit logs exported to JSON successfully' });
  }

  private generateCSV(logs: AuditLog[]): string {
    const headers = ['Timestamp', 'User', 'Activity', 'Target Resource', 'Result', 'IP Address', 'Details'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.timestamp.toISOString(),
        `"${log.userDisplayName || log.userPrincipalName}"`,
        `"${log.activityDisplayName}"`,
        `"${log.targetResource}"`,
        `"${log.result}"`,
        log.ipAddress,
        `"${log.details}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  getActivityColor(activity: string): string {
    const colorMap: { [key: string]: string } = {
      'role_assignment': 'green',
      'role_removal': 'red',
      'user_login': 'blue',
      'user_logout': 'orange',
      'permission_change': 'purple',
      'tenant_switch': 'cyan'
    };
    return colorMap[activity] || 'default';
  }

  getActivitySeverity(activity: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const severityMap: { [key: string]: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' } = {
      'role_assignment': 'success',
      'role_removal': 'danger',
      'user_login': 'info',
      'user_logout': 'warn',
      'permission_change': 'contrast',
      'tenant_switch': 'info'
    };
    return severityMap[activity] || 'secondary';
  }

  trackByLogId(index: number, item: AuditLog): string {
    return item.id || index.toString();
  }

  // Navigation methods removed - handled by main app layout

  formatDate(date: string | Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getResultSeverity(result: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (result?.toLowerCase()) {
      case 'success':
        return 'success';
      case 'failure':
      case 'failed':
        return 'danger';
      case 'warning':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  getResultColor(result: string): string {
    switch (result?.toLowerCase()) {
      case 'success':
        return 'green';
      case 'failure':
      case 'failed':
        return 'red';
      case 'warning':
        return 'orange';
      default:
        return 'default';
    }
  }

  onPageChange(pageIndex: number): void {
    this.currentPage.set(pageIndex);
    this.pageIndex.set(pageIndex);
    // No need to reload data, pagination is handled client-side through filteredLogs
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.pageIndex.set(1);
    this.currentPage.set(1);
    // No need to reload data, pagination is handled client-side through filteredLogs
  }

  // Utility methods
}
