import {
  Component,
  signal,
  computed,
  inject,
  DestroyRef,
  afterNextRender,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { SubscriptionSelectorComponent } from '../../components/subscription-selector/subscription-selector.component';
import { Observable, throwError, firstValueFrom, forkJoin } from 'rxjs';
import { catchError, of, tap, finalize, takeUntil, timeout, switchMap } from 'rxjs';
import { PermissionsService } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { LockManagementService } from '../../services/lock-management.service';
import { StorageAccount, StorageAccountPermission, StorageAccountRoleAssignment, StorageAccountError } from '../../models/storage-account.model';
import { Subscription } from '../../models/permissions.model';
import { BulkPermissionModalComponent } from '../../components/bulk-permission-modal/bulk-permission-modal.component';
import { BulkRemoveModalComponent } from '../../components/bulk-remove-modal/bulk-remove-modal.component';
import { SkeletonModule } from 'primeng/skeleton';
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
  selected: boolean;
  locks?: any[];
  loadingLocks?: boolean;
  locksLoading?: boolean;
  locksExpanded?: boolean;
  users?: any[];
  accessLevel?: string;
  hasError?: boolean;
  errorMessage?: string;
  hasLocks?: boolean;
  lockCount?: number;
}

@Component({
  selector: 'app-storage-accounts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule,
    SelectModule,
    ProgressSpinnerModule,
    TagModule,
    TooltipModule,
    MessageModule,
    CheckboxModule,
    ToastModule,
    ConfirmDialogModule,
    SubscriptionSelectorComponent,
    BulkPermissionModalComponent,
    BulkRemoveModalComponent,
    SkeletonModule
  ],
  templateUrl: './storage-accounts.component.html',
  styleUrl: './storage-accounts.component.scss'
})
export class StorageAccountsComponent {
  private readonly permissionsService = inject(PermissionsService);
  private readonly authService = inject(AuthService);
  private readonly lockManagementService = inject(LockManagementService);
  private readonly messageService = inject(MessageService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly utilityService = inject(UtilityService);

  private searchTimeout: any;

  // Data signals
  readonly loading = signal(true);
  readonly storageAccounts = signal<StorageAccount[]>([]);
  readonly storageAccountPermissions = signal<StorageAccountPermission[]>([]);
  readonly filteredStorageAccounts = signal<StorageAccountTableItem[]>([]);
  readonly allStorageAccounts = signal<StorageAccountTableItem[]>([]);
  readonly error = signal<string | null>(null);
  readonly selectedSubscription = signal<Subscription | null>(null);

  // Filter signals
  readonly searchQuery = signal('');
  readonly searchTerm = signal('');
  readonly selectedResourceGroup = signal('');
  readonly selectedLocation = signal('');
  readonly selectedAccessLevel = signal('');
  readonly resourceGroups = signal<string[]>([]);
  readonly locations = signal<string[]>([]);
  readonly locationOptions = signal<{ label: string; value: string }[]>([]);
  readonly resourceGroupOptions = signal<{ label: string; value: string }[]>([]);

  // Selection signals
  readonly allSelected = signal(false);
  readonly indeterminate = signal(false);

  // Operation Queue
  private operationQueue: Array<() => Observable<any>> = [];
  private isProcessingQueue = false;

  // Modal state signals
  readonly showBulkPermissionModal = signal(false);
  readonly showBulkRemoveModal = signal(false);
  readonly bulkModalLoading = signal(false);
  readonly roleAssignmentsForRemoval = signal<any[]>([]);
  readonly selectedStorageAccounts = signal<StorageAccountTableItem[]>([]);

  // Table signals
  readonly pageSize = signal(10);
  readonly pageIndex = signal(1);
  readonly sortField = signal<string | null>(null);
  readonly sortOrder = signal<string | null>(null);

  // Table expansion — PrimeNG mutates this object internally via pRowToggler
  expandedRowsObj: { [key: string]: boolean } = {};

  // Permissions loading state (background loading after table appears)
  readonly permissionsLoading = signal(false);

  // Statistics signals
  readonly totalStorageAccounts = signal(0);
  readonly accountsWithPermissions = signal(0);
  readonly totalUsers = signal(0);
  readonly lockedAccounts = signal(0);
  readonly totalUsersWithAccess = signal(0);
  readonly totalRoleAssignments = signal(0);
  readonly highPrivilegeAssignments = signal(0);

  constructor() {
    afterNextRender(() => {
      // Get subscription info from query parameters if available
      this.route.queryParams
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(params => {
          if (params['subscriptionId']) {
            this.selectedSubscription.set({
              subscriptionId: params['subscriptionId'],
              displayName: params['subscriptionName'] || 'Selected Subscription',
              state: 'Enabled'
            });
            this.loadStorageAccounts();
          } else {
            // No subscription in query params — stop loading skeleton
            this.loading.set(false);
          }
        });

      // Subscribe to tenant changes
      this.authService.tenantChanged$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((newTenantId: string) => {
          if (this.selectedSubscription()) {
            this.loadStorageAccounts();
          }
        });
    });
  }

  loadStorageAccounts(): void {
    const subscription = this.selectedSubscription();
    if (!subscription) {
      this.error.set('No subscription selected. Please select a subscription first.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.permissionsLoading.set(true);

    // Step 1: Fetch storage accounts
    this.permissionsService.getStorageAccounts(subscription.subscriptionId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Failed to load storage accounts:', error);
        if (error instanceof StorageAccountError) {
          this.error.set(error.message);
          if (error.code === 'INSUFFICIENT_PERMISSIONS') {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'You do not have sufficient permissions to view storage accounts in this subscription' });
          }
        } else {
          this.error.set('Failed to load storage accounts. Please try again.');
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load storage accounts' });
        }
        return of([]);
      })
    ).subscribe({
      next: (storageAccounts) => {
        this.storageAccounts.set(storageAccounts);

        // Extract unique resource groups and locations for filters
        const rgs = [...new Set(storageAccounts.map(sa => sa.resourceGroup))].sort();
        const locs = [...new Set(storageAccounts.map(sa => sa.location))].sort();
        this.resourceGroups.set(rgs);
        this.locations.set(locs);
        this.locationOptions.set(locs.map(location => ({ label: location, value: location })));
        this.resourceGroupOptions.set(rgs.map(rg => ({ label: rg, value: rg })));

        // Convert to table format (permissions will be populated shortly)
        const tableItems = this.convertToTableFormatBasic(storageAccounts);
        this.allStorageAccounts.set(tableItems);
        this.calculateBasicStatistics();
        this.applyFilters();

        // Table is now visible - hide main loading spinner
        this.loading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Loaded ${storageAccounts.length} storage accounts` });

        // Step 2: Eagerly batch-load ALL permissions using subscription-level API
        // This makes 2 API calls total instead of N*3 per storage account
        if (storageAccounts.length > 0) {
          this.eagerlyLoadAllPermissions(subscription.subscriptionId, storageAccounts, tableItems);
        } else {
          this.permissionsLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Failed to load storage accounts:', error);
        this.error.set('Failed to load storage accounts. Please try again.');
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load storage accounts' });
        this.loading.set(false);
        this.permissionsLoading.set(false);
      }
    });
  }

  /**
   * Eagerly load all permissions for storage accounts using a single subscription-level
   * batch API call. This replaces the lazy per-account loading approach.
   */
  private eagerlyLoadAllPermissions(
    subscriptionId: string,
    storageAccounts: StorageAccount[],
    tableItems: StorageAccountTableItem[]
  ): void {
    const storageAccountIds = storageAccounts.map(sa => sa.id);

    this.permissionsService.batchLoadStorageAccountPermissions(subscriptionId, storageAccountIds)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Failed to batch-load permissions:', error);
          this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Could not load permissions. Expand rows to load individually.' });
          return of(new Map<string, StorageAccountRoleAssignment[]>());
        }),
        finalize(() => {
          this.permissionsLoading.set(false);
        })
      )
      .subscribe({
        next: (permissionsMap) => {
          // Populate each table item with its pre-fetched permissions
          tableItems.forEach(item => {
            const perms = permissionsMap.get(item.id) || [];
            item.permissions = perms;
            item.users = this.extractUsersFromRoleAssignments(perms);
            item.accessLevel = this.calculateAccessLevel(perms);
            item.loadingPermissions = false;
          });

          // Trigger signal update so the UI reflects the new data
          this.allStorageAccounts.set([...tableItems]);
          this.calculateStatistics();
          this.applyFilters();

          const totalPerms = tableItems.reduce((sum, item) => sum + item.permissions.length, 0);
          if (totalPerms > 0) {
            this.messageService.add({ severity: 'info', summary: 'Permissions Loaded', detail: `Found ${totalPerms} role assignments across ${storageAccounts.length} storage accounts` });
          }
        }
      });
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
      permissions: [] as StorageAccountRoleAssignment[],
      users: [] as any[],
      accessLevel: 'Unknown',
      expanded: false,
      loadingPermissions: false,
      selected: false,
      locks: [] as any[],
      loadingLocks: false,
      locksLoading: false,
      hasLocks: false,
      lockCount: 0
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
      this.permissionsService.getStorageAccountLocks(account.id)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
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
            // Trigger OnPush change detection on the bound signal
            this.filteredStorageAccounts.update(items => [...items]);
          },
          error: () => {
            account.locks = [];
            account.lockCount = 0;
            account.hasLocks = false;
            account.loadingLocks = false;
            this.filteredStorageAccounts.update(items => [...items]);
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
    const all = this.allStorageAccounts();
    this.totalStorageAccounts.set(all.length);
    this.accountsWithPermissions.set(all.filter(sa => sa.permissions && sa.permissions.length > 0).length);
    this.totalUsers.set(0);
    this.lockedAccounts.set(all.filter(sa => sa.hasLocks).length);
    this.highPrivilegeAssignments.set(0);
    this.totalUsersWithAccess.set(0);
  }

  private calculateStatistics(): void {
    const all = this.allStorageAccounts();
    this.totalStorageAccounts.set(all.length);
    this.accountsWithPermissions.set(all.filter(sa => sa.permissions && sa.permissions.length > 0).length);
    this.lockedAccounts.set(all.filter(sa => sa.hasLocks).length);

    const allRoleAssignments = all.flatMap(sa => sa.permissions);
    this.totalRoleAssignments.set(allRoleAssignments.length);

    const uniqueUsers = new Set(allRoleAssignments.map(ra => ra.properties.principalId));
    this.totalUsersWithAccess.set(uniqueUsers.size);
    this.totalUsers.set(uniqueUsers.size);

    this.highPrivilegeAssignments.set(allRoleAssignments.filter(ra =>
      this.isHighPrivilegeRole(ra.properties.roleDefinitionName)
    ).length);
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
    let filtered = [...this.allStorageAccounts()];
    const term = this.searchTerm();
    const rg = this.selectedResourceGroup();
    const loc = this.selectedLocation();
    const access = this.selectedAccessLevel();

    // Apply search filter
    if (term.trim()) {
      const query = term.toLowerCase().trim();
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
    if (rg) {
      filtered = filtered.filter(sa => sa.resourceGroup === rg);
    }

    // Apply location filter
    if (loc) {
      filtered = filtered.filter(sa => sa.location === loc);
    }

    // Apply access level filter
    if (access) {
      filtered = filtered.filter(sa =>
        sa.permissions.some(p => p.properties.roleDefinitionName === access)
      );
    }

    this.filteredStorageAccounts.set(filtered);
    // Reset pagination to page 1 when filtering
    this.pageIndex.set(1);
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
    this.searchQuery.set('');
    this.searchTerm.set('');
    this.selectedResourceGroup.set('');
    this.selectedLocation.set('');
    this.selectedAccessLevel.set('');
    this.pageIndex.set(1);
    this.applyFilters();
  }

  onPageIndexChange(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.pageIndex.set(1);
  }

  toggleExpand(item: StorageAccountTableItem): void {
    if (this.expandedRowsObj[item.id]) {
      delete this.expandedRowsObj[item.id];
    } else {
      this.expandedRowsObj[item.id] = true;
      if (!item.permissions || item.permissions.length === 0) {
        this.loadPermissionsForAccount(item);
      }
    }
  }

  onRowExpand(event: any): void {
    const account = event.data as StorageAccountTableItem;
    // Permissions are pre-loaded via batch API. Fall back to per-account only if
    // the batch load failed or hasn't completed yet.
    if ((!account.permissions || account.permissions.length === 0) && !this.permissionsLoading() && !account.loadingPermissions) {
      this.loadPermissionsForAccount(account);
    }
  }

  onRowCollapse(event: any): void {
    // PrimeNG handles expandedRowsObj mutation via two-way binding
  }

  private loadPermissionsForAccount(item: StorageAccountTableItem): void {
    if (!this.selectedSubscription() || item.loadingPermissions) {
      return;
    }

    item.loadingPermissions = true;
    // Notify Angular that the data changed so the loading spinner renders
    this.filteredStorageAccounts.update(items => [...items]);

    // Load permissions for this specific storage account only
    this.permissionsService.getStorageAccountRoleAssignments(item.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error(`Failed to load permissions for storage account ${item.name}:`, error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to load permissions for ${item.name}` });
          return of([]);
        }),
        finalize(() => {
          item.loadingPermissions = false;
          this.filteredStorageAccounts.update(items => [...items]);
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
          this.filteredStorageAccounts.update(items => [...items]);
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
      this.highPrivilegeAssignments.update(v => v + 1);
    }

    // Update total users count
    const uniqueUsers = new Set<string>();
    this.allStorageAccounts().forEach(account => {
      if (account.users && account.users.length > 0) {
        account.users.forEach(user => uniqueUsers.add(user.principalId));
      }
    });
    this.totalUsersWithAccess.set(uniqueUsers.size);
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
    this.selectedSubscription.set(subscription);
    this.error.set(null);

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
    this.storageAccounts.set([]);
    this.allStorageAccounts.set([]);
    this.filteredStorageAccounts.set([]);
    this.storageAccountPermissions.set([]);
    this.resourceGroups.set([]);
    this.locations.set([]);
    this.totalStorageAccounts.set(0);
    this.totalRoleAssignments.set(0);
    this.totalUsersWithAccess.set(0);
    this.highPrivilegeAssignments.set(0);
    this.error.set(null);
  }

  exportStorageAccounts(): void {
    if (!this.allStorageAccounts().length) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'No storage accounts to export' });
      return;
    }

    try {
      const csvData = this.convertToCSV(this.filteredStorageAccounts());
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `storage_accounts_${this.selectedSubscription()?.displayName || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Storage accounts exported successfully' });
    } catch (error) {
      console.error('Export failed:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to export storage accounts' });
    }
  }

  getUsersCountColor(count: number): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    if (count === 0) return 'secondary';
    if (count <= 2) return 'success';
    if (count <= 5) return 'warn';
    return 'danger';
  }

  viewAccountDetails(account: StorageAccountTableItem): void {
    // Expand the row to show permissions and details
    if (!this.expandedRowsObj[account.id]) {
      this.expandedRowsObj[account.id] = true;
      if (!account.permissions || account.permissions.length === 0) {
        this.loadPermissionsForAccount(account);
      }
    }
  }

  managePermissions(account: StorageAccountTableItem): void {
    // Expand the row to show permissions
    if (!this.expandedRowsObj[account.id]) {
      this.expandedRowsObj[account.id] = true;
      if (!account.permissions || account.permissions.length === 0) {
        this.loadPermissionsForAccount(account);
      }
    }
  }

  exportAccountData(account: StorageAccountTableItem): void {
    try {
      const csvContent = this.convertToCSV([account]);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${account.name}_permissions.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.messageService.add({ severity: 'success', summary: 'Success', detail: `Exported data for ${account.name}` });
    } catch (error) {
      console.error('Error exporting account data:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to export account data' });
    }
  }

  // Selection methods
  getSelectedAccountsCount(): number {
    return this.filteredStorageAccounts().filter(account => account.selected).length;
  }

  selectAllAccounts(): void {
    this.filteredStorageAccounts().forEach(account => account.selected = true);
    this.filteredStorageAccounts.update(items => [...items]);
    this.updateSelectionState();
  }

  clearSelection(): void {
    this.filteredStorageAccounts().forEach(account => account.selected = false);
    this.filteredStorageAccounts.update(items => [...items]);
    this.updateSelectionState();
  }

  onAllChecked(event: any): void {
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    this.filteredStorageAccounts().forEach(account => {
      account.selected = isChecked;
    });
    this.filteredStorageAccounts.update(items => [...items]);
    this.updateSelectionState();
  }

  onItemChecked(account: StorageAccountTableItem, event: any): void {
    const isChecked = typeof event === 'boolean' ? event : Boolean(event?.checked);
    account.selected = isChecked;
    this.filteredStorageAccounts.update(items => [...items]);
    this.updateSelectionState();
  }

  private updateSelectionState(): void {
    const selectedCount = this.getSelectedAccountsCount();
    const totalCount = this.filteredStorageAccounts().length;

    this.allSelected.set(selectedCount === totalCount && totalCount > 0);
    this.indeterminate.set(selectedCount > 0 && selectedCount < totalCount);
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
      storageAccount.loadingPermissions = true;

      this.permissionsService.getStorageAccountRoleAssignments(storageAccount.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (permissions) => {
            storageAccount.permissions = permissions;
            storageAccount.loadingPermissions = false;
          },
          error: (error) => {
            console.error('Failed to refresh permissions for account:', storageAccount.name, error);
            storageAccount.loadingPermissions = false;
            this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to refresh permissions for ${storageAccount.name}` });
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
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load storage account locks' });
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

  private processQueue(): void {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const operation = this.operationQueue.shift()!;

    operation().subscribe({
      next: () => {
        this.isProcessingQueue = false;
        setTimeout(() => this.processQueue(), 1000);
      },
      error: (error) => {
        console.error('Operation failed:', error);
        this.isProcessingQueue = false;
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
            `"${permission.properties.createdOn}"` ].join(','));
        });
      }
    });

    return rows.join('\n');
  }

  getRoleColor(roleName: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    if (this.isHighPrivilegeRole(roleName)) {
      return 'danger';
    }
    switch (roleName) {
      case 'Storage Blob Data Reader':
      case 'Storage Queue Data Reader':
        return 'info';
      case 'Storage Blob Data Contributor':
      case 'Storage Queue Data Contributor':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  getPrincipalTypeColor(type: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    switch (type) {
      case 'User': return 'info';
      case 'Group': return 'success';
      case 'ServicePrincipal': return 'warn';
      default: return 'secondary';
    }
  }

  onTableSort(sort: { key: string; value: string | null }): void {
    this.sortField.set(sort.key);
    this.sortOrder.set(sort.value);

    if (sort.value) {
      const sorted = [...this.filteredStorageAccounts()].sort((a, b) => {
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
      this.filteredStorageAccounts.set(sorted);
    }
  }

  getSubscriptionDisplayName(): string {
    return this.selectedSubscription()?.displayName || 'Selected Subscription';
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
    if (this.loading()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please wait for the current operation to complete' });
      return;
    }

    // Validate inputs
    if (!assignment || !assignment.properties) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid permission data' });
      return;
    }

    if (!storageAccount || !storageAccount.id) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid storage account data' });
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
        this.loading.set(true);
        const assignmentId = assignment.id;
        const storageAccountId = storageAccount.id;

        // Add timeout to prevent hanging indefinitely
        const timeoutId = setTimeout(() => {
          console.error('Individual remove operation timed out after 30 seconds');
          this.loading.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Permission removal timed out. Please try again.' });
        }, 30000);

        this.permissionsService.removeStorageAccountPermissionWithLockHandling(
          assignmentId,
          storageAccountId,
          this.selectedSubscription()?.subscriptionId || ''
        ).subscribe({
          next: (result) => {
            clearTimeout(timeoutId);
            this.messageService.add({ severity: 'success', summary: 'Success', detail: `Permission removed successfully for ${principalDisplayName} (locks handled automatically)` });
            // Refresh the expanded account view
            this.refreshExpandedAccount(storageAccount);
            // Refresh locks if they were loaded
            if (storageAccount.locks) {
              this.loadStorageAccountLocks(storageAccount);
            }
            this.loading.set(false);
          },
          error: (error) => {
            console.error('Failed to remove permission for:', principalDisplayName, 'Error:', error);
            clearTimeout(timeoutId);

            // Ensure loading state is reset
            this.loading.set(false);

            // Provide detailed error message
            const errorMessage = error?.error?.message || error?.message || 'Unknown error occurred';
            console.error('Error details:', errorMessage);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to remove permission: ${errorMessage}` });
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
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select at least one storage account' });
      return;
    }

    this.selectedStorageAccounts.set(this.filteredStorageAccounts().filter(account => account.selected));
    this.showBulkPermissionModal.set(true);
  }

  bulkRemovePermissions(): void {
    if (this.getSelectedAccountsCount() === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select at least one storage account' });
      return;
    }

    if (this.loading()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please wait for the current operation to complete' });
      return;
    }

    this.selectedStorageAccounts.set(this.filteredStorageAccounts().filter(account => account.selected));
    this.fetchPermissionsForSelectedAccounts();
  }

  // Handler for bulk permission modal
  onBulkPermissionRequest(request: BulkPermissionRequest): void {
    this.bulkModalLoading.set(true);

    // Create requests for all combinations of accounts, users, and roles
    const requests: any[] = [];
    this.selectedStorageAccounts().forEach(account => {
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
    this.messageService.add({ severity: 'info', summary: 'Loading', detail: `Adding ${totalAssignments} permission assignment(s) to ${this.selectedStorageAccounts().length} storage account(s)...` });

    this.addToQueue(() => {
      return this.permissionsService.bulkAssignStorageAccountPermissions(requests);
    }).then((results) => {
      this.messageService.clear();
      this.bulkModalLoading.set(false);

      const successful = results.filter((result: any) => !result.error).length;
      const failed = results.filter((result: any) => result.error).length;

      if (failed === 0) {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Successfully added ${successful} permission assignment(s)` });
      } else {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Added ${successful} permission assignment(s), ${failed} failed` });
      }

      this.showBulkPermissionModal.set(false);

      // Refresh expanded accounts
      this.selectedStorageAccounts().forEach((account: StorageAccountTableItem) => {
        this.refreshExpandedAccount(account);
      });
    }).catch((error) => {
      this.messageService.clear();
      this.bulkModalLoading.set(false);
      console.error('Failed to add bulk permissions:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add permissions' });
    });
  }

  // Fetch permissions for selected accounts before showing removal modal
  fetchPermissionsForSelectedAccounts(): void {
    this.loading.set(true);
    this.messageService.add({ severity: 'info', summary: 'Loading', detail: 'Fetching permissions for selected storage accounts...' });

    // Add overall timeout for the entire operation
    const overallTimeout = setTimeout(() => {
      console.error('fetchPermissionsForSelectedAccounts timed out after 30 seconds');
      this.messageService.clear();
      this.loading.set(false);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Permission fetching timed out. This may be due to authentication issues. Please try refreshing the page.' });
    }, 30000);

    const permissionPromises = this.selectedStorageAccounts().map(account => {
      // If permissions are already loaded, use them
      if (account.permissions && account.permissions.length > 0) {
        return Promise.resolve(account);
      }

      // Create a promise that ALWAYS resolves, never rejects
      return new Promise<StorageAccountTableItem>((resolve) => {
        // Set up a timeout for this individual request
        const requestTimeout = setTimeout(() => {
          console.error(`Request timeout for ${account.name} after 15 seconds`);
          account.permissions = [];
          account.users = [];
          account.accessLevel = 'None';
          account.hasError = true;
          account.errorMessage = 'Request timed out';
          resolve(account);
        }, 15000);

        // Make the API call
        this.permissionsService.getStorageAccountRoleAssignments(account.id).pipe(
          timeout(14000),
          catchError(error => {
            console.error(`Service error for ${account.name}:`, error);
            return of([]);
          }),
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: (roleAssignments) => {
            clearTimeout(requestTimeout);
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
            console.error(`Observable error for ${account.name}:`, error);
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
    const startTime = Date.now();
    Promise.allSettled(permissionPromises)
      .then((results) => {
        clearTimeout(overallTimeout);

        // Always reset loading state
        this.messageService.clear();
        this.loading.set(false);

        // Count successful and failed requests
        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected').length;

        // Log failed requests for debugging
        const rejectedResults = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[];
        if (failed === 0) {
          // All requests succeeded
        } else if (successful > 0) {
          this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Loaded permissions for ${successful} account(s), ${failed} failed. Showing available permissions.` });
        } else {
          this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Failed to fetch fresh permissions. Showing any available cached permissions.' });
        }

        this.loadRoleAssignmentsForRemoval();
      })
      .catch((error) => {
        console.error('Unexpected error in fetchPermissionsForSelectedAccounts:', error);
        clearTimeout(overallTimeout);
        this.messageService.clear();
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'An unexpected error occurred while fetching permissions. Please try again.' });
      })
      .finally(() => {
        // Extra safety net to ensure loading state is always reset
        if (this.loading()) {
          this.loading.set(false);
        }
      });
  }

  // Load role assignments for removal modal
  loadRoleAssignmentsForRemoval(): void {
    const allPermissions: any[] = [];
    const accountsWithErrors: string[] = [];
    const accountsWithPerms: string[] = [];

    this.selectedStorageAccounts().forEach(account => {
      if (account.hasError) {
        accountsWithErrors.push(account.name);
      } else if (account.permissions && account.permissions.length > 0) {
        accountsWithPerms.push(account.name);
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
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `No permissions available. Failed to load permissions for: ${accountsWithErrors.join(', ')}` });
      } else {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'No permissions found on selected storage accounts' });
      }
      return;
    }

    if (accountsWithErrors.length > 0) {
      this.messageService.add({ severity: 'info', summary: 'Info', detail: `Showing permissions from ${accountsWithPerms.length} account(s). Could not load permissions for: ${accountsWithErrors.join(', ')}` });
    }

    this.roleAssignmentsForRemoval.set(allPermissions);
    this.showBulkRemoveModal.set(true);
  }

  // Handler for bulk remove modal
  onBulkRemoveRequest(request: RemovePermissionRequest): void {
    // Validate request
    if (!request || !request.roleAssignmentIds || request.roleAssignmentIds.length === 0) {
      console.error('Invalid remove request:', request);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid permission removal request' });
      return;
    }

    // Set loading state
    this.bulkModalLoading.set(true);

    const assignments = request.roleAssignmentIds.map(id => {
      const permission = this.roleAssignmentsForRemoval().find(p => p.id === id);
      if (!permission) {
      }
      return {
        assignmentId: id,
        storageAccountId: permission?.accountId,
        subscriptionId: this.selectedSubscription()?.subscriptionId || ''
      };
    });

    this.messageService.add({ severity: 'info', summary: 'Loading', detail: `Removing ${assignments.length} permission(s)...` });

    // Add timeout to prevent hanging indefinitely
    const timeoutId = setTimeout(() => {
      console.error('Bulk remove operation timed out after 60 seconds');
      this.messageService.clear();
      this.bulkModalLoading.set(false);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Permission removal timed out. Please try again.' });
    }, 60000);

    this.addToQueue(() => {
      return this.permissionsService.bulkRemoveStorageAccountPermissions(assignments);
    }).then((results) => {
      clearTimeout(timeoutId);
      this.messageService.clear();
      this.bulkModalLoading.set(false);

      const successful = results.filter((result: any) => !result.error).length;
      const failed = results.filter((result: any) => result.error).length;

      if (failed === 0) {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Successfully removed ${successful} permission(s)` });
      } else {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: `Removed ${successful} permission(s), ${failed} failed` });
        const failedResults = results.filter((result: any) => result.error);
        console.error('Failed operations:', failedResults);
      }

      this.showBulkRemoveModal.set(false);

      // Refresh expanded accounts
      this.selectedStorageAccounts().forEach((account: StorageAccountTableItem) => {
        this.refreshExpandedAccount(account);
      });
    }).catch((error) => {
      console.error('Bulk remove operation failed:', error);
      clearTimeout(timeoutId);

      this.messageService.clear();
      this.bulkModalLoading.set(false);

      const errorMessage = error?.message || error?.error?.message || 'Unknown error occurred';
      console.error('Error details:', errorMessage);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to remove permissions: ${errorMessage}` });
    });
  }

  private showAddPermissionModal(account: any): void {
    this.selectedStorageAccounts.set([account]);
    this.showBulkPermissionModal.set(true);
  }

  onPageChange(event: any): void {
    // Page change handled by PrimeNG table
  }
}
