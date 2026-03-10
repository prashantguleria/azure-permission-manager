import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
  afterNextRender
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormControl, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
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
import { UtilityService } from '../../services/utility.service';

interface PermissionTableItem {
  id: string;
  type: 'Directory' | 'Application' | 'RBAC';
  roleName: string;
  resourceName: string;
  resourceGroup?: string;
  resourceType?: string;
  scope: string;
  scopeLevel?: string;
  scopePath?: string;
  principalType?: string;
  assignedDate?: Date;
  description?: string;
  isHighPrivilege?: boolean;
  selected?: boolean;
  resourceId?: string;
  principalId?: string;
  inherited?: boolean;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    InputTextModule,
    SelectModule,
    TagModule,
    ProgressSpinnerModule,
    BreadcrumbModule,
    CheckboxModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    InputGroupModule,
    InputGroupAddonModule
  ],
  providers: [MessageService, DialogService, ConfirmationService],
  templateUrl: './user-permissions.component.html',
  styleUrl: './user-permissions.component.scss'
})
export class UserPermissionsComponent {
  // Injected services
  private readonly azureApiService = inject(AzureApiService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly utilityService = inject(UtilityService);

  // Component state signals
  readonly userId = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly permissions = signal<UserPermissions | null>(null);
  readonly filteredPermissions = signal<PermissionTableItem[]>([]);
  readonly allPermissions = signal<PermissionTableItem[]>([]);
  readonly selectedUser = signal<User | null>(null);
  readonly permissionSummary = signal<PermissionSummary | null>(null);
  readonly subscriptions = signal<{ id: string; name: string }[]>([]);

  // Breadcrumb navigation
  readonly breadcrumbItems = signal<MenuItem[]>([]);
  readonly homeItem: MenuItem = { icon: 'pi pi-home', routerLink: '/app/user-management' };

  // Add permission modal
  readonly showAddPermissionModal = signal(false);
  readonly searchedResources = signal<AzureResource[]>([]);
  readonly selectedResource = signal<AzureResource | null>(null);
  readonly availableRoles = signal<RoleDefinition[]>([]);
  readonly selectedRole = signal('');
  readonly resourceSearchLoading = signal(false);
  readonly addPermissionLoading = signal(false);

  // Reactive Forms (keep as regular properties)
  filtersForm: FormGroup;
  addPermissionForm: FormGroup;

  // Filter options
  readonly permissionTypeOptions = [
    { label: 'All Types', value: 'all' },
    { label: 'Directory Roles', value: 'directory' },
    { label: 'Application Roles', value: 'application' },
    { label: 'RBAC Roles', value: 'rbac' }
  ];

  // Table properties
  readonly sortField = signal('');
  readonly sortOrder = signal<'ascend' | 'descend' | null>(null);
  readonly pageSize = 10;

  // Bulk operations
  readonly selectedPermissions = signal<Set<string>>(new Set());
  readonly selectAll = signal(false);
  readonly indeterminate = signal(false);
  readonly bulkOperationLoading = signal(false);

  // Computed signals — split permissions by category
  readonly entraPermissions = computed(() =>
    this.filteredPermissions().filter(p => p.type === 'Directory' || p.type === 'Application')
  );
  readonly rbacPermissions = computed(() =>
    this.filteredPermissions().filter(p => p.type === 'RBAC')
  );

  readonly selectedCount = computed(() => this.selectedPermissions().size);
  readonly isIndeterminate = computed(() => {
    const count = this.selectedPermissions().size;
    return count > 0 && count < this.filteredPermissions().length;
  });

  constructor() {
    // Initialize reactive forms
    this.filtersForm = new FormGroup({
      searchTerm: new FormControl(''),
      selectedPermissionType: new FormControl('all'),
      selectedSubscription: new FormControl('')
    });

    this.addPermissionForm = new FormGroup({
      resourceSearchQuery: new FormControl(''),
      selectedRole: new FormControl('')
    });

    afterNextRender(() => {
      // Get user info from query parameters
      this.route.queryParams.pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(params => {
        if (params['userId']) {
          this.selectedUser.set({
            id: params['userId'],
            displayName: params['displayName'] || 'Unknown User',
            email: params['email'] || '',
            userPrincipalName: params['userPrincipalName'] || params['email'] || '',
            isEnabled: true,
            createdDate: new Date()
          });
          this.userId.set(params['userId']);

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
      this.setupFormSubscriptions();
    });
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
    if (!this.selectedUser() && !this.userId()) {
      this.error.set('No user selected');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const targetUserId = this.userId() || this.selectedUser()?.id;
      if (!targetUserId) {
        throw new Error('User ID is required');
      }

      // Load permissions and summary in parallel
      const [permissions, summary] = await Promise.all([
        this.permissionsService.getUserPermissions(targetUserId),
        this.permissionsService.getPermissionSummary(targetUserId).toPromise()
      ]);

      this.permissions.set(permissions);
      this.permissionSummary.set(summary || null);

      // Extract subscriptions for filter dropdown
      this.subscriptions.set(permissions.subscriptions.map(sub => ({
        id: sub.subscriptionId,
        name: sub.displayName
      })));

      // Convert to table format
      this.allPermissions.set(this.convertToTableFormat(permissions));
      this.applyFilters();

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Permissions loaded successfully' });
    } catch (error) {
      console.error('Failed to load permissions:', error);

      if (error instanceof PermissionError) {
        this.error.set(error.message);
        if (error.code === 'INSUFFICIENT_PERMISSIONS') {
          this.messageService.add({ severity: 'error', summary: 'Access Denied', detail: 'You do not have sufficient permissions to view this user\'s permissions' });
        }
      } else {
        this.error.set('Failed to load user permissions. Please try again.');
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load permissions' });
      }
    } finally {
      this.loading.set(false);
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
        scopeLevel: 'Tenant',
        scopePath: 'Azure Active Directory',
        principalType: 'User',
        description: role.description,
        isHighPrivilege: this.isHighPrivilegeDirectoryRole(role.displayName),
        selected: false,
        resourceId: 'tenant',
        principalId: this.selectedUser()?.id || '',
        inherited: false
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
        scopeLevel: 'Application',
        scopePath: role.resourceDisplayName || 'Application',
        principalType: 'User',
        assignedDate: new Date(role.createdDateTime),
        description: role.appRoleDescription,
        selected: false,
        resourceId: role.resourceId,
        principalId: role.principalId,
        inherited: false
      });
    });

    // RBAC roles
    permissions.rbacRoles.forEach((role, index) => {
      const resourceInfo = this.parseResourceId(role.properties.scope);

      // Extract the actual role assignment ID from the Azure API response
      // The role assignment ID should be a GUID, not the full resource path
      let roleAssignmentId = role.name; // Use the 'name' field which contains the GUID

      // If the name field contains a full path, extract just the GUID part
      if (roleAssignmentId && roleAssignmentId.includes('/')) {
        const parts = roleAssignmentId.split('/');
        roleAssignmentId = parts[parts.length - 1]; // Get the last part which should be the GUID
      }

      // Validate that we have a proper GUID format
      const guidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      if (!roleAssignmentId || !guidRegex.test(roleAssignmentId)) {
        // Generate a fallback ID if the original is invalid
        roleAssignmentId = `rbac-${index}-${role.name || 'unknown'}`;
      }

      // Calculate scope level and path
      const scopeLevel = this.getScopeLevel(role.properties.scope);
      const scopePath = this.getScopePath(role.properties.scope);

      items.push({
        id: roleAssignmentId,
        type: 'RBAC',
        roleName: role.properties.roleDefinitionName || 'No role assigned',
        resourceName: resourceInfo.resourceName,
        resourceGroup: resourceInfo.resourceGroup,
        resourceType: resourceInfo.resourceType,
        scope: role.properties.scope,
        scopeLevel: scopeLevel,
        scopePath: scopePath,
        principalType: role.properties.principalType || 'User',
        assignedDate: new Date(role.properties.createdOn),
        isHighPrivilege: this.isHighPrivilegeRbacRole(role.properties.roleDefinitionName),
        selected: false,
        resourceId: role.properties.scope,
        principalId: role.properties.principalId,
        inherited: false
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

  /**
   * Setup form subscriptions for reactive forms
   */
  private setupFormSubscriptions(): void {
    // Subscribe to filter form changes
    this.filtersForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.applyFilters();
    });

    // Subscribe to add permission form changes
    this.addPermissionForm.get('resourceSearchQuery')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((query) => {
      if (query && query.trim()) {
        this.searchResources();
      }
    });
  }

  applyFilters(): void {
    if (!this.permissions()) return;

    const formValues = this.filtersForm.value;
    const filter: PermissionFilter = {
      searchQuery: formValues.searchTerm?.trim() || undefined,
      permissionType: formValues.selectedPermissionType !== 'all' ? formValues.selectedPermissionType as any : undefined,
      subscriptionId: formValues.selectedSubscription || undefined
    };

    const filteredPermissions = this.permissionsService.filterPermissions(this.permissions()!, filter);
    this.filteredPermissions.set(this.convertToTableFormat(filteredPermissions));
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
    // Reset form controls instead of direct properties
    this.filtersForm.patchValue({
      searchTerm: '',
      selectedPermissionType: 'all',
      selectedSubscription: ''
    });
    this.applyFilters();
  }

  exportPermissions(): void {
    if (!this.permissions() || !this.selectedUser()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'No permissions to export' });
      return;
    }

    try {
      const user = this.selectedUser()!;
      const userId = user.id;
      const displayName = user.displayName;

      if (!userId || !displayName) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'User information is incomplete' });
        return;
      }

      const blob = this.permissionsService.exportPermissions(
        this.permissions()!,
        userId,
        displayName
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${user.displayName}_permissions_${new Date().toISOString().split('T')[0]}.csv`;
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
    this.sortField.set(sort.key);
    this.sortOrder.set(sort.value as 'ascend' | 'descend' | null);

    if (sort.value) {
      const sorted = [...this.filteredPermissions()].sort((a, b) => {
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
      this.filteredPermissions.set(sorted);
    }
  }

  getUserDisplayName(): string {
    return this.selectedUser()?.displayName || 'Current User';
  }

  // Breadcrumb initialization
  private initializeBreadcrumb(): void {
    this.breadcrumbItems.set([
      { label: 'Users', command: () => this.navigateToUsers() },
      { label: this.getUserDisplayName(), command: () => this.navigateToUserDetails() },
      { label: 'Permissions' }
    ]);
  }

  // Navigation Methods
  navigateToUsers(): void {
    this.router.navigate(['/app/user-management']);
  }

  navigateToUserDetails(): void {
    this.router.navigate(['/app/user-detail', this.userId()]);
  }

  // Bulk Selection Methods
  updateSelectionState(): void {
    const selectedCount = this.selectedPermissions().size;
    const totalCount = this.filteredPermissions().length;

    this.selectAll.set(selectedCount === totalCount && totalCount > 0);
    this.indeterminate.set(selectedCount > 0 && selectedCount < totalCount);
  }

  onAllChecked(event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    const currentPermissions = this.filteredPermissions();
    const newSet = new Set(this.selectedPermissions());

    currentPermissions.forEach(permission => {
      permission.selected = isChecked;
      if (isChecked) {
        newSet.add(permission.id);
      } else {
        newSet.delete(permission.id);
      }
    });
    this.selectedPermissions.set(newSet);
    this.updateSelectionState();
  }

  onItemChecked(id: string, event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    const newSet = new Set(this.selectedPermissions());

    if (isChecked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    this.selectedPermissions.set(newSet);
    this.updateSelectionState();
  }

  getSelectedCount(): number {
    return this.selectedPermissions().size;
  }

  // Bulk Operations
  async bulkRemovePermissions(): Promise<void> {
    if (this.selectedPermissions().size === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'No permissions selected for removal'
      });
      return;
    }

    this.bulkOperationLoading.set(true);

    try {
      const selectedIds = Array.from(this.selectedPermissions());
      const permissionsToRemove = this.filteredPermissions().filter(
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
      this.selectedPermissions.set(new Set());
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
      this.bulkOperationLoading.set(false);
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
    this.showAddPermissionModal.set(true);
    this.resetAddPermissionForm();
  }

  closeAddPermissionModal(): void {
    this.showAddPermissionModal.set(false);
    this.resetAddPermissionForm();
  }

  resetAddPermissionForm(): void {
    this.addPermissionForm.reset();
    this.searchedResources.set([]);
    this.selectedResource.set(null);
    this.availableRoles.set([]);
    this.resourceSearchLoading.set(false);
    this.addPermissionLoading.set(false);
  }

  async searchResources(): Promise<void> {
    const query = this.addPermissionForm.get('resourceSearchQuery')?.value;
    if (!query?.trim() || query.trim().length < 2) {
      this.searchedResources.set([]);
      return;
    }

    this.resourceSearchLoading.set(true);
    try {
      const resources = await firstValueFrom(
        this.permissionsService.searchResources(query.trim())
      );
      this.searchedResources.set(resources as AzureResource[]);
    } catch (error) {
      console.error('Error searching resources:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Search Error',
        detail: 'Failed to search Azure resources'
      });
      this.searchedResources.set([]);
    } finally {
      this.resourceSearchLoading.set(false);
    }
  }

  selectResourceItem(resource: AzureResource): void {
    this.selectedResource.set(resource);
    this.selectedRole.set('');
    this.loadAvailableRoles(resource);
  }

  async loadAvailableRoles(resource: AzureResource): Promise<void> {
    this.availableRoles.set([]);

    try {
      const roles = await firstValueFrom(
        this.permissionsService.getRoleDefinitionsForScope(resource.id)
      );
      this.availableRoles.set(roles as RoleDefinition[]);
    } catch (error) {
      console.error('Error loading available roles:', error);
      this.availableRoles.set([]);
    }
  }

  async addPermission(): Promise<void> {
    const selectedRoleValue = this.addPermissionForm.get('selectedRole')?.value;
    const resource = this.selectedResource();

    if (!resource || !selectedRoleValue) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please select both a resource and a role'
      });
      return;
    }

    this.addPermissionLoading.set(true);
    try {
      await firstValueFrom(
        this.permissionsService.assignStorageAccountPermission({
          storageAccountId: resource.id,
          principalId: this.userId(),
          roleDefinitionId: selectedRoleValue,
          principalType: 'User'
        })
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Permission added successfully'
      });

      // Refresh permissions and close modal
      await this.loadUserPermissions();
      this.closeAddPermissionModal();
    } catch (error) {
      console.error('Error adding permission:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to add permission'
      });
    } finally {
      this.addPermissionLoading.set(false);
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
      this.loading.set(true);

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
      this.loading.set(false);
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

  private getScopeDisplayName(scope: string, scopeType?: string): string {
    if (!scope) return 'Unknown';

    // If we have a scopeType, use it
    if (scopeType) {
      return scopeType;
    }

    // Otherwise, determine from the scope path
    const parts = scope.split('/');
    if (parts.includes('subscriptions') && parts.includes('resourceGroups') && parts.length > 6) {
      return 'Resource';
    } else if (parts.includes('subscriptions') && parts.includes('resourceGroups')) {
      return 'Resource Group';
    } else if (parts.includes('subscriptions')) {
      return 'Subscription';
    }
    return 'Management Group';
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

  getTypeTagSeverity(type: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    switch (type?.toLowerCase()) {
      case 'directory':
        return 'danger';
      case 'application':
        return 'success';
      case 'rbac':
        return 'info';
      case 'user':
        return 'info';
      case 'group':
        return 'warn';
      case 'serviceprincipal':
        return 'success';
      default:
        return 'secondary';
    }
  }

  getRoleTagSeverity(roleName: string): 'success' | 'info' | 'warn' | 'danger' {
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

  onSelectAllChange(event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    const currentPermissions = this.filteredPermissions();
    const newSet = new Set(this.selectedPermissions());

    if (isChecked) {
      currentPermissions.forEach(permission => {
        permission.selected = true;
        newSet.add(permission.id);
      });
    } else {
      currentPermissions.forEach(permission => {
        permission.selected = false;
        newSet.delete(permission.id);
      });
    }
    this.selectedPermissions.set(newSet);
    this.updateSelectionState();
  }

  onPermissionSelectionChange(): void {
    // Update selected permissions set based on individual checkbox changes
    const newSet = new Set<string>();
    this.filteredPermissions().forEach(permission => {
      if (permission.selected) {
        newSet.add(permission.id);
      }
    });
    this.selectedPermissions.set(newSet);
    this.updateSelectionState();
  }

  confirmRemoveSelected(): void {
    const count = this.getSelectedCount();
    if (count === 0) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to remove ${count} selected permission${count > 1 ? 's' : ''}?`,
      header: 'Confirm Bulk Permission Removal',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.bulkRemovePermissions();
      }
    });
  }

  clearError(): void {
    this.error.set(null);
  }

  clearSelectedResource(): void {
    this.selectedResource.set(null);
    this.availableRoles.set([]);
    this.selectedRole.set('');
  }

  /**
   * Remove Directory role assignment
   */
  private async removeDirectoryRoleAssignment(permission: PermissionTableItem): Promise<void> {
    if (!this.selectedUser()) {
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
    if (!this.selectedUser()) {
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
    if (!permission.resourceId && !permission.scope) {
      throw new Error('Missing resource information for RBAC role removal');
    }

    // Try to extract subscription ID from multiple sources
    const resourcePath = permission.scope || permission.resourceId || '';
    let subscriptionId = this.extractSubscriptionId(resourcePath);

    // If no subscription ID found in scope/resourceId, try to get from current subscriptions
    if (!subscriptionId && this.subscriptions().length > 0) {
      // Use the first available subscription as fallback
      subscriptionId = this.subscriptions()[0].id;
    }

    if (!subscriptionId) {
      throw new Error('Unable to determine subscription ID for RBAC role removal. Please ensure the resource scope contains a valid subscription ID.');
    }

    if (!this.isValidSubscriptionId(subscriptionId)) {
      throw new Error(`Invalid subscription ID format: ${subscriptionId}`);
    }

    try {
      // For RBAC roles, we need to use the permissions service
      await firstValueFrom(this.permissionsService.removeStorageAccountPermission(
        permission.id,
        permission.resourceId || permission.scope || '',
        subscriptionId
      ));
    } catch (error) {
      console.error('Failed to remove RBAC role assignment:', error);
      throw new Error(`Failed to remove RBAC role assignment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract subscription ID from Azure resource path
   */
  private extractSubscriptionId(resourcePath: string): string | null {
    if (!resourcePath) return null;

    const subscriptionMatch = resourcePath.match(/\/subscriptions\/([a-f0-9-]{36})/i);
    return subscriptionMatch ? subscriptionMatch[1] : null;
  }

  /**
   * Validate Azure subscription ID format
   */
  private isValidSubscriptionId(subscriptionId: string): boolean {
    if (!subscriptionId) return false;

    // Azure subscription ID should be a valid GUID format
    const guidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    return guidRegex.test(subscriptionId);
  }
}
