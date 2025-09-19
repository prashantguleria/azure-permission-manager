import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';

// NG-ZORRO imports
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzGridModule } from 'ng-zorro-antd/grid';

// Services and Models
import { AuthService } from '../../services/auth.service';
import { AzureApiService } from '../../services/azure-api.service';
import { AuditLog } from '../../models/audit.model';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzLayoutModule,
    NzBreadCrumbModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzTypographyModule,
    NzTableModule,
    NzTagModule,
    NzSpinModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    NzToolTipModule,
    NzDividerModule,
    NzAvatarModule,
    NzDropDownModule,
    NzMenuModule,
    NzGridModule
  ],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss'
})
export class AuditLogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  // Data properties
  auditLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  
  // Pagination
  pageIndex = 1;
  pageSize = 10;
  total = 0;
  totalCount = 0;
  currentPage = 1;
  
  // UI state
  loading = false;
  exporting = false;
  
  // Current user info
  currentUser: any = null;
  
  // Filters
  searchTerm = '';
  selectedActivity = '';
  selectedUser = '';
  dateRange: Date[] = [];
  
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

  constructor(
    private router: Router,
    private authService: AuthService,
    private azureApiService: AzureApiService,
    private message: NzMessageService
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }



  onRefresh(): void {
    this.loadAuditLogs();
  }

  onClearFilters(): void {
    this.searchTerm = '';
    this.selectedActivity = '';
    this.selectedUser = '';
    this.dateRange = [];
    this.applyFilters();
  }

  private initializeComponent(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: AccountInfo | null) => {
      this.currentUser = user;
    });
    this.loadAuditLogs();
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  private loadAuditLogs(): void {
    this.loading = true;
    this.azureApiService.getAuditLogs({
      pageSize: this.pageSize * 5, // Get more results for client-side pagination
      activityType: this.selectedActivity,
      user: this.selectedUser,
      startDate: this.dateRange[0],
      endDate: this.dateRange[1]
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (response: AuditLog[] | any) => {
          this.auditLogs = Array.isArray(response) ? response : (response as any).data || [];
          this.total = this.auditLogs.length;
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error loading audit logs:', error);
          this.message.error('Failed to load audit logs. Please check your connection and try again.');
          this.auditLogs = [];
          this.total = 0;
          this.totalCount = 0;
          this.filteredLogs = [];
        }
      });
  }



  applyFilters(): void {
    let filtered = [...this.auditLogs];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.userDisplayName?.toLowerCase().includes(term) ||
        log.userPrincipalName?.toLowerCase().includes(term) ||
        log.activityDisplayName?.toLowerCase().includes(term) ||
        log.targetResource?.toLowerCase().includes(term) ||
        log.details?.toLowerCase().includes(term)
      );
    }

    if (this.selectedActivity) {
      filtered = filtered.filter(log => log.activity === this.selectedActivity);
    }

    if (this.selectedUser) {
      filtered = filtered.filter(log => 
        log.userPrincipalName?.toLowerCase().includes(this.selectedUser.toLowerCase())
      );
    }

    if (this.dateRange && this.dateRange.length === 2) {
      const startDate = this.dateRange[0];
      const endDate = this.dateRange[1];
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= startDate && logDate <= endDate;
      });
    }

    this.filteredLogs = filtered;
    this.totalCount = filtered.length;
  }

  onSearch(event: any): void {
    const value = (event.target as HTMLInputElement)?.value || '';
    this.searchTerm = value;
    this.searchSubject.next(value);
  }

  onActivityChange(value: string): void {
    this.selectedActivity = value;
    this.applyFilters();
  }

  onExportCSV(): void {
    this.exporting = true;
    const csvContent = this.generateCSV(this.filteredLogs);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.exporting = false;
    this.message.success('Audit logs exported to CSV successfully');
  }

  onExportJSON(): void {
    this.exporting = true;
    const jsonContent = JSON.stringify(this.filteredLogs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.exporting = false;
    this.message.success('Audit logs exported to JSON successfully');
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
    this.currentPage = pageIndex;
    this.pageIndex = pageIndex;
    // No need to reload data, pagination is handled client-side through filteredLogs
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize = pageSize;
    this.pageIndex = 1;
    this.currentPage = 1;
    // No need to reload data, pagination is handled client-side through filteredLogs
  }

  // Utility methods
}
