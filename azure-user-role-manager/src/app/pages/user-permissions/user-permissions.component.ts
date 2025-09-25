import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { AzureApiService } from '../../services/azure-api.service';
import { PermissionsService } from '../../services/permissions.service';
import {
  UserPermissions,
  PermissionSummary,
  PermissionFilter,
  DirectoryRole,
  AppRoleAssignment,
  AzureRoleAssignment,
  PermissionError
} from '../../models/permissions.model';
import { User } from '../../models/user.model';

interface PermissionTableItem {
  type: 'Directory' | 'Application' | 'RBAC';
  roleName: string;
  resourceName: string;
  scope: string;
  assignedDate?: Date;
  description?: string;
  isHighPrivilege?: boolean;
}

@Component({
  selector: 'app-user-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzCardModule,
    NzTagModule,
    NzIconModule,
    NzSpinModule,
    NzDividerModule,
    NzStatisticModule,
    NzAlertModule
  ],
  templateUrl: './user-permissions.component.html',
  styleUrls: ['./user-permissions.component.css']
})
export class UserPermissionsComponent implements OnInit, OnDestroy {
  @Input() selectedUser: Partial<User> | null = null;
  @Input() userId?: string;

  private destroy$ = new Subject<void>();
  
  loading = false;
  permissions: UserPermissions | null = null;
  permissionSummary: PermissionSummary | null = null;
  filteredPermissions: PermissionTableItem[] = [];
  allPermissions: PermissionTableItem[] = [];
  error: string | null = null;

  // Filter properties
  searchQuery = '';
  selectedPermissionType = 'all';
  selectedSubscription = '';
  subscriptions: { id: string; name: string }[] = [];

  // Table properties
  pageSize = 10;
  pageIndex = 1;
  sortField: string | null = null;
  sortOrder: string | null = null;

  // Permission type options
  permissionTypeOptions = [
    { label: 'All Permissions', value: 'all' },
    { label: 'Directory Roles', value: 'directory' },
    { label: 'Application Roles', value: 'application' },
    { label: 'RBAC Roles', value: 'rbac' }
  ];

  constructor(
    private azureApiService: AzureApiService,
    private permissionsService: PermissionsService,
    private message: NzMessageService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get user info from query parameters
    this.route.queryParams.subscribe(params => {
      if (params['userId']) {
        this.selectedUser = {
          id: params['userId'],
          displayName: params['displayName'] || 'Unknown User',
          email: params['email'] || ''
        };
        this.loadUserPermissions();
      } else {
        // If no user selected, redirect back to user management
        this.router.navigate(['/app/user-management']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUserPermissions(): Promise<void> {
    if (!this.selectedUser && !this.userId) {
      this.error = 'No user selected';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      const targetUserId = this.userId || this.selectedUser?.id;
      if (!targetUserId) {
        throw new Error('User ID is required');
      }
      
      // Load permissions and summary in parallel
      const [permissions, summary] = await Promise.all([
        this.permissionsService.getUserPermissions(targetUserId),
        this.permissionsService.getPermissionSummary(targetUserId).toPromise()
      ]);

      this.permissions = permissions;
      this.permissionSummary = summary || null;
      
      // Extract subscriptions for filter dropdown
      this.subscriptions = permissions.subscriptions.map(sub => ({
        id: sub.subscriptionId,
        name: sub.displayName
      }));

      // Convert to table format
      this.allPermissions = this.convertToTableFormat(permissions);
      this.applyFilters();

      this.message.success('Permissions loaded successfully');
    } catch (error) {
      console.error('Failed to load permissions:', error);
      
      if (error instanceof PermissionError) {
        this.error = error.message;
        if (error.code === 'INSUFFICIENT_PERMISSIONS') {
          this.message.error('You do not have sufficient permissions to view this user\'s permissions');
        }
      } else {
        this.error = 'Failed to load user permissions. Please try again.';
        this.message.error('Failed to load permissions');
      }
    } finally {
      this.loading = false;
    }
  }

  private convertToTableFormat(permissions: UserPermissions): PermissionTableItem[] {
    const items: PermissionTableItem[] = [];

    // Directory roles
    permissions.directoryRoles.forEach(role => {
      items.push({
        type: 'Directory',
        roleName: role.displayName,
        resourceName: 'Azure Active Directory',
        scope: 'Tenant-wide',
        description: role.description,
        isHighPrivilege: this.isHighPrivilegeDirectoryRole(role.displayName)
      });
    });

    // Application roles
    permissions.appRoles.forEach(role => {
      items.push({
        type: 'Application',
        roleName: role.appRoleDisplayName || 'App Role',
        resourceName: role.resourceDisplayName,
        scope: 'Application',
        assignedDate: new Date(role.createdDateTime),
        description: role.appRoleDescription
      });
    });

    // RBAC roles
    permissions.rbacRoles.forEach(role => {
      items.push({
        type: 'RBAC',
        roleName: role.properties.roleDefinitionName || 'Unknown Role',
        resourceName: role.properties.scopeDisplayName || 'Unknown Resource',
        scope: role.properties.scopeType || 'Unknown',
        assignedDate: new Date(role.properties.createdOn),
        isHighPrivilege: this.isHighPrivilegeRbacRole(role.properties.roleDefinitionName)
      });
    });

    return items;
  }

  private isHighPrivilegeDirectoryRole(roleName: string): boolean {
    const highPrivilegeRoles = [
      'Global Administrator',
      'Privileged Role Administrator',
      'Security Administrator',
      'User Administrator',
      'Application Administrator',
      'Cloud Application Administrator'
    ];
    return highPrivilegeRoles.includes(roleName);
  }

  private isHighPrivilegeRbacRole(roleName?: string): boolean {
    if (!roleName) return false;
    const highPrivilegeRoles = ['Owner', 'User Access Administrator', 'Contributor'];
    return highPrivilegeRoles.includes(roleName);
  }

  applyFilters(): void {
    if (!this.permissions) return;

    const filter: PermissionFilter = {
      searchQuery: this.searchQuery.trim() || undefined,
      permissionType: this.selectedPermissionType !== 'all' ? this.selectedPermissionType as any : undefined,
      subscriptionId: this.selectedSubscription || undefined
    };

    const filteredPermissions = this.permissionsService.filterPermissions(this.permissions, filter);
    this.filteredPermissions = this.convertToTableFormat(filteredPermissions);
  }

  onSearch(): void {
    this.applyFilters();
  }

  onPermissionTypeChange(): void {
    this.applyFilters();
  }

  onSubscriptionChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedPermissionType = 'all';
    this.selectedSubscription = '';
    this.applyFilters();
  }

  exportPermissions(): void {
    if (!this.permissions || !this.selectedUser) {
      this.message.warning('No permissions to export');
      return;
    }

    try {
      const userId = this.selectedUser.id;
      const displayName = this.selectedUser.displayName;
      
      if (!userId || !displayName) {
        this.message.error('User information is incomplete');
        return;
      }
      
      const blob = this.permissionsService.exportPermissions(
        this.permissions,
        userId,
        displayName
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.selectedUser.displayName}_permissions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.message.success('Permissions exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      this.message.error('Failed to export permissions');
    }
  }

  refreshPermissions(): void {
    this.permissionsService.clearCache();
    this.loadUserPermissions();
  }

  getPermissionTypeColor(type: string): string {
    switch (type) {
      case 'Directory': return 'blue';
      case 'Application': return 'green';
      case 'RBAC': return 'orange';
      default: return 'default';
    }
  }

  getScopeColor(scope: string): string {
    switch (scope) {
      case 'Tenant-wide': return 'red';
      case 'Subscription': return 'orange';
      case 'ResourceGroup': return 'blue';
      case 'Resource': return 'green';
      default: return 'default';
    }
  }

  onTableSort(sort: { key: string; value: string | null }): void {
    this.sortField = sort.key;
    this.sortOrder = sort.value;
    
    if (sort.value) {
      this.filteredPermissions = [...this.filteredPermissions].sort((a, b) => {
        const aValue = (a as any)[sort.key];
        const bValue = (b as any)[sort.key];
        
        if (aValue < bValue) {
          return sort.value === 'ascend' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sort.value === 'ascend' ? 1 : -1;
        }
        return 0;
      });
    }
  }

  getUserDisplayName(): string {
    return this.selectedUser?.displayName || 'Current User';
  }
}