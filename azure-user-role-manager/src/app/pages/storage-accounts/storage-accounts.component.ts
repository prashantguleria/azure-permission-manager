import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { AccordionModule } from 'primeng/accordion';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { MenuModule } from 'primeng/menu';
import { CheckboxModule } from 'primeng/checkbox';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { SubscriptionSelectorComponent } from '../../components/subscription-selector/subscription-selector.component';
import { Subject, takeUntil, finalize, Subscription as RxSubscription, Observable, throwError, combineLatest, firstValueFrom } from 'rxjs';
import { catchError, of, tap, map, timeout } from 'rxjs';
import { PermissionsService } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { LockManagementService } from '../../services/lock-management.service';
import { StorageAccount, StorageAccountPermission, StorageAccountRoleAssignment, StorageAccountError } from '../../models/storage-account.model';
import { Subscription } from '../../models/permissions.model';
import { BulkPermissionModalComponent } from '../../components/bulk-permission-modal/bulk-permission-modal.component';
import { BulkRemoveModalComponent } from '../../components/bulk-remove-modal/bulk-remove-modal.component';
import { SkeletonLoaderComponent } from '../../components/skeleton-loader/skeleton-loader.component';
import { PermissionDetailsComponent } from '../../components/permission-details/permission-details.component';
import { UtilityService } from '../../services/utility.service';

// Interfaces for modal components
interface BulkPermissionRequest {
  principalIds: string[];
  roleDefinitionIds: string[];
  principalType: string;
}

interface RemovePermissionRequest {
  roleAssignmentIds: string[];
}

interface StorageAccountTableItem {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  kind: string;
  sku: string;
  createdTime?: Date;
  permissions: StorageAccountRoleAssignment[];
  expanded?: boolean;
  loadingPermissions?: boolean;
  selected: boolean; // Make required to prevent undefined values
  locks?: any[];
  loadingLocks?: boolean;
  locksLoading?: boolean;
  locksExpanded?: boolean;
  users?: any[];
  accessLevel?: string;
  hasError?: boolean;
  errorMessage?: string;
  hasLocks?: boolean; // Indicates if the storage account has any locks
  lockCount?: number; // Number of locks on this storage account
}

@Component({
  selector: 'app-storage-accounts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule,
    SelectModule,
    CardModule,
    ProgressSpinnerModule,
    TagModule,
    AccordionModule,
    TooltipModule,
    MessageModule,
    DividerModule,
    MenuModule,
    CheckboxModule,
    SkeletonModule,
    ToastModule,
    BreadcrumbModule,
    ConfirmDialogModule,
    SubscriptionSelectorComponent,
    BulkPermissionModalComponent,
    BulkRemoveModalComponent,
    SkeletonLoaderComponent
  ],
  templateUrl: './storage-accounts.component.html',
  styleUrls: ['./storage-accounts.component.css']
})
export class StorageAccountsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private tenantChangeSubscription?: RxSubscription;
  private searchTimeout: any;
  
  // Debouncing for toggle expand to prevent rapid API calls

  
  loading = false;
  storageAccounts: StorageAccount[] = [];
  storageAccountPermissions: StorageAccountPermission[] = [];
  filteredStorageAccounts: StorageAccountTableItem[] = [];
  allStorageAccounts: StorageAccountTableItem[] = [];
  error: string | null = null;
  selectedSubscription: Subscription | null = null;

  // Filter properties
  searchQuery = '';
  searchTerm = '';
  selectedResourceGroup = '';
  selectedLocation = '';
  selectedAccessLevel = '';
  resourceGroups: string[] = [];
  locations: string[] = [];
  locationOptions: {label: string, value: string}[] = [];
  resourceGroupOptions: {label: string, value: string}[] = [];
  
  // Selection
  allSelected: boolean = false;
  indeterminate: boolean = false;
  
  // Operation Queue
  private operationQueue: Array<() => Observable<any>> = [];
  private isProcessingQueue: boolean = false;
  
  // Modal states
  showBulkPermissionModal = false;
  showBulkRemoveModal = false;
  bulkModalLoading = false;
  roleAssignmentsForRemoval: any[] = [];
  selectedStorageAccounts: StorageAccountTableItem[] = [];

  // Table properties
  pageSize = 10;
  pageIndex = 1;
  sortField: string | null = null;
  sortOrder: string | null = null;
  
  // Table expansion
  expandedRows: {[key: string]: boolean} = {};

  // Statistics
  totalStorageAccounts = 0;
  accountsWithPermissions = 0;
  totalUsers = 0;
  lockedAccounts = 0;
  totalUsersWithAccess = 0;
  totalRoleAssignments = 0;
  highPrivilegeAssignments = 0;

  constructor(
    private permissionsService: PermissionsService,
    private authService: AuthService,
    private lockManagementService: LockManagementService,
    private messageService: MessageService,
    private dialogService: DialogService,
    private confirmationService: ConfirmationService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Get subscription info from query parameters if available
    this.route.queryParams.subscribe(params => {
      if (params['subscriptionId']) {
        this.selectedSubscription = {
          subscriptionId: params['subscriptionId'],
          displayName: params['subscriptionName'] || 'Selected Subscription',
          state: 'Enabled'
        };
        this.loadStorageAccounts();
      }
      // If no subscription in query params, the subscription selector will handle it
    });
    
    // Subscribe to tenant changes
    this.tenantChangeSubscription = this.authService.tenantChanged$.subscribe((newTenantId: string) => {
      console.log('Storage accounts: Tenant changed to', newTenantId);
      if (this.selectedSubscription) {
        this.loadStorageAccounts();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Unsubscribe from tenant changes
    if (this.tenantChangeSubscription) {
      this.tenantChangeSubscription.unsubscribe();
    }
  }

  async loadStorageAccounts(): Promise<void> {
    if (!this.selectedSubscription) {
      this.error = 'No subscription selected. Please select a subscription first.';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      // Only load basic storage account information initially for better performance
      this.permissionsService.getStorageAccounts(this.selectedSubscription.subscriptionId).pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Failed to load storage accounts:', error);
          
          if (error instanceof StorageAccountError) {
            this.error = error.message;
            if (error.code === 'INSUFFICIENT_PERMISSIONS') {
              this.messageService.add({severity: 'error', summary: 'Error', detail: 'You do not have sufficient permissions to view storage accounts in this subscription'});
            }
          } else {
            this.error = 'Failed to load storage accounts. Please try again.';
            this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to load storage accounts'});
          }
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: (storageAccounts) => {
          this.storageAccounts = storageAccounts;
          
          // Extract unique resource groups and locations for filters
          this.resourceGroups = [...new Set(storageAccounts.map(sa => sa.resourceGroup))].sort();
          this.locations = [...new Set(storageAccounts.map(sa => sa.location))].sort();
          this.locationOptions = this.locations.map(location => ({label: location, value: location}));
          this.resourceGroupOptions = this.resourceGroups.map(rg => ({label: rg, value: rg}));

          // Convert to table format without permissions (lazy loaded)
          this.allStorageAccounts = this.convertToTableFormatBasic(storageAccounts);
          this.calculateBasicStatistics();
          this.applyFilters();

          this.messageService.add({severity: 'success', summary: 'Success', detail: `Loaded ${storageAccounts.length} storage accounts`});
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to load storage accounts:', error);
          this.error = 'Failed to load storage accounts. Please try again.';
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to load storage accounts'});
        }
      });
    } catch (error) {
      console.error('Failed to load storage accounts:', error);
      this.error = 'Failed to load storage accounts. Please try again.';
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to load storage accounts'});
      this.loading = false;
    }
  }

  private convertToTableFormatBasic(storageAccounts: StorageAccount[]): StorageAccountTableItem[] {
    const tableItems = storageAccounts.map(account => ({
      id: account.id,
      name: account.name,
      resourceGroup: account.resourceGroup,
      location: account.location,
      kind: account.properties?.accountType || 'StorageV2',
      sku: account.properties?.accountType || 'Standard_LRS',
      createdTime: new Date(account.properties?.creationTime || Date.now()),
      permissions: [], // Will be loaded on demand
      users: [], // Will be loaded on demand
      accessLevel: 'Unknown', // Will be calculated when permissions are loaded
      expanded: false,
      loadingPermissions: false,
      selected: false, // Explicitly set as boolean
      locks: [],
      loadingLocks: false,
      locksLoading: false,
      hasLocks: false, // Will be determined after loading locks
      lockCount: 0 // Number of locks on this storage account
    }));

    // Proactively load locks for all storage accounts
    this.loadLocksForAllAccounts(tableItems);
    
    return tableItems;
  }

  /**
   * Load locks for all storage accounts to determine lock status upfront
   */
  private loadLocksForAllAccounts(accounts: StorageAccountTableItem[]): void {
    accounts.forEach(account => {
      account.loadingLocks = true;
      
      this.permissionsService.getStorageAccountLocks(account.id)
        .pipe(
          takeUntil(this.destroy$),
          catchError(error => {
            console.error(`Failed to load locks for storage account ${account.name}:`, error);
            return of([]);
          })
        )
        .subscribe({
          next: (locks) => {
            account.locks = locks || [];
            account.lockCount = locks ? locks.length : 0;
            account.hasLocks = account.lockCount > 0;
            account.loadingLocks = false;
            this.cdr.markForCheck();
          },
          error: (error) => {
            console.error(`Error loading locks for ${account.name}:`, error);
            account.locks = [];
            account.lockCount = 0;
            account.hasLocks = false;
            account.loadingLocks = false;
            this.cdr.markForCheck();
          }
        });
    });
  }

  private convertToTableFormat(
    storageAccounts: StorageAccount[], 
    permissions: StorageAccountPermission[]
  ): StorageAccountTableItem[] {
    return storageAccounts.map(sa => {
      const saPermissions = permissions.find(p => p.storageAccount.id === sa.id);
      return {
        id: sa.id,
        name: sa.name,
        resourceGroup: sa.resourceGroup,
        location: sa.location,
        kind: sa.properties?.accountType || 'StorageV2',
        sku: sa.properties?.accountType || 'Standard_LRS',
        createdTime: new Date(sa.properties?.creationTime || Date.now()),
        permissions: saPermissions?.roleAssignments || [],
        users: saPermissions?.roleAssignments ? this.extractUsersFromRoleAssignments(saPermissions.roleAssignments) : [],
        accessLevel: saPermissions?.roleAssignments ? this.calculateAccessLevel(saPermissions.roleAssignments) : 'No Access',
        expanded: false,
        loadingPermissions: false,
        selected: false,
        locks: [],
        loadingLocks: false,
        locksLoading: false
      };
    });
  }

  private calculateBasicStatistics(): void {
    this.totalStorageAccounts = this.allStorageAccounts.length;
    this.accountsWithPermissions = this.allStorageAccounts.filter(sa => sa.permissions && sa.permissions.length > 0).length;
    this.totalUsers = 0; // Will be calculated as permissions are loaded
    this.lockedAccounts = this.allStorageAccounts.filter(sa => sa.hasLocks).length;
    this.highPrivilegeAssignments = 0; // Will be calculated as permissions are loaded
    this.totalUsersWithAccess = 0; // Will be calculated as permissions are loaded
  }

  private calculateStatistics(): void {
    this.totalStorageAccounts = this.allStorageAccounts.length;
    this.accountsWithPermissions = this.allStorageAccounts.filter(sa => sa.permissions && sa.permissions.length > 0).length;
    this.lockedAccounts = this.allStorageAccounts.filter(sa => sa.hasLocks).length;
    
    const allRoleAssignments = this.allStorageAccounts.flatMap(sa => sa.permissions);
    this.totalRoleAssignments = allRoleAssignments.length;
    
    const uniqueUsers = new Set(allRoleAssignments.map(ra => ra.properties.principalId));
    this.totalUsersWithAccess = uniqueUsers.size;
    this.totalUsers = uniqueUsers.size;
    
    this.highPrivilegeAssignments = allRoleAssignments.filter(ra => 
      this.isHighPrivilegeRole(ra.properties.roleDefinitionName)
    ).length;
  }

  private isHighPrivilegeRole(roleName: string): boolean {
    const highPrivilegeRoles = [
      'Owner',
      'Contributor', 
      'Storage Account Contributor',
      'Storage Account Key Operator Service Role'
    ];
    return highPrivilegeRoles.includes(roleName);
  }

  applyFilters(): void {
    let filtered = [...this.allStorageAccounts];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const query = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(sa => 
        sa.name.toLowerCase().includes(query) ||
        sa.resourceGroup.toLowerCase().includes(query) ||
        sa.location.toLowerCase().includes(query) ||
        sa.permissions.some(p => 
          p.properties.principalDisplayName?.toLowerCase().includes(query) ||
          p.properties.roleDefinitionName.toLowerCase().includes(query)
        )
      );
    }

    // Apply resource group filter
    if (this.selectedResourceGroup) {
      filtered = filtered.filter(sa => sa.resourceGroup === this.selectedResourceGroup);
    }

    // Apply location filter
    if (this.selectedLocation) {
      filtered = filtered.filter(sa => sa.location === this.selectedLocation);
    }

    // Apply access level filter
    if (this.selectedAccessLevel) {
      filtered = filtered.filter(sa => 
        sa.permissions.some(p => p.properties.roleDefinitionName === this.selectedAccessLevel)
      );
    }

    this.filteredStorageAccounts = filtered;
    this.cdr.markForCheck();
  }

  onSearch(): void {
    // Debounce search to avoid excessive filtering
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.applyFilters();
    }, 300);
  }

  onResourceGroupChange(): void {
    this.applyFilters();
  }

  onLocationChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.searchTerm = '';
    this.selectedResourceGroup = '';
    this.selectedLocation = '';
    this.selectedAccessLevel = '';
    this.pageIndex = 1;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex = pageIndex;
    this.cdr.markForCheck();
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize = pageSize;
    this.pageIndex = 1;
    this.cdr.markForCheck();
  }

  toggleExpand(item: StorageAccountTableItem): void {
    // Toggle expansion state in PrimeNG expandedRows object
    if (this.expandedRows[item.id]) {
      delete this.expandedRows[item.id];
      item.expanded = false;
    } else {
      this.expandedRows[item.id] = true;
      item.expanded = true;
      
      // If expanding and permissions haven't been loaded yet, load them
      if (!item.permissions || item.permissions.length === 0) {
        this.loadPermissionsForAccount(item);
      }
    }
    
    this.cdr.markForCheck();
  }

  private loadPermissionsForAccount(item: StorageAccountTableItem): void {
    if (!this.selectedSubscription || item.loadingPermissions) {
      return;
    }

    item.loadingPermissions = true;

    // Load permissions for this specific storage account only
    this.permissionsService.getStorageAccountRoleAssignments(item.id)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error(`Failed to load permissions for storage account ${item.name}:`, error);
          this.messageService.add({severity: 'error', summary: 'Error', detail: `Failed to load permissions for ${item.name}`});
          return of([]);
        }),
        finalize(() => {
          item.loadingPermissions = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (roleAssignments: any[]) => {
          // Update the item with loaded permissions
          item.permissions = roleAssignments || [];
          item.users = this.extractUsersFromRoleAssignments(roleAssignments || []);
          item.accessLevel = this.calculateAccessLevel(roleAssignments || []);
          
          // Update statistics
          this.updateStatisticsForLoadedAccount(item);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error(`Error loading permissions for ${item.name}:`, error);
          item.permissions = [];
          item.users = [];
          item.accessLevel = 'Error';
        }
      });
  }

  private calculateAccessLevel(roleAssignments: StorageAccountRoleAssignment[]): string {
    if (!roleAssignments || roleAssignments.length === 0) {
      return 'No Access';
    }

    const hasHighPrivilege = roleAssignments.some(ra => this.isHighPrivilegeRole(ra.properties.roleDefinitionName));
    return hasHighPrivilege ? 'High' : 'Standard';
  }

  private extractUsersFromRoleAssignments(roleAssignments: StorageAccountRoleAssignment[]): any[] {
    return roleAssignments.map(ra => ({
      principalId: ra.properties.principalId,
      principalType: ra.properties.principalType,
      principalDisplayName: ra.properties.principalDisplayName,
      principalEmail: ra.properties.principalEmail,
      roleDefinitionName: ra.properties.roleDefinitionName
    }));
  }

  private updateStatisticsForLoadedAccount(item: StorageAccountTableItem): void {
    // Update high privilege count
    if (item.accessLevel === 'High') {
      this.highPrivilegeAssignments++;
    }

    // Update total users count
    const uniqueUsers = new Set();
    this.allStorageAccounts.forEach(account => {
      if (account.users && account.users.length > 0) {
        account.users.forEach(user => uniqueUsers.add(user.principalId));
      }
    });
    this.totalUsersWithAccess = uniqueUsers.size;
  }
  


  private loadAccountLocks(account: StorageAccountTableItem): void {
    account.loadingLocks = true;
    
    this.permissionsService.getStorageAccountLocks(account.id).subscribe({
      next: (locks) => {
        account.locks = locks || [];
        account.loadingLocks = false;
      },
      error: (error) => {
        console.error('Failed to load locks for account:', account.name, error);
        account.locks = [];
        account.loadingLocks = false;
      }
    });
  }

  refreshStorageAccounts(): void {
    this.loadStorageAccounts();
  }

  refreshData(): void {
    this.loadStorageAccounts();
  }

  onSubscriptionSelected(subscription: Subscription | null): void {
    this.selectedSubscription = subscription;
    this.error = null;
    
    if (subscription) {
      // Update URL with subscription info
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          subscriptionId: subscription.subscriptionId,
          subscriptionName: subscription.displayName
        },
        queryParamsHandling: 'merge'
      });
      
      // Load storage accounts for the selected subscription
      this.loadStorageAccounts();
    } else {
      // Clear data when no subscription is selected
      this.clearData();
      
      // Remove subscription from URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          subscriptionId: null,
          subscriptionName: null
        },
        queryParamsHandling: 'merge'
      });
    }
  }

  private clearData(): void {
    this.storageAccounts = [];
    this.allStorageAccounts = [];
    this.filteredStorageAccounts = [];
    this.storageAccountPermissions = [];
    this.resourceGroups = [];
    this.locations = [];
    this.totalStorageAccounts = 0;
    this.totalRoleAssignments = 0;
    this.totalUsersWithAccess = 0;
    this.highPrivilegeAssignments = 0;
    this.error = null;
    this.cdr.markForCheck();
  }

  exportStorageAccounts(): void {
    if (!this.allStorageAccounts.length) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'No storage accounts to export'});
      return;
    }

    try {
      const csvData = this.convertToCSV(this.filteredStorageAccounts);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `storage_accounts_${this.selectedSubscription?.displayName || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.messageService.add({severity: 'success', summary: 'Success', detail: 'Storage accounts exported successfully'});
    } catch (error) {
      console.error('Export failed:', error);
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to export storage accounts'});
    }
  }

  getUsersCountColor(count: number): string {
    if (count === 0) return 'secondary';
    if (count <= 2) return 'success';
    if (count <= 5) return 'warning';
    return 'danger';
  }

  viewAccountDetails(account: StorageAccountTableItem): void {
    // Show account details using message service for now
    this.messageService.add({
      severity: 'info',
      summary: `Storage Account: ${account.name}`,
      detail: `Resource Group: ${account.resourceGroup}, Location: ${account.location}, Type: ${account.kind}`,
      life: 5000
    });
  }

  managePermissions(account: StorageAccountTableItem): void {
    // Show permission management info using message service for now
    console.log('Managing permissions for storage account:', account.name);
    
    this.messageService.add({
      severity: 'info',
      summary: `Manage Permissions - ${account.name}`,
      detail: `Current permissions: ${account.permissions?.length || 0} role assignments. Full management functionality coming soon.`,
      life: 5000
    });
  }

  exportAccountData(account: StorageAccountTableItem): void {
    try {
      const accountData = {
        name: account.name,
        resourceGroup: account.resourceGroup,
        location: account.location,
        kind: account.kind,
        sku: account.sku,
        createdTime: account.createdTime,
        permissions: account.permissions || []
      };
      
      const csvContent = this.convertToCSV([account]);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${account.name}_permissions.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      this.messageService.add({severity: 'success', summary: 'Success', detail: `Exported data for ${account.name}`});
    } catch (error) {
      console.error('Error exporting account data:', error);
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to export account data'});
    }
  }

  // Selection methods
  getSelectedAccountsCount(): number {
    return this.filteredStorageAccounts.filter(account => account.selected).length;
  }

  selectAllAccounts(): void {
    this.filteredStorageAccounts.forEach(account => account.selected = true);
    this.updateSelectionState();
  }

  clearSelection(): void {
    this.filteredStorageAccounts.forEach(account => account.selected = false);
    this.updateSelectionState();
  }

  onAllChecked(event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    
    this.filteredStorageAccounts.forEach(account => {
      account.selected = isChecked;
    });
    this.updateSelectionState();
    this.cdr.markForCheck();
  }

  onItemChecked(account: StorageAccountTableItem, event: any): void {
    // Handle PrimeNG checkbox event - ensure we get boolean value to prevent iteration errors
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    
    account.selected = isChecked;
    this.updateSelectionState();
    this.cdr.markForCheck();
  }

  private updateSelectionState(): void {
    const selectedCount = this.getSelectedAccountsCount();
    const totalCount = this.filteredStorageAccounts.length;
    
    // Ensure boolean values to prevent 'this.model is not iterable' errors
    this.allSelected = selectedCount === totalCount && totalCount > 0;
    this.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }
  
  // Operation Queue Management
  private addToQueue(operation: () => Observable<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const wrappedOperation = () => {
        return operation().pipe(
          tap(result => resolve(result)),
          catchError(error => {
            reject(error);
            return throwError(error);
          })
        );
      };
      
      this.operationQueue.push(wrappedOperation);
      this.processQueue();
    });
  }

  /**
   * Refresh expanded account data after permission changes
   */
  private refreshExpandedAccount(storageAccount: any): void {
    if (storageAccount.expanded) {
      // Directly refresh the permissions data without collapsing/expanding
      storageAccount.loadingPermissions = true;
      
      this.permissionsService.getStorageAccountRoleAssignments(storageAccount.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (permissions) => {
            storageAccount.permissions = permissions;
            storageAccount.loadingPermissions = false;
          },
          error: (error) => {
            console.error('Failed to refresh permissions for account:', storageAccount.name, error);
            storageAccount.loadingPermissions = false;
            this.messageService.add({severity: 'error', summary: 'Error', detail: `Failed to refresh permissions for ${storageAccount.name}`});
          }
        });
    }
  }

  /**
   * Load and display locks for a storage account
   */
  loadStorageAccountLocks(storageAccount: any): void {
    if (storageAccount.locksLoading) {
      return;
    }

    storageAccount.locksLoading = true;
    
    this.permissionsService.getStorageAccountLocks(storageAccount.id).subscribe({
      next: (locks) => {
        storageAccount.locks = locks;
        storageAccount.locksLoading = false;
        storageAccount.locksExpanded = true;
      },
      error: (error) => {
        console.error('Failed to load storage account locks:', error);
        storageAccount.locks = [];
        storageAccount.locksLoading = false;
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to load storage account locks'});
      }
    });
  }

  /**
   * Toggle locks display for a storage account
   */
  toggleLocks(storageAccount: any): void {
    // First ensure the row is expanded
    if (!storageAccount.expanded) {
      storageAccount.expanded = true;
      
      // Load permissions if not already loaded
      if ((!storageAccount.permissions || storageAccount.permissions.length === 0) && !storageAccount.loadingPermissions) {
        this.loadPermissionsForAccount(storageAccount);
      }
    }
    
    if (!storageAccount.locks) {
      this.loadStorageAccountLocks(storageAccount);
    } else {
      storageAccount.locksExpanded = !storageAccount.locksExpanded;
    }
  }

  /**
   * Group permissions by role for better organization
   */
  getGroupedPermissions(permissions: any[]): { [role: string]: any[] } {
    if (!permissions || permissions.length === 0) {
      return {};
    }

    return permissions.reduce((groups, permission) => {
      const role = permission.properties.roleDefinitionName || 'Unknown Role';
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(permission);
      return groups;
    }, {} as { [role: string]: any[] });
  }

  /**
   * Get the keys (role names) from grouped permissions
   */
  getGroupedPermissionKeys(permissions: any[]): string[] {
    const grouped = this.getGroupedPermissions(permissions);
    return Object.keys(grouped).sort();
  }

  /**
   * Get permissions for a specific role
   */
  getPermissionsForRole(permissions: any[], role: string): any[] {
    const grouped = this.getGroupedPermissions(permissions);
    return grouped[role] || [];
  }
  
  private processQueue(): void {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    const operation = this.operationQueue.shift()!;
    
    operation().subscribe({
      next: () => {
        this.isProcessingQueue = false;
        // Process next operation after a small delay to avoid conflicts
        setTimeout(() => this.processQueue(), 1000);
      },
      error: (error) => {
        console.error('Operation failed:', error);
        this.isProcessingQueue = false;
        // Continue processing queue even if one operation fails
        setTimeout(() => this.processQueue(), 2000);
      }
    });
  }

  exportData(): void {
    this.exportStorageAccounts();
  }

  private convertToCSV(storageAccounts: StorageAccountTableItem[]): string {
    const headers = [
      'Storage Account Name',
      'Resource Group', 
      'Location',
      'Kind',
      'SKU',
      'Created Time',
      'User/Principal',
      'Role',
      'Assignment Type',
      'Created On'
    ];

    const rows = [headers.join(',')];

    storageAccounts.forEach(sa => {
      if (sa.permissions.length === 0) {
        // Storage account with no permissions
        rows.push([
          `"${sa.name}"`,
          `"${sa.resourceGroup}"`,
          `"${sa.location}"`,
          `"${sa.kind}"`,
              `"${sa.sku}"`,
              sa.createdTime ? `"${sa.createdTime.toISOString()}"` : '""',
          '"No permissions assigned"',
          '""',
          '""',
          '""'
        ].join(','));
      } else {
        // Storage account with permissions
        sa.permissions.forEach(permission => {
          rows.push([
            `"${sa.name}"`,
            `"${sa.resourceGroup}"`,
            `"${sa.location}"`,
            `"${sa.kind}"`,
            `"${sa.sku}"`,
            sa.createdTime ? `"${sa.createdTime.toISOString()}"` : '""',
            `"${permission.properties.principalDisplayName || permission.properties.principalId}"`,
            `"${permission.properties.roleDefinitionName}"`,
            `"${permission.properties.scope}"`,
            `"${permission.properties.principalType}"`,
            `"${permission.properties.createdOn}"`    ].join(','));
        });
      }
    });

    return rows.join('\n');
  }

  getRoleColor(roleName: string): string {
    if (this.isHighPrivilegeRole(roleName)) {
      return 'danger';
    }
    switch (roleName) {
      case 'Storage Blob Data Reader':
      case 'Storage Queue Data Reader':
        return 'info';
      case 'Storage Blob Data Contributor':
      case 'Storage Queue Data Contributor':
        return 'warning';
      default:
        return 'secondary';
    }
  }

  getPrincipalTypeColor(type: string): string {
    switch (type) {
      case 'User': return 'info';
      case 'Group': return 'success';
      case 'ServicePrincipal': return 'warning';
      default: return 'secondary';
    }
  }

  onTableSort(sort: { key: string; value: string | null }): void {
    this.sortField = sort.key;
    this.sortOrder = sort.value;
    
    if (sort.value) {
      this.filteredStorageAccounts = [...this.filteredStorageAccounts].sort((a, b) => {
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

  getSubscriptionDisplayName(): string {
    return this.selectedSubscription?.displayName || 'Selected Subscription';
  }

  viewPermissionDetails(permission: any): void {
    const ref = this.dialogService.open(PermissionDetailsComponent, {
      header: 'Permission Details',
      width: '600px',
      data: {
        permission: permission
      }
    });
  }

  removePermission(storageAccount: any, assignment: any): void {
    if (this.loading) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Please wait for the current operation to complete'});
      return;
    }

    // Validate inputs
    if (!assignment || !assignment.properties) {
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Invalid permission data'});
      return;
    }

    if (!storageAccount || !storageAccount.id) {
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Invalid storage account data'});
      return;
    }

    const roleDefinitionName = assignment.properties.roleDefinitionName || 'Unknown Role';
    const principalDisplayName = assignment.properties.principalDisplayName || assignment.properties.principalId || 'this principal';

    this.confirmationService.confirm({
      message: `Are you sure you want to remove ${roleDefinitionName} access for ${principalDisplayName}?`,
      header: 'Remove Permission',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        console.log('🗑️ Starting individual permission removal for:', principalDisplayName);
        this.loading = true;
        const assignmentId = assignment.id;
        const storageAccountId = storageAccount.id;
        
        console.log('🗑️ Assignment ID:', assignmentId, 'Storage Account ID:', storageAccountId);
        
        // Add timeout to prevent hanging indefinitely
        const timeoutId = setTimeout(() => {
          console.error('⏰ Individual remove operation timed out after 30 seconds');
          this.loading = false;
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Permission removal timed out. Please try again.'});
        }, 30000); // 30 second timeout for individual operations

        this.permissionsService.removeStorageAccountPermissionWithLockHandling(
          assignmentId,
          storageAccountId
        ).subscribe({
          next: (result) => {
            console.log('✅ Permission removed successfully for:', principalDisplayName);
            clearTimeout(timeoutId);
            this.messageService.add({severity: 'success', summary: 'Success', detail: `Permission removed successfully for ${principalDisplayName} (locks handled automatically)`});
            // Refresh the expanded account view
            this.refreshExpandedAccount(storageAccount);
            // Refresh locks if they were loaded
            if (storageAccount.locks) {
              this.loadStorageAccountLocks(storageAccount);
            }
            this.loading = false;
            console.log('🗑️ Individual permission removal completed successfully');
          },
          error: (error) => {
            console.error('❌ Failed to remove permission for:', principalDisplayName, 'Error:', error);
            clearTimeout(timeoutId);
            
            // Ensure loading state is reset
            this.loading = false;
            
            // Provide detailed error message
            const errorMessage = error?.error?.message || error?.message || 'Unknown error occurred';
            console.error('🗑️ Error details:', errorMessage);
            this.messageService.add({severity: 'error', summary: 'Error', detail: `Failed to remove permission: ${errorMessage}`});
          }
        });
      }
    });
  }

  addPermission(account: any): void {
    this.showAddPermissionModal(account);
  }

  bulkAddPermissions(): void {
    if (this.getSelectedAccountsCount() === 0) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Please select at least one storage account'});
      return;
    }
    
    this.selectedStorageAccounts = this.filteredStorageAccounts.filter(account => account.selected);
    this.showBulkPermissionModal = true;
  }

  bulkRemovePermissions(): void {
    if (this.getSelectedAccountsCount() === 0) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Please select at least one storage account'});
      return;
    }
    
    if (this.loading) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Please wait for the current operation to complete'});
      return;
    }
    
    this.selectedStorageAccounts = this.filteredStorageAccounts.filter(account => account.selected);
    this.fetchPermissionsForSelectedAccounts();
  }

  // Handler for bulk permission modal
  onBulkPermissionRequest(request: BulkPermissionRequest): void {
    this.bulkModalLoading = true;
    
    // Create requests for all combinations of accounts, users, and roles
    const requests: any[] = [];
    this.selectedStorageAccounts.forEach(account => {
      request.principalIds.forEach(principalId => {
        request.roleDefinitionIds.forEach(roleDefinitionId => {
          requests.push({
            storageAccountId: account.id,
            principalId: principalId,
            roleDefinitionId: roleDefinitionId,
            principalType: request.principalType
          });
        });
      });
    });
    
    const totalAssignments = requests.length;
    this.messageService.add({severity: 'info', summary: 'Loading', detail: `Adding ${totalAssignments} permission assignment(s) to ${this.selectedStorageAccounts.length} storage account(s)...`});
    
    this.addToQueue(() => {
      return this.permissionsService.bulkAssignStorageAccountPermissions(requests);
    }).then((results) => {
      this.messageService.clear();
      this.bulkModalLoading = false;
      
      const successful = results.filter((result: any) => !result.error).length;
      const failed = results.filter((result: any) => result.error).length;
      
      if (failed === 0) {
        this.messageService.add({severity: 'success', summary: 'Success', detail: `Successfully added ${successful} permission assignment(s)`});
      } else {
        this.messageService.add({severity: 'warn', summary: 'Warning', detail: `Added ${successful} permission assignment(s), ${failed} failed`});
      }
      
      this.showBulkPermissionModal = false;
      
      // Refresh expanded accounts
      this.selectedStorageAccounts.forEach((account: StorageAccountTableItem) => {
        this.refreshExpandedAccount(account);
      });
    }).catch((error) => {
      this.messageService.clear();
      this.bulkModalLoading = false;
      console.error('Failed to add bulk permissions:', error);
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to add permissions'});
    });
  }
  
  // Fetch permissions for selected accounts before showing removal modal
  fetchPermissionsForSelectedAccounts(): void {
    console.log('🔍 Starting fetchPermissionsForSelectedAccounts for', this.selectedStorageAccounts.length, 'accounts');
    console.log('🔍 Selected accounts:', this.selectedStorageAccounts.map(a => ({ name: a.name, id: a.id })));
    this.loading = true;
    this.messageService.add({severity: 'info', summary: 'Loading', detail: 'Fetching permissions for selected storage accounts...'});
    console.log('🔍 Loading message created, proceeding with permission fetching...');
    
    // Add overall timeout for the entire operation
    const overallTimeout = setTimeout(() => {
      console.error('⏰ fetchPermissionsForSelectedAccounts timed out after 30 seconds');
      this.messageService.clear();
      this.loading = false;
      this.cdr.markForCheck();
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Permission fetching timed out. This may be due to authentication issues. Please try refreshing the page.'});
    }, 30000);
    
    const permissionPromises = this.selectedStorageAccounts.map(account => {
      console.log('📋 Processing account:', account.name, 'ID:', account.id);
      // If permissions are already loaded, use them
      if (account.permissions && account.permissions.length > 0) {
        console.log('✅ Using cached permissions for:', account.name);
        return Promise.resolve(account);
      }
      
      // Create a promise that ALWAYS resolves, never rejects
      return new Promise<StorageAccountTableItem>((resolve) => {
        console.log('🔄 Fetching permissions for:', account.name);
        
        // Set up a timeout for this individual request
        const requestTimeout = setTimeout(() => {
          console.error(`⏰ Request timeout for ${account.name} after 15 seconds`);
          account.permissions = [];
          account.users = [];
          account.accessLevel = 'None';
          account.hasError = true;
          account.errorMessage = 'Request timed out';
          resolve(account);
        }, 15000);
        
        // Make the API call
        this.permissionsService.getStorageAccountRoleAssignments(account.id).pipe(
          timeout(14000), // Slightly less than the manual timeout
          catchError(error => {
            console.error(`❌ Service error for ${account.name}:`, error);
            // Always return empty array on any error
            return of([]);
          }),
          takeUntil(this.destroy$)
        ).subscribe({
          next: (roleAssignments) => {
            clearTimeout(requestTimeout);
            console.log('✅ Successfully fetched permissions for:', account.name, 'Count:', roleAssignments?.length || 0);
            const permissions = roleAssignments || [];
            account.permissions = permissions;
            account.users = this.extractUsersFromRoleAssignments(permissions);
            account.accessLevel = this.calculateAccessLevel(permissions);
            account.hasError = false;
            account.errorMessage = undefined;
            resolve(account);
          },
          error: (error) => {
            clearTimeout(requestTimeout);
            console.error(`❌ Observable error for ${account.name}:`, error);
            account.permissions = [];
            account.users = [];
            account.accessLevel = 'None';
            account.hasError = true;
            account.errorMessage = `Failed to load permissions: ${error.message || 'Unknown error'}`;
            resolve(account);
          }
        });
      });
    });
    
    // Use Promise.allSettled to handle partial failures gracefully
    console.log('⏳ Waiting for', permissionPromises.length, 'permission requests...');
    console.log('⏳ About to call Promise.allSettled...');
    
    const startTime = Date.now();
    Promise.allSettled(permissionPromises)
      .then((results) => {
        // Clear the overall timeout since we got results
        clearTimeout(overallTimeout);
        
        const endTime = Date.now();
        console.log('🎯 Promise.allSettled resolved with', results.length, 'results in', endTime - startTime, 'ms');
        console.log('🎯 About to remove loading message and reset loading state...');
        
        // Always reset loading state in a finally-like manner
        this.messageService.clear();
        this.loading = false;
        this.cdr.markForCheck();
        console.log('🎯 Loading state reset, processing results...');
        
        // Count successful and failed requests
        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected').length;
        console.log('📊 Results: successful =', successful, ', failed =', failed);
        
        // Log failed requests for debugging (should be rare with our new approach)
        const rejectedResults = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[];
        if (rejectedResults.length > 0) {
          console.warn('Some permission requests failed:', rejectedResults.map(r => r.reason));
        }
        
        // Always try to show the modal with whatever data we have
        console.log('🎯 Calling loadRoleAssignmentsForRemoval with available data...');
        
        if (failed === 0) {
          console.log('🎯 All requests succeeded');
        } else if (successful > 0) {
          console.log('🎯 Partial success, showing available permissions');
          this.messageService.add({severity: 'warn', summary: 'Warning', detail: `Loaded permissions for ${successful} account(s), ${failed} failed. Showing available permissions.`});
        } else {
          console.log('🎯 All requests failed, checking for any available permissions');
          this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Failed to fetch fresh permissions. Showing any available cached permissions.'});
        }
        
        this.loadRoleAssignmentsForRemoval();
        console.log('🎯 fetchPermissionsForSelectedAccounts completed');
      })
      .catch((error) => {
        // This should never happen with Promise.allSettled, but keeping as fallback
        console.error('❌ Unexpected error in fetchPermissionsForSelectedAccounts:', error);
        clearTimeout(overallTimeout);
        this.messageService.clear();
        this.loading = false;
        this.cdr.markForCheck();
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'An unexpected error occurred while fetching permissions. Please try again.'});
      })
      .finally(() => {
        // Extra safety net to ensure loading state is always reset
        if (this.loading) {
          console.log('🔧 Final safety: resetting loading state');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  // Load role assignments for removal modal
  loadRoleAssignmentsForRemoval(): void {
    console.log('📋 Starting loadRoleAssignmentsForRemoval...');
    const allPermissions: any[] = [];
    const accountsWithErrors: string[] = [];
    const accountsWithPermissions: string[] = [];
    console.log('📋 Processing', this.selectedStorageAccounts.length, 'selected accounts...');
    
    this.selectedStorageAccounts.forEach(account => {
      if (account.hasError) {
        // Track accounts that failed to load permissions
        accountsWithErrors.push(account.name);
      } else if (account.permissions && account.permissions.length > 0) {
        // Process accounts with successfully loaded permissions
        accountsWithPermissions.push(account.name);
        account.permissions.forEach((permission: any) => {
          allPermissions.push({
            ...permission,
            accountName: account.name,
            accountId: account.id,
            roleDefinitionName: permission.properties.roleDefinitionName,
            principalName: permission.properties.principalDisplayName || permission.properties.principalId,
            principalId: permission.properties.principalId,
            principalType: permission.properties.principalType,
            scope: permission.properties.scope
          });
        });
      }
    });
    
    // Provide detailed feedback about the loading results
    if (allPermissions.length === 0) {
      if (accountsWithErrors.length > 0) {
        this.messageService.add({severity: 'warn', summary: 'Warning', detail: `No permissions available. Failed to load permissions for: ${accountsWithErrors.join(', ')}`});
      } else {
        this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'No permissions found on selected storage accounts'});
      }
      return;
    }
    
    // Show informational message if some accounts had errors but we still have permissions to show
    if (accountsWithErrors.length > 0) {
      this.messageService.add({severity: 'info', summary: 'Info', detail: `Showing permissions from ${accountsWithPermissions.length} account(s). Could not load permissions for: ${accountsWithErrors.join(', ')}`});
    }
    
    console.log('📋 Setting roleAssignmentsForRemoval with', allPermissions.length, 'permissions');
    this.roleAssignmentsForRemoval = allPermissions;
    console.log('📋 About to show bulk remove modal...');
    this.showBulkRemoveModal = true;
    console.log('📋 Bulk remove modal should now be visible');
    console.log('📋 loadRoleAssignmentsForRemoval completed successfully');
  }
  
  // Handler for bulk remove modal
  onBulkRemoveRequest(request: RemovePermissionRequest): void {
    console.log('🗑️ Starting bulk remove request for', request.roleAssignmentIds.length, 'permissions');
    
    // Validate request
    if (!request || !request.roleAssignmentIds || request.roleAssignmentIds.length === 0) {
      console.error('❌ Invalid remove request:', request);
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Invalid permission removal request'});
      return;
    }
    
    // Set loading state
    this.bulkModalLoading = true;
    console.log('🗑️ Bulk modal loading state set to true');
    
    const assignments = request.roleAssignmentIds.map(id => {
      const permission = this.roleAssignmentsForRemoval.find(p => p.id === id);
      if (!permission) {
        console.warn('⚠️ Permission not found for ID:', id);
      }
      return {
        assignmentId: id,
        storageAccountId: permission?.accountId
      };
    });
    
    console.log('🗑️ Mapped assignments:', assignments.length);
    this.messageService.add({severity: 'info', summary: 'Loading', detail: `Removing ${assignments.length} permission(s)...`});
    
    // Add timeout to prevent hanging indefinitely
    const timeoutId = setTimeout(() => {
      console.error('⏰ Bulk remove operation timed out after 60 seconds');
      this.messageService.clear();
      this.bulkModalLoading = false;
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Permission removal timed out. Please try again.'});
    }, 60000); // 60 second timeout
    
    this.addToQueue(() => {
      console.log('🗑️ Adding bulk remove operation to queue...');
      return this.permissionsService.bulkRemoveStorageAccountPermissions(assignments);
    }).then((results) => {
      console.log('🗑️ Bulk remove operation completed with results:', results);
      clearTimeout(timeoutId);
      this.messageService.clear();
      this.bulkModalLoading = false;
      console.log('🗑️ Loading states reset after successful completion');
      
      const successful = results.filter((result: any) => !result.error).length;
      const failed = results.filter((result: any) => result.error).length;
      console.log('🗑️ Results summary: successful =', successful, ', failed =', failed);
      
      if (failed === 0) {
        this.messageService.add({severity: 'success', summary: 'Success', detail: `Successfully removed ${successful} permission(s)`});
      } else {
        this.messageService.add({severity: 'warn', summary: 'Warning', detail: `Removed ${successful} permission(s), ${failed} failed`});
        // Log failed operations for debugging
        const failedResults = results.filter((result: any) => result.error);
        console.error('🗑️ Failed operations:', failedResults);
      }
      
      this.showBulkRemoveModal = false;
      console.log('🗑️ Bulk remove modal closed');
      
      // Refresh expanded accounts
      console.log('🗑️ Refreshing expanded accounts...');
      this.selectedStorageAccounts.forEach((account: StorageAccountTableItem) => {
        this.refreshExpandedAccount(account);
      });
      console.log('🗑️ Bulk remove request completed successfully');
    }).catch((error) => {
      console.error('❌ Bulk remove operation failed:', error);
      clearTimeout(timeoutId);
      
      // Ensure loading states are reset even on error
      this.messageService.clear();
      this.bulkModalLoading = false;
      console.log('🗑️ Loading states reset after error');
      
      // Provide detailed error message
      const errorMessage = error?.message || error?.error?.message || 'Unknown error occurred';
      console.error('🗑️ Error details:', errorMessage);
      this.messageService.add({severity: 'error', summary: 'Error', detail: `Failed to remove permissions: ${errorMessage}`});
      
      // Don't close modal on error so user can retry
      console.log('🗑️ Keeping modal open for retry after error');
    });
  }

  private showAddPermissionModal(account: any): void {
    // Set up single account permission modal
    this.selectedStorageAccounts = [account];
    this.showBulkPermissionModal = true;
  }

  onPageChange(event: any): void {
    // Handle pagination change event
    console.log('Page change event:', event);
    // Add any additional logic needed for pagination
  }

}