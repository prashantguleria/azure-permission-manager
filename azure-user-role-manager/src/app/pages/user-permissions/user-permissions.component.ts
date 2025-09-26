import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DialogService } from 'primeng/dynamicdialog';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
// Services
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
import { PermissionDetailsComponent } from '../../components/permission-details/permission-details.component';

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
    CardModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    ProgressSpinnerModule,
    BreadcrumbModule,
    CheckboxModule,
    DialogModule,
    DividerModule,
    ToastModule,
    MessageModule,
    ConfirmDialogModule,
    InputGroupModule,
    InputGroupAddonModule,

  ],
  providers: [MessageService, DialogService, ConfirmationService],
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
  
  // Breadcrumb navigation
  breadcrumbItems: MenuItem[] = [];
  homeItem: MenuItem = { icon: 'pi pi-home', routerLink: '/app/dashboard' };
  
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
  selectAll = false;
  indeterminate = false;
  bulkOperationLoading = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private azureApiService: AzureApiService,
    private permissionsService: PermissionsService,
    private route: ActivatedRoute,
    private router: Router,
    private dialogService: DialogService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
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
        this.userId = params['userId'];
        
        // Initialize breadcrumb
        this.initializeBreadcrumb();
        
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

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Permissions loaded successfully' });
    } catch (error) {
      console.error('Failed to load permissions:', error);
      
      if (error instanceof PermissionError) {
        this.error = error.message;
        if (error.code === 'INSUFFICIENT_PERMISSIONS') {
          this.messageService.add({ severity: 'error', summary: 'Access Denied', detail: 'You do not have sufficient permissions to view this user\'s permissions' });
        }
      } else {
        this.error = 'Failed to load user permissions. Please try again.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load permissions' });
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
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'No permissions to export' });
      return;
    }

    try {
      const userId = this.selectedUser.id;
      const displayName = this.selectedUser.displayName;
      
      if (!userId || !displayName) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'User information is incomplete' });
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

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Permissions exported successfully' });
    } catch (error) {
      console.error('Export failed:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to export permissions' });
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

  // Breadcrumb initialization
  private initializeBreadcrumb(): void {
    this.breadcrumbItems = [
      { label: 'Users', command: () => this.navigateToUsers() },
      { label: this.getUserDisplayName(), command: () => this.navigateToUserDetails() },
      { label: 'Permissions' }
    ];
  }

  // Navigation Methods
  navigateToUsers(): void {
    this.router.navigate(['/app/user-management']);
  }

  navigateToUserDetails(): void {
    this.router.navigate(['/app/user-detail', this.userId]);
  }

  // Bulk Selection Methods
  updateSelectionState(): void {
    const selectedCount = this.selectedPermissions.size;
    const totalCount = this.filteredPermissions.length;
    
    this.selectAll = selectedCount === totalCount && totalCount > 0;
    this.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }

  onAllChecked(event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    
    this.filteredPermissions.forEach(permission => {
      permission.selected = isChecked;
      if (isChecked) {
        this.selectedPermissions.add(permission.id);
      } else {
        this.selectedPermissions.delete(permission.id);
      }
    });
    this.updateSelectionState();
  }

  onItemChecked(id: string, event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    
    if (isChecked) {
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
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'No permissions selected for removal'
      });
      return;
    }

    this.bulkOperationLoading = true;
    
    try {
      const selectedIds = Array.from(this.selectedPermissions);
      const permissionsToRemove = this.filteredPermissions.filter(
        permission => selectedIds.includes(permission.id)
      );
      
      let successCount = 0;
      let errorCount = 0;
      
      // Remove each permission individually
      for (const permission of permissionsToRemove) {
        try {
          await this.removePermissionWithoutReload(permission);
          successCount++;
        } catch (error) {
          console.error(`Error removing permission ${permission.id}:`, error);
          errorCount++;
        }
      }
      
      // Clear selection
      this.selectedPermissions.clear();
      this.updateSelectionState();
      
      // Reload permissions to reflect changes from Azure
      await this.loadUserPermissions();
      
      // Show summary message
      if (errorCount === 0) {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `${successCount} permission(s) removed successfully`
        });
      } else {
        this.messageService.add({
          severity: 'warn',
          summary: 'Partial Success',
          detail: `${successCount} permission(s) removed, ${errorCount} failed`
        });
      }
      
    } catch (error) {
      console.error('Error removing permissions:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to remove selected permissions'
      });
    } finally {
      this.bulkOperationLoading = false;
    }
  }

  private async removePermissionWithoutReload(permission: PermissionTableItem): Promise<void> {
    try {
      // Call appropriate removal method based on permission type
      switch (permission.type) {
        case 'Directory':
          await this.removeDirectoryRoleAssignment(permission);
          break;
        case 'Application':
          await this.removeApplicationRoleAssignment(permission);
          break;
        case 'RBAC':
          await this.removeRBACRoleAssignment(permission);
          break;
        default:
          throw new Error(`Unsupported permission type: ${permission.type}`);
      }
    } catch (error) {
      console.error(`Error removing permission ${permission.id}:`, error);
      throw error;
    }
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

  viewPermissionDetails(permission: PermissionTableItem): void {
    const ref = this.dialogService.open(PermissionDetailsComponent, {
      header: 'Permission Details',
      width: '600px',
      data: {
        permission: permission
      }
    });
  }

  confirmRemovePermission(permission: PermissionTableItem): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to remove the "${permission.roleName}" role assignment for this user?`,
      header: 'Confirm Permission Removal',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.removePermission(permission);
      }
    });
  }

  private async removePermission(permission: PermissionTableItem): Promise<void> {
    try {
      this.loading = true;
      
      // Call appropriate removal method based on permission type
      switch (permission.type) {
        case 'Directory':
          await this.removeDirectoryRoleAssignment(permission);
          break;
        case 'Application':
          await this.removeApplicationRoleAssignment(permission);
          break;
        case 'RBAC':
          await this.removeRBACRoleAssignment(permission);
          break;
        default:
          throw new Error(`Unsupported permission type: ${permission.type}`);
      }
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `${permission.type} role "${permission.roleName}" removed successfully`
      });
      
      // Reload permissions to reflect changes from Azure
      await this.loadUserPermissions();
      
    } catch (error) {
      console.error('Error removing permission:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error instanceof Error ? error.message : 'Failed to remove permission'
      });
    } finally {
      this.loading = false;
    }
  }

  getScopeLevel(scope: string): string {
    // Extract scope level from Azure resource path
    if (scope.includes('/subscriptions/') && scope.includes('/resourceGroups/') && scope.includes('/providers/')) {
      return 'Resource';
    } else if (scope.includes('/subscriptions/') && scope.includes('/resourceGroups/')) {
      return 'Resource Group';
    } else if (scope.includes('/subscriptions/')) {
      return 'Subscription';
    } else if (scope.includes('/providers/Microsoft.Management/managementGroups/')) {
      return 'Management Group';
    }
    return 'Unknown';
  }

  getScopePath(scope: string): string {
    // Extract readable path from Azure resource scope
    const parts = scope.split('/');
    const pathParts: string[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'subscriptions' && i + 1 < parts.length) {
        pathParts.push(`Sub: ${parts[i + 1].substring(0, 8)}...`);
      } else if (parts[i] === 'resourceGroups' && i + 1 < parts.length) {
        pathParts.push(`RG: ${parts[i + 1]}`);
      } else if (parts[i] === 'providers' && i + 2 < parts.length) {
        pathParts.push(`${parts[i + 2]}`);
      }
    }
    
    return pathParts.join(' / ') || scope;
  }

  getTypeTagSeverity(principalType: string): 'success' | 'info' | 'warning' | 'danger' {
    // Return PrimeNG tag severity based on principal type
    switch (principalType?.toLowerCase()) {
      case 'user':
        return 'info';
      case 'group':
        return 'success';
      case 'serviceprincipal':
        return 'warning';
      case 'managedidentity':
        return 'danger';
      default:
        return 'info';
    }
  }

  getRoleTagSeverity(roleName: string): 'success' | 'info' | 'warning' | 'danger' {
    // Return PrimeNG tag severity based on role name
    if (!roleName) {
      return 'info';
    }
    const highPrivilegeRoles = ['Owner', 'Contributor', 'Global Administrator', 'User Administrator'];
    if (highPrivilegeRoles.some(role => roleName.includes(role))) {
      return 'danger';
    }
    return 'info';
  }

  isIndeterminate(): boolean {
    const selectedCount = this.getSelectedCount();
    return selectedCount > 0 && selectedCount < this.filteredPermissions.length;
  }

  onSelectAllChange(event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    
    if (isChecked) {
      this.filteredPermissions.forEach(permission => {
        permission.selected = true;
        this.selectedPermissions.add(permission.id);
      });
    } else {
      this.filteredPermissions.forEach(permission => {
        permission.selected = false;
        this.selectedPermissions.delete(permission.id);
      });
    }
    this.updateSelectionState();
  }

  onPermissionSelectionChange(): void {
    // Update selected permissions set based on individual checkbox changes
    this.selectedPermissions.clear();
    this.filteredPermissions.forEach(permission => {
      if (permission.selected) {
        this.selectedPermissions.add(permission.id);
      }
    });
    this.updateSelectionState();
  }

  confirmRemoveSelected(): void {
    const selectedCount = this.getSelectedCount();
    if (selectedCount === 0) return;
    
    this.confirmationService.confirm({
      message: `Are you sure you want to remove ${selectedCount} selected permission${selectedCount > 1 ? 's' : ''}?`,
      header: 'Confirm Bulk Permission Removal',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.bulkRemovePermissions();
      }
    });
  }



  clearError(): void {
    this.error = null;
  }

  /**
   * Remove Directory role assignment
   */
  private async removeDirectoryRoleAssignment(permission: PermissionTableItem): Promise<void> {
    if (!this.selectedUser) {
      throw new Error('No user selected');
    }
    
    // For directory roles, we need to call the Azure API service
    const result = await firstValueFrom(this.azureApiService.removeUserRole({ assignmentId: permission.id }));
    if (!result.success) {
      throw new Error(result.message || 'Failed to remove directory role');
    }
  }

  /**
   * Remove Application role assignment
   */
  private async removeApplicationRoleAssignment(permission: PermissionTableItem): Promise<void> {
    if (!this.selectedUser) {
      throw new Error('No user selected');
    }
    
    // For application roles, we need to call the Azure API service
    const result = await firstValueFrom(this.azureApiService.removeUserRole({ assignmentId: permission.id }));
    if (!result.success) {
      throw new Error(result.message || 'Failed to remove application role');
    }
  }

  /**
   * Remove RBAC role assignment
   */
  private async removeRBACRoleAssignment(permission: PermissionTableItem): Promise<void> {
    if (!permission.resourceId || !permission.principalId) {
      throw new Error('Missing resource ID or principal ID for RBAC role removal');
    }
    
    // For RBAC roles, we need to use the permissions service
    await firstValueFrom(this.permissionsService.removeStorageAccountPermission(
      permission.id,
      permission.resourceId || ''
    ));
  }

}