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
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { SubscriptionSelectorComponent } from '../../components/subscription-selector/subscription-selector.component';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';
import { PermissionsService } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from '../../models/permissions.model';
import { StorageAccountRoleAssignment } from '../../models/storage-account.model';

/** Represents a resource group with its role assignments */
interface ResourceGroupItem {
  name: string;
  id: string;
  location: string;
  subscriptionId: string;
  permissions: StorageAccountRoleAssignment[];
  expanded: boolean;
  selected: boolean;
}

/** Represents subscription-level role assignments */
interface SubscriptionPermissionItem {
  id: string;
  roleName: string;
  principalName: string;
  principalId: string;
  principalType: string;
  principalEmail?: string;
  scope: string;
  createdOn: string;
  selected: boolean;
}

@Component({
  selector: 'app-resource-permissions',
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
    ToastModule,
    ConfirmDialogModule,
    TabsModule,
    SubscriptionSelectorComponent
  ],
  templateUrl: './resource-permissions.component.html',
  styleUrl: './resource-permissions.component.scss'
})
export class ResourcePermissionsComponent {
  private readonly permissionsService = inject(PermissionsService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Data signals
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedSubscription = signal<Subscription | null>(null);
  readonly activeTab = signal<'subscription' | 'resourceGroups'>('subscription');

  // Subscription-level permissions
  readonly subscriptionPermissions = signal<SubscriptionPermissionItem[]>([]);
  readonly filteredSubscriptionPermissions = signal<SubscriptionPermissionItem[]>([]);

  // Resource group data
  readonly resourceGroups = signal<ResourceGroupItem[]>([]);
  readonly filteredResourceGroups = signal<ResourceGroupItem[]>([]);
  expandedRows: { [key: string]: boolean } = {};

  // Filter signals
  readonly searchTerm = signal('');
  readonly selectedRoleFilter = signal('');

  // Statistics
  readonly totalSubscriptionPermissions = signal(0);
  readonly totalResourceGroups = signal(0);
  readonly totalResourceGroupPermissions = signal(0);
  readonly highPrivilegeCount = signal(0);

  // Role filter options for dropdown
  readonly roleFilterOptions = signal<{ label: string; value: string }[]>([]);

  constructor() {
    afterNextRender(() => {
      this.route.queryParams
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(params => {
          if (params['subscriptionId']) {
            this.selectedSubscription.set({
              subscriptionId: params['subscriptionId'],
              displayName: params['subscriptionName'] || 'Selected Subscription',
              state: 'Enabled'
            });
            this.loadData();
          }
        });

      this.authService.tenantChanged$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.selectedSubscription()) {
            this.loadData();
          }
        });
    });
  }

  onSubscriptionSelected(subscription: Subscription | null): void {
    this.selectedSubscription.set(subscription);
    this.error.set(null);

    if (subscription) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          subscriptionId: subscription.subscriptionId,
          subscriptionName: subscription.displayName
        },
        queryParamsHandling: 'merge'
      });
      this.loadData();
    } else {
      this.clearData();
    }
  }

  loadData(): void {
    const subscription = this.selectedSubscription();
    if (!subscription) {
      this.error.set('No subscription selected.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const subscriptionId = subscription.subscriptionId;

    // Fetch subscription-level role assignments and resource groups in parallel
    forkJoin({
      roleAssignments: this.permissionsService.getSubscriptionRoleAssignments(subscriptionId),
      roleDefinitions: this.permissionsService.getSubscriptionRoleDefinitions(subscriptionId),
      resourceGroups: this.loadResourceGroups(subscriptionId)
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Failed to load resource permissions:', error);
        this.error.set('Failed to load permissions. Please try again.');
        return of({ roleAssignments: [], roleDefinitions: new Map(), resourceGroups: [] as any[] });
      }),
      finalize(() => this.loading.set(false))
    ).subscribe(({ roleAssignments, roleDefinitions, resourceGroups }) => {
      // Process subscription-level permissions (only those scoped directly to the subscription)
      const subscriptionScope = `/subscriptions/${subscriptionId}`;
      const subPerms = roleAssignments
        .filter((a: any) => {
          const scope = a.properties?.scope || '';
          // Only include assignments scoped directly at subscription level
          return scope.toLowerCase() === subscriptionScope.toLowerCase();
        })
        .map((a: any) => this.mapToSubscriptionPermission(a, roleDefinitions));

      this.subscriptionPermissions.set(subPerms);
      this.filteredSubscriptionPermissions.set(subPerms);
      this.totalSubscriptionPermissions.set(subPerms.length);

      // Process resource group permissions
      const rgAssignments = roleAssignments.filter((a: any) => {
        const scope = (a.properties?.scope || '').toLowerCase();
        return scope.includes('/resourcegroups/') && !scope.includes('/providers/');
      });

      const rgItems: ResourceGroupItem[] = resourceGroups.map((rg: any) => {
        const rgScope = rg.id.toLowerCase();
        const perms = rgAssignments
          .filter((a: any) => (a.properties?.scope || '').toLowerCase() === rgScope)
          .map((a: any) => this.mapToRoleAssignment(a, roleDefinitions));

        return {
          name: rg.name,
          id: rg.id,
          location: rg.location,
          subscriptionId,
          permissions: perms,
          expanded: false,
          selected: false
        };
      });

      this.resourceGroups.set(rgItems);
      this.filteredResourceGroups.set(rgItems);
      this.totalResourceGroups.set(rgItems.length);
      this.totalResourceGroupPermissions.set(rgItems.reduce((sum, rg) => sum + rg.permissions.length, 0));

      // Calculate high privilege count
      const allPerms = [...subPerms, ...rgAssignments.map((a: any) => this.mapToSubscriptionPermission(a, roleDefinitions))];
      this.highPrivilegeCount.set(allPerms.filter(p => this.isHighPrivilegeRole(p.roleName)).length);

      // Build role filter options
      const roleNames = new Set([
        ...subPerms.map(p => p.roleName),
        ...rgItems.flatMap(rg => rg.permissions.map(p => p.properties.roleDefinitionName))
      ]);
      this.roleFilterOptions.set(
        [...roleNames].sort().map(name => ({ label: name, value: name }))
      );

      this.messageService.add({
        severity: 'success',
        summary: 'Loaded',
        detail: `Found ${subPerms.length} subscription permissions, ${rgItems.length} resource groups`
      });

      // Resolve principal display names in background
      this.resolvePrincipalNames(subPerms, rgItems);
    });
  }

  /** Resolve display names for all unique principal IDs via Graph API */
  private resolvePrincipalNames(subPerms: SubscriptionPermissionItem[], rgItems: ResourceGroupItem[]): void {
    // Collect all unique principal IDs
    const allIds = new Set<string>();
    subPerms.forEach(p => allIds.add(p.principalId));
    rgItems.forEach(rg => rg.permissions.forEach(p => allIds.add(p.properties.principalId)));

    if (allIds.size === 0) return;

    // Resolve each principal (service caches results)
    const requests: Record<string, Observable<any>> = {};
    allIds.forEach(id => {
      if (id) requests[id] = this.permissionsService.resolvePrincipal(id).pipe(take(1), catchError(() => of(null)));
    });

    forkJoin(requests).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((results: Record<string, any>) => {
      // Update subscription permissions with resolved names
      const updatedSub = this.subscriptionPermissions().map(p => {
        const resolved = results[p.principalId];
        if (resolved?.displayName) {
          return { ...p, principalName: resolved.displayName, principalEmail: resolved.mail || resolved.userPrincipalName || '' };
        }
        return p;
      });
      this.subscriptionPermissions.set(updatedSub);
      this.filteredSubscriptionPermissions.set(updatedSub);

      // Update resource group permissions with resolved names
      const updatedRg = this.resourceGroups().map(rg => ({
        ...rg,
        permissions: rg.permissions.map(p => {
          const resolved = results[p.properties.principalId];
          if (resolved?.displayName) {
            return { ...p, properties: { ...p.properties, principalDisplayName: resolved.displayName } };
          }
          return p;
        })
      }));
      this.resourceGroups.set(updatedRg);
      this.filteredResourceGroups.set(updatedRg);

      // Re-apply filters if active
      if (this.searchTerm() || this.selectedRoleFilter()) {
        this.applyFilters();
      }
    });
  }

  private loadResourceGroups(subscriptionId: string) {
    return this.permissionsService.getResourceGroups(subscriptionId).pipe(
      catchError(error => {
        console.error('Failed to load resource groups:', error);
        return of([]);
      })
    );
  }

  private mapToSubscriptionPermission(assignment: any, roleDefinitions: Map<string, any>): SubscriptionPermissionItem {
    const roleDefId = assignment.properties?.roleDefinitionId || '';
    const roleDef = roleDefinitions.get(roleDefId);
    return {
      id: assignment.id,
      roleName: roleDef?.properties?.roleName || 'Unknown Role',
      principalName: `Principal (${(assignment.properties?.principalId || '').substring(0, 8)}...)`,
      principalId: assignment.properties?.principalId || '',
      principalType: assignment.properties?.principalType || 'Unknown',
      scope: assignment.properties?.scope || '',
      createdOn: assignment.properties?.createdOn || '',
      selected: false
    };
  }

  private mapToRoleAssignment(assignment: any, roleDefinitions: Map<string, any>): StorageAccountRoleAssignment {
    const roleDefId = assignment.properties?.roleDefinitionId || '';
    const roleDef = roleDefinitions.get(roleDefId);
    return {
      id: assignment.id,
      name: assignment.name,
      type: assignment.type,
      properties: {
        roleDefinitionId: roleDefId,
        roleDefinitionName: roleDef?.properties?.roleName || 'Unknown Role',
        principalId: assignment.properties?.principalId || '',
        principalType: assignment.properties?.principalType || 'Unknown',
        principalDisplayName: `Principal (${(assignment.properties?.principalId || '').substring(0, 8)}...)`,
        scope: assignment.properties?.scope || '',
        createdOn: assignment.properties?.createdOn || '',
        updatedOn: assignment.properties?.updatedOn || ''
      }
    };
  }

  applyFilters(): void {
    const term = this.searchTerm().toLowerCase().trim();
    const roleFilter = this.selectedRoleFilter();

    // Filter subscription permissions
    let filteredSub = [...this.subscriptionPermissions()];
    if (term) {
      filteredSub = filteredSub.filter(p =>
        p.roleName.toLowerCase().includes(term) ||
        p.principalName.toLowerCase().includes(term) ||
        p.principalType.toLowerCase().includes(term)
      );
    }
    if (roleFilter) {
      filteredSub = filteredSub.filter(p => p.roleName === roleFilter);
    }
    this.filteredSubscriptionPermissions.set(filteredSub);

    // Filter resource groups
    let filteredRg = [...this.resourceGroups()];
    if (term) {
      filteredRg = filteredRg.filter(rg =>
        rg.name.toLowerCase().includes(term) ||
        rg.location.toLowerCase().includes(term) ||
        rg.permissions.some(p =>
          p.properties.roleDefinitionName.toLowerCase().includes(term) ||
          (p.properties.principalDisplayName || '').toLowerCase().includes(term)
        )
      );
    }
    if (roleFilter) {
      filteredRg = filteredRg.filter(rg =>
        rg.permissions.some(p => p.properties.roleDefinitionName === roleFilter)
      );
    }
    this.filteredResourceGroups.set(filteredRg);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedRoleFilter.set('');
    this.filteredSubscriptionPermissions.set(this.subscriptionPermissions());
    this.filteredResourceGroups.set(this.resourceGroups());
  }

  onTabChange(tab: 'subscription' | 'resourceGroups'): void {
    this.activeTab.set(tab);
  }

  onRowExpand(event: any): void {
    // PrimeNG manages expandedRows internally via pRowToggler
  }

  onRowCollapse(event: any): void {
    // PrimeNG manages expandedRows internally via pRowToggler
  }

  refreshData(): void {
    this.permissionsService.clearCache();
    this.loadData();
  }

  getRoleColor(roleName: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    if (this.isHighPrivilegeRole(roleName)) return 'danger';
    if (roleName.includes('Reader')) return 'info';
    if (roleName.includes('Contributor')) return 'warn';
    return 'secondary';
  }

  getPrincipalTypeColor(type: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    switch (type) {
      case 'User': return 'info';
      case 'Group': return 'success';
      case 'ServicePrincipal': return 'warn';
      default: return 'secondary';
    }
  }

  isHighPrivilegeRole(roleName: string): boolean {
    const highPrivilegeRoles = ['Owner', 'Contributor', 'User Access Administrator'];
    return highPrivilegeRoles.includes(roleName);
  }

  exportData(): void {
    const rows = ['Scope,Role,Principal ID,Principal Type,Created On'];

    this.subscriptionPermissions().forEach(p => {
      rows.push(`"Subscription","${p.roleName}","${p.principalId}","${p.principalType}","${p.createdOn}"`);
    });

    this.resourceGroups().forEach(rg => {
      rg.permissions.forEach(p => {
        rows.push(`"${rg.name}","${p.properties.roleDefinitionName}","${p.properties.principalId}","${p.properties.principalType}","${p.properties.createdOn}"`);
      });
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resource_permissions_${this.selectedSubscription()?.displayName || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.messageService.add({ severity: 'success', summary: 'Exported', detail: 'Permissions exported to CSV' });
  }

  private clearData(): void {
    this.subscriptionPermissions.set([]);
    this.filteredSubscriptionPermissions.set([]);
    this.resourceGroups.set([]);
    this.filteredResourceGroups.set([]);
    this.totalSubscriptionPermissions.set(0);
    this.totalResourceGroups.set(0);
    this.totalResourceGroupPermissions.set(0);
    this.highPrivilegeCount.set(0);
  }

  removePermission(permission: SubscriptionPermissionItem): void {
    this.confirmationService.confirm({
      message: `Remove ${permission.roleName} for ${permission.principalName}?`,
      header: 'Remove Permission',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const subscriptionId = this.selectedSubscription()?.subscriptionId || '';
        this.permissionsService.removeStorageAccountPermission(permission.id, permission.scope, subscriptionId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Removed', detail: 'Permission removed successfully' });
              this.loadData();
            },
            error: (error) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to remove permission: ${error.message || 'Unknown error'}` });
            }
          });
      }
    });
  }

  removeResourceGroupPermission(rg: ResourceGroupItem, permission: StorageAccountRoleAssignment): void {
    this.confirmationService.confirm({
      message: `Remove ${permission.properties.roleDefinitionName} for ${permission.properties.principalDisplayName} from ${rg.name}?`,
      header: 'Remove Permission',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const subscriptionId = this.selectedSubscription()?.subscriptionId || '';
        this.permissionsService.removeStorageAccountPermission(permission.id, rg.id, subscriptionId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Removed', detail: 'Permission removed successfully' });
              this.loadData();
            },
            error: (error) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to remove permission: ${error.message || 'Unknown error'}` });
            }
          });
      }
    });
  }
}
