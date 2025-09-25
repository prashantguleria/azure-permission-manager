import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';

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
  id: string;
  type: 'Directory' | 'Application' | 'RBAC';
  roleName: string;
  resourceName: string;
  resourceGroup?: string;
  resourceType?: string;
  scope: string;
  assignedDate?: Date;
  description?: string;
  isHighPrivilege?: boolean;
  selected?: boolean;
  resourceId?: string;
  principalId?: string;
}

interface AzureResource {
  id: string;
  name: string;
  type: string;
  resourceGroup?: string;
  subscriptionId?: string;
}

interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'builtin' | 'custom';
}

@Component({
  selector: 'app-user-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    NzAlertModule,
    NzSpinModule,
    NzIconModule,
    NzEmptyModule,
    NzBreadCrumbModule,
    NzCheckboxModule,
    NzModalModule,
    NzListModule,
    NzDividerModule,
    NzStatisticModule,

  ],
  templateUrl: './user-permissions.component.html',
  styleUrls: ['./user-permissions.component.css']
})
export class UserPermissionsComponent implements OnInit, OnDestroy {
  // Component properties
  userId: string = '';
  userDisplayName: string = '';
  loading = false;
  error: string | null = null;
  permissions: UserPermissions | null = null;
  filteredPermissions: PermissionTableItem[] = [];
  allPermissions: PermissionTableItem[] = [];
  selectedUser: User | null = null;
  permissionSummary: PermissionSummary | null = null;
  subscriptions: { id: string; name: string }[] = [];
  
  // Add permission modal
  showAddPermissionModal = false;
  resourceSearchQuery = '';
  searchedResources: AzureResource[] = [];
  selectedResource: AzureResource | null = null;
  availableRoles: RoleDefinition[] = [];
  selectedRole = '';
  resourceSearchLoading = false;
  addPermissionLoading = false;
  

  searchQuery: string = '';
  
  // Filter properties
  searchTerm = '';
  selectedPermissionType = 'all';
  selectedSubscription = '';
  
  // Filter options
  permissionTypeOptions = [
    { label: 'All Types', value: 'all' },
    { label: 'Directory Roles', value: 'directory' },
    { label: 'Application Roles', value: 'application' },
    { label: 'RBAC Roles', value: 'rbac' }
  ];
  
  // Table properties
  sortField = '';
  sortOrder: 'ascend' | 'descend' | null = null;
  pageSize = 10;
  pageIndex = 1;
  
  // Bulk operations
  selectedPermissions = new Set<string>();
  allSelected = false;
  indeterminate = false;
  bulkOperationLoading = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private azureApiService: AzureApiService,
    private permissionsService: PermissionsService,
    private route: ActivatedRoute,
    private router: Router,
    private modal: NzModalService,
    private message: NzMessageService
  ) {}

  ngOnInit(): void {
    // Get user info from query parameters
    this.route.queryParams.subscribe(params => {
      if (params['userId']) {
        this.selectedUser = {
          id: params['userId'],
          displayName: params['displayName'] || 'Unknown User',
          email: params['email'] || '',
          userPrincipalName: params['userPrincipalName'] || params['email'] || '',
          isEnabled: true,
          createdDate: new Date()
        };
        this.loadUserPermissions();
      } else {
        // If no user selected, redirect back to user management
        this.router.navigate(['/app/user-management']);
      }
    });
    
    // Initialize selection tracking
    this.updateSelectionState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Parse Azure resource ID to extract resource information
   * Format: /subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/{resource-provider}/{resource-type}/{resource-name}
   */
  private parseResourceId(resourceId: string): { resourceName: string; resourceGroup?: string; resourceType?: string } {
    if (!resourceId || resourceId.trim() === '') {
      return { resourceName: 'Unknown Resource' };
    }

    // Handle special cases
    if (resourceId === 'tenant') {
      return { resourceName: 'Azure Active Directory', resourceType: 'Tenant' };
    }

    // Handle tenant level scope
    if (resourceId === '/' || resourceId.toLowerCase().includes('tenant')) {
      return {
        resourceName: 'Tenant Root',
        resourceType: 'Tenant'
      };
    }

    // Handle subscription level
    if (resourceId.match(/^\/subscriptions\/[^/]+$/)) {
      const subscriptionId = resourceId.split('/')[2];
      return { 
        resourceName: subscriptionId ? `Subscription (${subscriptionId.substring(0, 8)}...)` : 'Subscription',
        resourceType: 'Subscription' 
      };
    }

    // Handle resource group level
    const rgMatch = resourceId.match(/\/subscriptions\/[^/]+\/resourceGroups\/([^/]+)$/);
    if (rgMatch) {
      return {
        resourceName: rgMatch[1],
        resourceGroup: rgMatch[1],
        resourceType: 'Resource Group'
      };
    }

    // Handle full resource path
    const fullMatch = resourceId.match(/\/subscriptions\/[^/]+\/resourceGroups\/([^/]+)\/providers\/([^/]+)\/([^/]+)\/(.+)$/);
    if (fullMatch) {
      const [, resourceGroup, provider, resourceTypeRaw, resourceName] = fullMatch;
      
      // Map common Azure resource types to friendly names
      const typeMapping: { [key: string]: string } = {
        'Microsoft.Storage/storageAccounts': 'Storage Account',
        'Microsoft.Compute/virtualMachines': 'Virtual Machine',
        'Microsoft.Web/sites': 'App Service',
        'Microsoft.Sql/servers': 'SQL Server',
        'Microsoft.KeyVault/vaults': 'Key Vault',
        'Microsoft.Network/virtualNetworks': 'Virtual Network',
        'Microsoft.Network/networkSecurityGroups': 'Network Security Group',
        'Microsoft.Network/publicIPAddresses': 'Public IP Address',
        'Microsoft.Network/loadBalancers': 'Load Balancer',
        'Microsoft.ContainerRegistry/registries': 'Container Registry',
        'Microsoft.DocumentDB/databaseAccounts': 'Cosmos DB',
        'Microsoft.Cache/Redis': 'Redis Cache',
        'Microsoft.ServiceBus/namespaces': 'Service Bus',
        'Microsoft.EventHub/namespaces': 'Event Hub'
      };
      
      const friendlyType = typeMapping[`${provider}/${resourceTypeRaw}`] || resourceTypeRaw.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

      return {
        resourceName: resourceName || 'Unknown Resource',
        resourceGroup,
        resourceType: friendlyType
      };
    }

    // Handle management group scope
    if (resourceId.includes('/providers/Microsoft.Management/managementGroups/')) {
      const mgMatch = resourceId.match(/\/providers\/Microsoft\.Management\/managementGroups\/([^/]+)/);
      const mgName = mgMatch ? mgMatch[1] : 'Unknown';
      return {
        resourceName: mgName,
        resourceType: 'Management Group'
      };
    }

    // Fallback: try to extract resource name from the end of the path
    const pathParts = resourceId.split('/').filter(part => part.trim() !== '');
    let resourceName = 'Unknown Resource';
    let resourceGroup: string | undefined;
    let resourceType: string | undefined;

    // Try to find resource group in the path
    const rgIndex = pathParts.findIndex(part => part.toLowerCase() === 'resourcegroups');
    if (rgIndex !== -1 && rgIndex + 1 < pathParts.length) {
      resourceGroup = pathParts[rgIndex + 1];
    }

    // Use the last meaningful part as resource name
    if (pathParts.length > 0) {
      resourceName = pathParts[pathParts.length - 1] || 'Unknown Resource';
    }

    // Try to determine resource type from path
    const providerIndex = pathParts.findIndex(part => part.toLowerCase() === 'providers');
    if (providerIndex !== -1 && providerIndex + 2 < pathParts.length) {
      const type = pathParts[providerIndex + 2];
      resourceType = type || 'Resource';
    }
    
    return { resourceName, resourceGroup, resourceType };
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
    permissions.directoryRoles.forEach((role, index) => {
      items.push({
        id: `directory-${index}-${role.id || role.displayName}`,
        type: 'Directory',
        roleName: role.displayName,
        resourceName: 'Azure Active Directory',
        resourceType: 'Tenant',
        scope: 'Tenant-wide',
        description: role.description,
        isHighPrivilege: this.isHighPrivilegeDirectoryRole(role.displayName),
        selected: false,
        resourceId: 'tenant',
        principalId: this.selectedUser?.id || ''
      });
    });

    // Application roles
    permissions.appRoles.forEach((role, index) => {
      items.push({
        id: `application-${index}-${role.id}`,
        type: 'Application',
        roleName: role.appRoleDisplayName || 'App Role',
        resourceName: role.resourceDisplayName,
        resourceType: 'Application',
        scope: 'Application',
        assignedDate: new Date(role.createdDateTime),
        description: role.appRoleDescription,
        selected: false,
        resourceId: role.resourceId,
        principalId: role.principalId
      });
    });

    // RBAC roles
    permissions.rbacRoles.forEach((role, index) => {
      const resourceInfo = this.parseResourceId(role.properties.scope);
      
      items.push({
        id: `rbac-${index}-${role.name}`,
        type: 'RBAC',
        roleName: role.properties.roleDefinitionName || 'Unknown Role',
        resourceName: resourceInfo.resourceName,
        resourceGroup: resourceInfo.resourceGroup,
        resourceType: resourceInfo.resourceType,
        scope: role.properties.scopeType || 'Unknown',
        assignedDate: new Date(role.properties.createdOn),
        isHighPrivilege: this.isHighPrivilegeRbacRole(role.properties.roleDefinitionName),
        selected: false,
        resourceId: role.properties.scope,
        principalId: role.properties.principalId
      });
    });

    // Update selection state after converting
    setTimeout(() => this.updateSelectionState(), 0);
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
    this.sortOrder = sort.value as 'ascend' | 'descend' | null;
    
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

  // Navigation Methods
  navigateToUsers(): void {
    this.router.navigate(['/app/user-management']);
  }

  navigateToUserDetails(): void {
    this.router.navigate(['/app/user-management'], { 
      queryParams: { selectedUserId: this.userId } 
    });
  }

  // Bulk Selection Methods
  updateSelectionState(): void {
    const selectedCount = this.selectedPermissions.size;
    const totalCount = this.filteredPermissions.length;
    
    this.allSelected = selectedCount > 0 && selectedCount === totalCount;
    this.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }

  onAllChecked(checked: boolean): void {
    this.filteredPermissions.forEach(permission => {
      if (checked) {
        this.selectedPermissions.add(permission.id);
      } else {
        this.selectedPermissions.delete(permission.id);
      }
    });
    this.updateSelectionState();
  }

  onItemChecked(id: string, checked: boolean): void {
    if (checked) {
      this.selectedPermissions.add(id);
    } else {
      this.selectedPermissions.delete(id);
    }
    this.updateSelectionState();
  }

  getSelectedCount(): number {
    return this.selectedPermissions.size;
  }

  // Bulk Operations
  async bulkRemovePermissions(): Promise<void> {
    if (this.selectedPermissions.size === 0) {
      return;
    }

    this.bulkOperationLoading = true;
    
    try {
      const selectedItems = this.filteredPermissions.filter(p => 
        this.selectedPermissions.has(p.id)
      );
      
      // Remove permissions via API calls
      const removePromises = selectedItems.map(item => 
        this.removePermission(item.resourceId || '', item.principalId || '', item.roleName)
      );
      
      await Promise.all(removePromises);
      
      // Clear selections and refresh
      this.selectedPermissions.clear();
      this.updateSelectionState();
      await this.loadUserPermissions();
      
      // Show success message
      console.log(`Successfully removed ${selectedItems.length} permissions`);
      
    } catch (error) {
      console.error('Error removing permissions:', error);
      // Handle error - could show notification
    } finally {
      this.bulkOperationLoading = false;
    }
  }

  private async removePermission(resourceId: string, principalId: string, roleName: string): Promise<void> {
    // Simulate API call to remove permission
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // In real implementation, make actual API call
        console.log(`Removing permission: ${roleName} from ${resourceId} for ${principalId}`);
        resolve();
      }, 500);
    });
  }

  // Add Permission Modal Methods
  openAddPermissionModal(): void {
    this.showAddPermissionModal = true;
    this.resetAddPermissionForm();
  }

  closeAddPermissionModal(): void {
    this.showAddPermissionModal = false;
    this.resetAddPermissionForm();
  }

  resetAddPermissionForm(): void {
    this.resourceSearchQuery = '';
    this.searchedResources = [];
    this.selectedResource = null;
    this.availableRoles = [];
    this.selectedRole = '';
    this.resourceSearchLoading = false;
    this.addPermissionLoading = false;
  }

  async searchResources(): Promise<void> {
    if (!this.resourceSearchQuery.trim()) {
      return;
    }

    this.resourceSearchLoading = true;
    
    try {
      // Simulate API call to search Azure resources
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock search results
      this.searchedResources = [
        {
          id: '/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Storage/storageAccounts/storage1',
          name: 'storage1',
          type: 'Storage Account',
          resourceGroup: 'rg1',
          subscriptionId: 'sub1'
        },
        {
          id: '/subscriptions/sub1/resourceGroups/rg1',
          name: 'rg1',
          type: 'Resource Group',
          subscriptionId: 'sub1'
        },
        {
          id: '/subscriptions/sub1',
          name: 'Production Subscription',
          type: 'Subscription',
          subscriptionId: 'sub1'
        }
      ].filter(resource => 
        resource.name.toLowerCase().includes(this.resourceSearchQuery.toLowerCase()) ||
        resource.type.toLowerCase().includes(this.resourceSearchQuery.toLowerCase())
      );
      
    } catch (error) {
      console.error('Error searching resources:', error);
      this.searchedResources = [];
    } finally {
      this.resourceSearchLoading = false;
    }
  }

  selectResource(resource: AzureResource): void {
    this.selectedResource = resource;
    this.selectedRole = '';
    this.loadAvailableRoles(resource);
  }

  async loadAvailableRoles(resource: AzureResource): Promise<void> {
    this.availableRoles = [];
    
    try {
      // Simulate API call to get available roles for resource type
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock available roles based on resource type
      const allRoles: RoleDefinition[] = [
        {
          id: 'reader',
          name: 'Reader',
          description: 'View all resources, but cannot make any changes.',
          type: 'builtin'
        },
        {
          id: 'contributor',
          name: 'Contributor',
          description: 'Create and manage all types of Azure resources but cannot grant access to others.',
          type: 'builtin'
        },
        {
          id: 'owner',
          name: 'Owner',
          description: 'Full access to all resources including the right to delegate access to others.',
          type: 'builtin'
        }
      ];
      
      if (resource.type === 'Storage Account') {
        allRoles.push(
          {
            id: 'storage-blob-data-reader',
            name: 'Storage Blob Data Reader',
            description: 'Read and list Azure Storage containers and blobs.',
            type: 'builtin'
          },
          {
            id: 'storage-blob-data-contributor',
            name: 'Storage Blob Data Contributor',
            description: 'Read, write, and delete Azure Storage containers and blobs.',
            type: 'builtin'
          }
        );
      }
      
      this.availableRoles = allRoles;
      
    } catch (error) {
      console.error('Error loading available roles:', error);
      this.availableRoles = [];
    }
  }

  async addPermission(): Promise<void> {
    if (!this.selectedResource || !this.selectedRole) {
      return;
    }

    this.addPermissionLoading = true;
    
    try {
      // Simulate API call to assign permission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log(`Adding permission: ${this.selectedRole} on ${this.selectedResource.name} for user ${this.userId}`);
      
      // Close modal and refresh permissions
      this.closeAddPermissionModal();
      await this.loadUserPermissions();
      
      // Show success message
      console.log('Permission added successfully');
      
    } catch (error) {
      console.error('Error adding permission:', error);
      // Handle error - could show notification
    } finally {
      this.addPermissionLoading = false;
    }
  }


}