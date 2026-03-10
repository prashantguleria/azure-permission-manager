import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, forkJoin, of, BehaviorSubject, combineLatest, Subject, from, timer, firstValueFrom } from 'rxjs';
import { catchError, map, switchMap, tap, shareReplay, finalize, concatMap, scan, takeLast, share, timeout } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { AzureApiService } from './azure-api.service';
import { LockManagementService } from './lock-management.service';
import { AppAuditService } from './app-audit.service';
import {
  UserPermissions,
  DirectoryRole,
  AppRoleAssignment,
  AzureRoleAssignment,
  Subscription,
  RoleDefinition,
  PermissionSummary,
  PermissionFilter,
  PermissionError,
  RecentAssignment
} from '../models/permissions.model';
import {
  StorageAccount,
  StorageAccountPermission,
  StorageAccountRoleAssignment,
  StorageAccountFilter,
  StorageAccountSummary,
  StorageAccountError
} from '../models/storage-account.model';

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly graphApiUrl = 'https://graph.microsoft.com/v1.0';
  private readonly managementApiUrl = 'https://management.azure.com';
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Queue system for handling conflicts
  private operationQueue: Array<{ operation: () => Observable<any>; resolve: (value: any) => void; reject: (error: any) => void }> = [];
  private isProcessingQueue = false;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds
  
  // Request deduplication for principal lookups
  private pendingPrincipalRequests = new Map<string, Observable<any>>();
  
  // Request deduplication for storage account role assignments
  private pendingStorageAccountRequests = new Map<string, Observable<StorageAccountRoleAssignment[]>>();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private azureApiService: AzureApiService,
    private lockManagementService: LockManagementService,
    private appAuditService: AppAuditService
  ) {}

  /**
   * Get comprehensive permissions for a user
   */
  async getUserPermissions(userId?: string): Promise<UserPermissions> {
    const cacheKey = `permissions_${userId || 'me'}`;
    const cached = this.getFromCache<UserPermissions>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const [directoryRoles, appRoles, rbacData] = await Promise.all([
        this.getDirectoryRoles(userId).toPromise(),
        this.getAppRoleAssignments(userId).toPromise(),
        this.getRBACPermissions(userId).toPromise()
      ]);

      const permissions: UserPermissions = {
        directoryRoles: directoryRoles || [],
        appRoles: appRoles || [],
        rbacRoles: rbacData?.roleAssignments || [],
        subscriptions: rbacData?.subscriptions || []
      };

      this.setCache(cacheKey, permissions);
      return permissions;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get directory roles for a user.
   * Uses both memberOf (for home-tenant users) and roleManagement/directory/roleAssignments
   * (for guest/external users) to ensure complete results.
   */
  getDirectoryRoles(userId?: string): Observable<DirectoryRole[]> {
    return this.getGraphHeaders().pipe(
      switchMap(headers => {
        const memberOfEndpoint = userId ? `/users/${userId}/memberOf` : '/me/memberOf';

        const memberOf$ = this.http.get<any>(`${this.graphApiUrl}${memberOfEndpoint}`, { headers }).pipe(
          map(response =>
            response.value
              .filter((item: any) => item['@odata.type'] === '#microsoft.graph.directoryRole' || item.roleTemplateId)
              .map((role: any) => ({
                id: role.id,
                displayName: role.displayName,
                description: role.description,
                roleTemplateId: role.roleTemplateId,
                isBuiltIn: true
              }))
          ),
          catchError(error => {
            console.error('Failed to get directory roles via memberOf:', error);
            return of([] as DirectoryRole[]);
          })
        );

        // For a specific user, also check roleManagement/directory/roleAssignments
        // This catches roles for guest/external users in the current tenant
        if (userId) {
          const roleAssignments$ = this.http.get<any>(
            `${this.graphApiUrl}/roleManagement/directory/roleAssignments`,
            {
              headers,
              params: new HttpParams()
                .set('$filter', `principalId eq '${userId}'`)
                .set('$expand', 'roleDefinition')
            }
          ).pipe(
            map(response =>
              (response.value || []).map((assignment: any) => ({
                id: assignment.roleDefinition?.id || assignment.roleDefinitionId,
                displayName: assignment.roleDefinition?.displayName || 'Unknown Role',
                description: assignment.roleDefinition?.description || '',
                roleTemplateId: assignment.roleDefinition?.templateId || assignment.roleDefinitionId,
                isBuiltIn: assignment.roleDefinition?.isBuiltIn ?? true
              }))
            ),
            catchError(error => {
              console.error('Failed to get directory role assignments:', error);
              return of([] as DirectoryRole[]);
            })
          );

          // Merge both sources, deduplicate by roleTemplateId
          return forkJoin([memberOf$, roleAssignments$]).pipe(
            map(([fromMemberOf, fromRoleAssignments]) => {
              const seen = new Set<string>();
              const merged: DirectoryRole[] = [];
              for (const role of [...fromMemberOf, ...fromRoleAssignments]) {
                const key = role.roleTemplateId || role.id;
                if (!seen.has(key)) {
                  seen.add(key);
                  merged.push(role);
                }
              }
              return merged;
            })
          );
        }

        return memberOf$;
      }),
      catchError(error => {
        console.error('Failed to get directory roles:', error);
        return of([] as DirectoryRole[]);
      })
    );
  }

  /**
   * Get application role assignments for a user
   */
  getAppRoleAssignments(userId?: string): Observable<AppRoleAssignment[]> {
    const endpoint = userId ? `/users/${userId}/appRoleAssignments` : '/me/appRoleAssignments';
    
    return this.getGraphHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}${endpoint}`, {
          headers,
          params: new HttpParams()
            .set('$select', 'id,appRoleId,principalId,principalType,resourceId,resourceDisplayName,createdDateTime')
        })
      ),
      switchMap(response => {
        const assignments = response.value || [];

        if (assignments.length === 0) {
          return of([]);
        }

        // Enrich with app role details
        const enrichmentPromises = assignments.map((assignment: any) =>
          this.enrichAppRoleAssignment(assignment)
        );

        return forkJoin(enrichmentPromises).pipe(
          catchError(() => of(assignments)) // Fallback to basic data if enrichment fails
        );
      }),
      catchError(error => {
        console.error('Failed to get app role assignments:', error);
        return of([] as AppRoleAssignment[]);
      })
    );
  }

  /**
   * Get RBAC permissions and subscriptions for a user
   */
  getRBACPermissions(userId?: string): Observable<{roleAssignments: AzureRoleAssignment[], subscriptions: Subscription[]}> {
    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        // First get subscriptions
        return this.http.get<any>(`${this.managementApiUrl}/subscriptions?api-version=2022-12-01`, { headers })
          .pipe(
            switchMap(subscriptionsResponse => {
              const subscriptions: Subscription[] = subscriptionsResponse.value.map((sub: any) => ({
                subscriptionId: sub.subscriptionId,
                displayName: sub.displayName,
                state: sub.state,
                tenantId: sub.tenantId
              }));

              if (subscriptions.length === 0) {
                return of({ roleAssignments: [], subscriptions: [] });
              }

              // Get user object ID if not provided
              const userIdPromise = userId ? of(userId) : this.getCurrentUserObjectId();
              
              return userIdPromise.pipe(
                switchMap(objectId => {
                  // Get role assignments for each subscription
                  const roleAssignmentPromises = subscriptions.map(sub => 
                    this.getRoleAssignmentsForSubscription(sub.subscriptionId, objectId, headers)
                  );
                  
                  return forkJoin(roleAssignmentPromises).pipe(
                    map(allAssignments => ({
                      roleAssignments: allAssignments.flat(),
                      subscriptions
                    }))
                  );
                })
              );
            })
          );
      }),
      catchError(error => {
        console.error('Failed to get RBAC permissions:', error);
        return of({ roleAssignments: [], subscriptions: [] });
      })
    );
  }

  /**
   * Get role assignments for a specific subscription
   */
  private getRoleAssignmentsForSubscription(
    subscriptionId: string, 
    objectId: string, 
    headers: HttpHeaders
  ): Observable<AzureRoleAssignment[]> {
    const url = `${this.managementApiUrl}/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleAssignments`;
    const params = new HttpParams()
      .set('api-version', '2022-04-01')
      .set('$filter', `assignedTo('${objectId}')`);
    
    return this.http.get<{value: AzureRoleAssignment[]}>(url, { headers, params })
      .pipe(
        switchMap(response => {
          const assignments = response.value || [];

          if (assignments.length === 0) {
            return of([]);
          }

          // Enrich with role definition names
          const enrichmentPromises = assignments.map(assignment =>
            this.enrichRoleAssignment(assignment, headers)
          );

          return forkJoin(enrichmentPromises).pipe(
            catchError(() => of(assignments)) // Fallback to basic data
          );
        }),
        catchError(() => {
          return of([]);
        })
      );
  }

  /**
   * Get permission summary for dashboard
   */
  getPermissionSummary(userId?: string): Observable<PermissionSummary> {
    return new Observable(observer => {
      this.getUserPermissions(userId).then(permissions => {
        const highPrivilegeRoles = this.identifyHighPrivilegeRoles(permissions);
        const recentAssignments = this.getRecentAssignments(permissions);
        
        const summary: PermissionSummary = {
          totalDirectoryRoles: permissions.directoryRoles.length,
          totalAppRoles: permissions.appRoles.length,
          totalRbacRoles: permissions.rbacRoles.length,
          totalSubscriptions: permissions.subscriptions.length,
          highPrivilegeRoles,
          recentAssignments
        };
        
        observer.next(summary);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  /**
   * Filter permissions based on criteria
   */
  filterPermissions(permissions: UserPermissions, filter: PermissionFilter): UserPermissions {
    let filtered: UserPermissions = {
      directoryRoles: [...permissions.directoryRoles],
      appRoles: [...permissions.appRoles],
      rbacRoles: [...permissions.rbacRoles],
      subscriptions: [...permissions.subscriptions]
    };

    // Filter by permission type
    if (filter.permissionType && filter.permissionType !== 'all') {
      switch (filter.permissionType) {
        case 'directory':
          filtered.appRoles = [];
          filtered.rbacRoles = [];
          break;
        case 'application':
          filtered.directoryRoles = [];
          filtered.rbacRoles = [];
          break;
        case 'rbac':
          filtered.directoryRoles = [];
          filtered.appRoles = [];
          break;
      }
    }

    // Filter by subscription
    if (filter.subscriptionId) {
      filtered.rbacRoles = filtered.rbacRoles.filter(role => 
        role.properties.scope.includes(filter.subscriptionId!)
      );
    }

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered.directoryRoles = filtered.directoryRoles.filter(role => 
        role.displayName.toLowerCase().includes(query)
      );
      filtered.appRoles = filtered.appRoles.filter(role => 
        role.resourceDisplayName.toLowerCase().includes(query) ||
        (role.appRoleDisplayName && role.appRoleDisplayName.toLowerCase().includes(query))
      );
      filtered.rbacRoles = filtered.rbacRoles.filter(role => 
        (role.properties.roleDefinitionName && role.properties.roleDefinitionName.toLowerCase().includes(query)) ||
        (role.properties.scopeDisplayName && role.properties.scopeDisplayName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }

  /**
   * Export permissions to CSV
   */
  exportPermissions(permissions: UserPermissions, userId: string, userDisplayName: string): Blob {
    const csvData = this.convertPermissionsToCSV(permissions, userId, userDisplayName);
    return new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  }

  // Private helper methods
  private getGraphHeaders(): Observable<HttpHeaders> {
    return this.authService.getAccessToken(['https://graph.microsoft.com/.default'])
      .pipe(
        timeout(10000), // 10 second timeout for token acquisition
        map(token => new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        })),
        catchError(error => {
          console.error('🔐 Failed to get Graph API access token:', error);
          // Check if user is authenticated
          if (!this.authService.isAuthenticated()) {
            console.error('🔐 User is not authenticated - redirecting to login');
            // Trigger re-authentication
            this.authService.login();
            return throwError(() => new PermissionError(
              'Authentication required. Please log in again.',
              'AUTHENTICATION_REQUIRED',
              401
            ));
          }
          return throwError(() => this.handleError(error));
        })
      );
  }

  private getManagementHeaders(): Observable<HttpHeaders> {
    return this.authService.getAccessToken(['https://management.azure.com/.default'])
      .pipe(
        timeout(10000), // 10 second timeout for token acquisition
        map(token => new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        })),
        catchError(error => {
          console.error('🔐 Failed to get Management API access token:', error);
          // Check if user is authenticated
          if (!this.authService.isAuthenticated()) {
            console.error('🔐 User is not authenticated - redirecting to login');
            // Trigger re-authentication
            this.authService.login();
            return throwError(() => new PermissionError(
              'Authentication required. Please log in again.',
              'AUTHENTICATION_REQUIRED',
              401
            ));
          }
          return throwError(() => this.handleError(error));
        })
      );
  }

  private getCurrentUserObjectId(): Observable<string> {
    return this.getGraphHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}/me`, {
          headers,
          params: new HttpParams().set('$select', 'id')
        })
      ),
      map(user => user.id)
    );
  }

  private enrichAppRoleAssignment(assignment: any): Observable<AppRoleAssignment> {
    return this.getGraphHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}/servicePrincipals/${assignment.resourceId}`, {
          headers,
          params: new HttpParams().set('$select', 'displayName,appRoles')
        })
      ),
      map(servicePrincipal => {
        const appRole = servicePrincipal.appRoles?.find((role: any) => role.id === assignment.appRoleId);
        return {
          ...assignment,
          appDisplayName: servicePrincipal.displayName,
          appRoleDisplayName: appRole?.displayName,
          appRoleDescription: appRole?.description
        };
      }),
      catchError(() => of(assignment)) // Return original if enrichment fails
    );
  }

  private enrichRoleAssignment(assignment: AzureRoleAssignment, headers: HttpHeaders): Observable<AzureRoleAssignment> {
    const roleDefUrl = `${this.managementApiUrl}${assignment.properties.roleDefinitionId}?api-version=2022-04-01`;
    
    return this.http.get<RoleDefinition>(roleDefUrl, { headers })
      .pipe(
        map(roleDef => ({
          ...assignment,
          properties: {
            ...assignment.properties,
            roleDefinitionName: roleDef.properties.roleName,
            scopeDisplayName: this.getScopeDisplayName(assignment.properties.scope),
            scopeType: this.getScopeType(assignment.properties.scope)
          }
        })),
        catchError(() => of(assignment)) // Return original if enrichment fails
      );
  }

  private getScopeDisplayName(scope: string): string {
    const parts = scope.split('/');
    if (parts.includes('subscriptions')) {
      const subIndex = parts.indexOf('subscriptions');
      if (parts[subIndex + 2] === 'resourceGroups') {
        return parts[subIndex + 3]; // Resource group name
      }
      return parts[subIndex + 1]; // Subscription ID
    }
    return scope;
  }

  private getScopeType(scope: string): 'Subscription' | 'ResourceGroup' | 'Resource' {
    const parts = scope.split('/');
    if (parts.includes('resourceGroups')) {
      if (parts.length > parts.indexOf('resourceGroups') + 2) {
        return 'Resource';
      }
      return 'ResourceGroup';
    }
    return 'Subscription';
  }

  private identifyHighPrivilegeRoles(permissions: UserPermissions): string[] {
    const highPrivilegeRoles: string[] = [];
    
    // Check directory roles
    const highPrivilegeDirectoryRoles = [
      'Global Administrator',
      'Privileged Role Administrator',
      'Security Administrator',
      'User Administrator'
    ];
    
    permissions.directoryRoles.forEach(role => {
      if (highPrivilegeDirectoryRoles.includes(role.displayName)) {
        highPrivilegeRoles.push(role.displayName);
      }
    });
    
    // Check RBAC roles
    permissions.rbacRoles.forEach(role => {
      if (role.properties.roleDefinitionName === 'Owner' || 
          role.properties.roleDefinitionName === 'User Access Administrator') {
        highPrivilegeRoles.push(role.properties.roleDefinitionName || 'Unknown Role');
      }
    });
    
    return [...new Set(highPrivilegeRoles)];
  }

  private getRecentAssignments(permissions: UserPermissions): RecentAssignment[] {
    const assignments: RecentAssignment[] = [];
    
    // Add RBAC assignments (most recent)
    permissions.rbacRoles
      .sort((a, b) => new Date(b.properties.createdOn).getTime() - new Date(a.properties.createdOn).getTime())
      .slice(0, 3)
      .forEach(role => {
        assignments.push({
          roleName: role.properties.roleDefinitionName || 'Unknown Role',
          resourceName: role.properties.scopeDisplayName || 'Unknown Resource',
          assignedDate: new Date(role.properties.createdOn),
          type: 'RBAC'
        });
      });
    
    // Add app role assignments
    permissions.appRoles
      .sort((a, b) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime())
      .slice(0, 2)
      .forEach(role => {
        assignments.push({
          roleName: role.appRoleDisplayName || 'App Role',
          resourceName: role.resourceDisplayName,
          assignedDate: new Date(role.createdDateTime),
          type: 'Application'
        });
      });
    
    return assignments.slice(0, 5);
  }

  private convertPermissionsToCSV(permissions: UserPermissions, userId: string, userDisplayName: string): string {
    const headers = ['Type', 'Role Name', 'Resource/Scope', 'Assigned Date', 'Description'];
    const rows = [headers.join(',')];
    
    // Add directory roles
    permissions.directoryRoles.forEach(role => {
      rows.push([
        'Directory Role',
        `"${role.displayName}"`,
        'Tenant-wide',
        '',
        `"${role.description || ''}"`
      ].join(','));
    });
    
    // Add app roles
    permissions.appRoles.forEach(role => {
      rows.push([
        'Application Role',
        `"${role.appRoleDisplayName || 'App Role'}"`,
        `"${role.resourceDisplayName}"`,
        new Date(role.createdDateTime).toLocaleDateString(),
        `"${role.appRoleDescription || ''}"`
      ].join(','));
    });
    
    // Add RBAC roles
    permissions.rbacRoles.forEach(role => {
      rows.push([
        'RBAC Role',
        `"${role.properties.roleDefinitionName || 'Unknown Role'}"`,
        `"${role.properties.scopeDisplayName || role.properties.scope}"`,
        new Date(role.properties.createdOn).toLocaleDateString(),
        ''
      ].join(','));
    });
    
    return rows.join('\n');
  }

  private setCache(key: string, data: any, customDuration?: number): void {
    const duration = customDuration || this.CACHE_DURATION;
    this.cache.set(key, {
      data,
      expiry: Date.now() + duration
    });
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached || Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    return cached.data as T;
  }

  private handleError(error: any): PermissionError {
    console.error('🚨 PermissionsService error:', error);
    
    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return new PermissionError(
        'Request timed out. Please check your connection and try again.',
        'TIMEOUT_ERROR',
        408
      );
    }
    
    // Handle authentication errors
    if (error.status === 401 || error.code === 'AUTHENTICATION_REQUIRED') {
      return new PermissionError(
        'Authentication required. Please log in again.',
        'AUTHENTICATION_REQUIRED',
        401
      );
    }
    
    // Handle permission errors
    if (error.status === 403) {
      return new PermissionError(
        'Insufficient permissions to access this resource',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }
    
    // Handle network errors
    if (error.status === 0 || !error.status) {
      return new PermissionError(
        'Network error. Please check your connection and try again.',
        'NETWORK_ERROR',
        0
      );
    }
    
    // Handle rate limiting
    if (error.status === 429) {
      return new PermissionError(
        'Too many requests. Please wait a moment and try again.',
        'RATE_LIMITED',
        429
      );
    }
    
    // Default error
    return new PermissionError(
      error.message || 'Failed to fetch permissions',
      'API_ERROR',
      error.status || 500
    );
  }

  // Storage Account Permission Management

  removeStorageAccountPermission(assignmentId: string, storageAccountId: string, subscriptionId: string): Observable<any> {
    return this.azureApiService.removeStorageAccountRoleAssignment(assignmentId, subscriptionId).pipe(
      tap((response) => {
        // Handle successful deletion (204 No Content or 200 OK)
        if (response && response.success) {
          // Clear cache to refresh data
          this.clearStorageAccountCache(storageAccountId);
          // Clear general cache to force UI refresh
          this.clearCache();
        }
      }),
      catchError(error => {
        console.error('Failed to remove storage account permission:', error);
        return throwError(() => error);
      })
    );
  }





  private clearStorageAccountCache(assignmentId: string): void {
    const keysToRemove: string[] = [];
    
    // Extract storage account ID from assignment ID if possible
    const storageAccountMatch = assignmentId.match(/\/storageAccounts\/([^\/]+)/);
    const storageAccountId = storageAccountMatch ? storageAccountMatch[1] : null;
    
    this.cache.forEach((value, key) => {
      if (key.includes('storage_account_permissions') || 
          key.includes('role_assignments') ||
          (storageAccountId && key.includes(storageAccountId))) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      this.cache.delete(key);
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Search Azure resources across all subscriptions using the Resources API
   */
  searchResources(query: string): Observable<any[]> {
    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        // First get subscriptions to search across
        return this.http.get<any>(`${this.managementApiUrl}/subscriptions?api-version=2022-12-01`, { headers }).pipe(
          switchMap(subResponse => {
            const subscriptions = subResponse.value || [];
            if (subscriptions.length === 0) return of([]);

            // Search resources in each subscription
            const searchObservables = subscriptions.map((sub: any) => {
              const url = `${this.managementApiUrl}/subscriptions/${sub.subscriptionId}/resources`;
              const params = new HttpParams()
                .set('api-version', '2021-04-01')
                .set('$filter', `substringof('${query}', name)`)
                .set('$top', '20');

              return this.http.get<{ value: any[] }>(url, { headers, params }).pipe(
                map(response => (response.value || []).map((r: any) => ({
                  id: r.id,
                  name: r.name,
                  type: this.friendlyResourceType(r.type),
                  rawType: r.type,
                  resourceGroup: this.extractResourceGroupFromId(r.id),
                  subscriptionId: sub.subscriptionId,
                  location: r.location
                }))),
                catchError(() => of([]))
              );
            });

            return forkJoin(searchObservables as Observable<any[]>[]).pipe(
              map((results) => {
                const all = (results as any[][]).flat();
                // Filter client-side for case-insensitive match
                const lowerQuery = query.toLowerCase();
                return all.filter((r: any) => r.name.toLowerCase().includes(lowerQuery)).slice(0, 50);
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error('Failed to search resources:', error);
        return of([]);
      })
    );
  }

  /**
   * Get role definitions applicable to a resource scope
   */
  getRoleDefinitionsForScope(scope: string): Observable<any[]> {
    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}${scope}/providers/Microsoft.Authorization/roleDefinitions`;
        const params = new HttpParams().set('api-version', '2022-04-01');

        return this.http.get<{ value: any[] }>(url, { headers, params }).pipe(
          map(response => {
            const roles = (response.value || []).map((rd: any) => ({
              id: rd.id,
              name: rd.properties.roleName,
              description: rd.properties.description,
              type: rd.properties.type === 'BuiltInRole' ? 'builtin' : 'custom'
            }));

            // Sort: common roles first, then alphabetically
            const commonRoles = ['Owner', 'Contributor', 'Reader', 'User Access Administrator',
              'Storage Blob Data Owner', 'Storage Blob Data Contributor', 'Storage Blob Data Reader',
              'Storage Account Contributor', 'Storage Account Key Operator Service Role'];

            return roles.sort((a: any, b: any) => {
              const aCommonIdx = commonRoles.indexOf(a.name);
              const bCommonIdx = commonRoles.indexOf(b.name);
              if (aCommonIdx !== -1 && bCommonIdx !== -1) return aCommonIdx - bCommonIdx;
              if (aCommonIdx !== -1) return -1;
              if (bCommonIdx !== -1) return 1;
              return a.name.localeCompare(b.name);
            });
          })
        );
      }),
      catchError(error => {
        console.error('Failed to get role definitions for scope:', error);
        return of([]);
      })
    );
  }

  private friendlyResourceType(type: string): string {
    const typeMap: Record<string, string> = {
      'Microsoft.Storage/storageAccounts': 'Storage Account',
      'Microsoft.Compute/virtualMachines': 'Virtual Machine',
      'Microsoft.Web/sites': 'App Service',
      'Microsoft.Sql/servers': 'SQL Server',
      'Microsoft.Sql/servers/databases': 'SQL Database',
      'Microsoft.KeyVault/vaults': 'Key Vault',
      'Microsoft.Network/virtualNetworks': 'Virtual Network',
      'Microsoft.Network/networkSecurityGroups': 'Network Security Group',
      'Microsoft.Network/publicIPAddresses': 'Public IP Address',
      'Microsoft.Network/loadBalancers': 'Load Balancer',
      'Microsoft.ContainerService/managedClusters': 'AKS Cluster',
      'Microsoft.DocumentDB/databaseAccounts': 'Cosmos DB',
      'Microsoft.Cache/Redis': 'Redis Cache',
      'Microsoft.ServiceBus/namespaces': 'Service Bus',
      'Microsoft.EventHub/namespaces': 'Event Hub',
    };
    return typeMap[type] || type.split('/').pop() || type;
  }

  /**
   * Get all resource groups for a subscription
   */
  getResourceGroups(subscriptionId: string): Observable<any[]> {
    const cacheKey = `resource_groups_${subscriptionId}`;
    const cached = this.getFromCache<any[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}/subscriptions/${subscriptionId}/resourcegroups`;
        const params = new HttpParams().set('api-version', '2022-09-01');
        return this.http.get<{ value: any[] }>(url, { headers, params });
      }),
      map(response => {
        const groups = response.value || [];
        this.setCache(cacheKey, groups, 5 * 60 * 1000);
        return groups;
      }),
      catchError(error => {
        console.error('Failed to get resource groups:', error);
        return of([]);
      })
    );
  }

  // Storage Account Methods

  /**
   * Get all storage accounts for a subscription
   */
  getStorageAccounts(subscriptionId: string): Observable<StorageAccount[]> {
    const cacheKey = `storage_accounts_${subscriptionId}`;
    const cached = this.getFromCache<StorageAccount[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}/subscriptions/${subscriptionId}/providers/Microsoft.Storage/storageAccounts`;
        const params = new HttpParams().set('api-version', '2023-01-01');
        
        return this.http.get<{value: any[]}>(url, { headers, params });
      }),
      map(response => {
        const storageAccounts: StorageAccount[] = response.value.map(account => ({
          id: account.id,
          name: account.name,
          type: account.type,
          location: account.location,
          resourceGroup: this.extractResourceGroupFromId(account.id),
          subscriptionId: subscriptionId,
          properties: {
            primaryEndpoints: account.properties?.primaryEndpoints,
            creationTime: account.properties?.creationTime || new Date().toISOString(),
            provisioningState: account.properties.provisioningState,
            accountType: account.properties.accountType || account.sku?.name,
            accessTier: account.properties.accessTier,
            supportsHttpsTrafficOnly: account.properties.supportsHttpsTrafficOnly
          },
          tags: account.tags
        }));
        
        this.setCache(cacheKey, storageAccounts);
        return storageAccounts;
      }),
      catchError(error => {
        console.error('Failed to get storage accounts:', error);
        return throwError(() => new StorageAccountError(
          'Failed to fetch storage accounts',
          'FETCH_ERROR',
          error.status
        ));
      })
    );
  }

  /**
   * Get storage accounts with their role assignments
   */
  getStorageAccountsWithPermissions(subscriptionId: string, filter?: StorageAccountFilter): Observable<StorageAccountPermission[]> {
    return this.getStorageAccounts(subscriptionId).pipe(
      switchMap(storageAccounts => {
        let filteredAccounts = storageAccounts;
        
        // Apply filters
        if (filter) {
          filteredAccounts = this.applyStorageAccountFilters(storageAccounts, filter);
        }
        
        // Process storage accounts in batches to prevent API overload
        return this.processStorageAccountsInBatches(filteredAccounts);
      })
    );
  }

  /**
   * Process storage accounts in batches to prevent API overload
   */
  private processStorageAccountsInBatches(accounts: StorageAccount[], batchSize: number = 5): Observable<StorageAccountPermission[]> {
    if (accounts.length === 0) {
      return of([]);
    }

    // Split accounts into batches
    const batches: StorageAccount[][] = [];
    for (let i = 0; i < accounts.length; i += batchSize) {
      batches.push(accounts.slice(i, i + batchSize));
    }

    // Process batches sequentially with delay between batches
    return from(batches).pipe(
      concatMap((batch, batchIndex) => {
        const batchPromises = batch.map(account => 
          this.getStorageAccountRoleAssignments(account.id).pipe(
            map(roleAssignments => ({
              storageAccount: account,
              roleAssignments
            } as StorageAccountPermission)),
            catchError(() => {
              return of({
                storageAccount: account,
                roleAssignments: []
              } as StorageAccountPermission);
            })
          )
        );
        
        // Add delay between batches to prevent API throttling
        const delay = batchIndex > 0 ? timer(500) : of(0);
        
        return delay.pipe(
          switchMap(() => batchPromises.length > 0 ? forkJoin(batchPromises) : of([]))
        );
      }),
      // Flatten all batch results into a single array
      scan((acc: StorageAccountPermission[], batch: StorageAccountPermission[]) => [...acc, ...batch], []),
      // Only emit the final result
      takeLast(1)
    );
  }

  /**
   * Fetch ALL role assignments at subscription level in a single API call,
   * then distribute them to matching storage accounts client-side.
   * This drastically reduces network calls (1 call vs N per-account calls).
   */
  getSubscriptionRoleAssignments(subscriptionId: string): Observable<any[]> {
    const cacheKey = `subscription_role_assignments_${subscriptionId}`;
    const cached = this.getFromCache<any[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleAssignments`;
        const params = new HttpParams().set('api-version', '2022-04-01');

        return this.http.get<{ value: any[] }>(url, { headers, params }).pipe(
          timeout(30000)
        );
      }),
      map(response => {
        const assignments = response.value || [];
        this.setCache(cacheKey, assignments, 5 * 60 * 1000);
        return assignments;
      }),
      catchError(error => {
        console.error('Failed to get subscription-level role assignments:', error);
        return of([]);
      })
    );
  }

  /**
   * Fetch ALL role definitions at subscription level in a single API call.
   * Results are cached and used to resolve role names without per-assignment lookups.
   */
  getSubscriptionRoleDefinitions(subscriptionId: string): Observable<Map<string, RoleDefinition>> {
    const cacheKey = `subscription_role_definitions_${subscriptionId}`;
    const cached = this.getFromCache<Map<string, RoleDefinition>>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions`;
        const params = new HttpParams().set('api-version', '2022-04-01');

        return this.http.get<{ value: RoleDefinition[] }>(url, { headers, params }).pipe(
          timeout(30000)
        );
      }),
      map(response => {
        const definitions = response.value || [];
        const definitionMap = new Map<string, RoleDefinition>();
        definitions.forEach(def => {
          definitionMap.set(def.id, def);
        });
        this.setCache(cacheKey, definitionMap, 10 * 60 * 1000);
        return definitionMap;
      }),
      catchError(error => {
        console.error('Failed to get subscription-level role definitions:', error);
        return of(new Map<string, RoleDefinition>());
      })
    );
  }

  /**
   * Batch-load permissions for all storage accounts using subscription-level APIs.
   * Makes only 2 API calls (role assignments + role definitions) instead of N*3 per-account calls.
   * Returns a map of storageAccountId -> enriched role assignments.
   */
  batchLoadStorageAccountPermissions(
    subscriptionId: string,
    storageAccountIds: string[]
  ): Observable<Map<string, StorageAccountRoleAssignment[]>> {
    return forkJoin({
      assignments: this.getSubscriptionRoleAssignments(subscriptionId),
      roleDefinitions: this.getSubscriptionRoleDefinitions(subscriptionId)
    }).pipe(
      switchMap(({ assignments, roleDefinitions }) => {
        // Build a set of storage account ID prefixes for fast scope matching
        const storageAccountIdSet = new Set(storageAccountIds.map(id => id.toLowerCase()));

        // Filter assignments whose scope matches any storage account
        const storageAssignments = assignments.filter(a => {
          const scope = (a.properties?.scope || '').toLowerCase();
          return storageAccountIdSet.has(scope) ||
            // Also match assignments scoped to parent (resource group, subscription)
            // that would apply to storage accounts
            storageAccountIds.some(saId => saId.toLowerCase().startsWith(scope));
        });

        // Collect unique principal IDs for batch enrichment
        const uniquePrincipalIds = [...new Set(storageAssignments.map(a => a.properties.principalId))];

        // Batch-fetch principal details (with deduplication from existing cache)
        const principalRequests = uniquePrincipalIds.map(pid =>
          this.getPrincipalDetails(pid).pipe(
            map(details => ({ id: pid, details })),
            catchError(() => of({ id: pid, details: { displayName: `Unknown (${pid.substring(0, 8)}...)`, principalType: 'Unknown' } }))
          )
        );

        const principalLookup$ = principalRequests.length > 0
          ? forkJoin(principalRequests)
          : of([]);

        return principalLookup$.pipe(
          map(principalResults => {
            // Build principal lookup map
            const principalMap = new Map<string, any>();
            principalResults.forEach(p => principalMap.set(p.id, p.details));

            // Group enriched assignments by storage account
            const resultMap = new Map<string, StorageAccountRoleAssignment[]>();
            storageAccountIds.forEach(id => resultMap.set(id, []));

            storageAssignments.forEach(assignment => {
              const scope = assignment.properties.scope || '';
              const roleDefId = assignment.properties.roleDefinitionId || '';
              const roleDef = roleDefinitions.get(roleDefId);
              const principal = principalMap.get(assignment.properties.principalId);

              const enriched: StorageAccountRoleAssignment = {
                id: assignment.id,
                name: assignment.name,
                type: assignment.type,
                properties: {
                  roleDefinitionId: roleDefId,
                  roleDefinitionName: roleDef?.properties?.roleName || 'Unknown Role',
                  principalId: assignment.properties.principalId,
                  principalType: assignment.properties.principalType || principal?.principalType || 'Unknown',
                  principalDisplayName: principal?.displayName || `Unknown (${assignment.properties.principalId.substring(0, 8)}...)`,
                  principalEmail: principal?.mail || principal?.userPrincipalName,
                  scope: scope,
                  createdOn: assignment.properties.createdOn,
                  updatedOn: assignment.properties.updatedOn
                }
              };

              // Assign to matching storage account(s)
              const matchingAccounts = storageAccountIds.filter(saId =>
                saId.toLowerCase() === scope.toLowerCase() ||
                saId.toLowerCase().startsWith(scope.toLowerCase())
              );

              matchingAccounts.forEach(saId => {
                const existing = resultMap.get(saId) || [];
                existing.push(enriched);
                resultMap.set(saId, existing);
              });
            });

            // Cache individual account results for later use
            resultMap.forEach((assignments, saId) => {
              this.setCache(`storage_account_assignments_${saId}`, assignments, 5 * 60 * 1000);
            });

            return resultMap;
          })
        );
      }),
      catchError(error => {
        console.error('Failed to batch-load storage account permissions:', error);
        return of(new Map<string, StorageAccountRoleAssignment[]>());
      })
    );
  }

  /**
   * Get role assignments for a specific storage account
   */
  getStorageAccountRoleAssignments(storageAccountId: string): Observable<StorageAccountRoleAssignment[]> {
    // Check cache first to prevent duplicate requests
    const cacheKey = `storage_account_assignments_${storageAccountId}`;
    const cached = this.getFromCache<StorageAccountRoleAssignment[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    // Check if there's already a pending request for this storage account
    const existingRequest = this.pendingStorageAccountRequests.get(storageAccountId);
    if (existingRequest) {
      return existingRequest;
    }

    const request: Observable<StorageAccountRoleAssignment[]> = this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}${storageAccountId}/providers/Microsoft.Authorization/roleAssignments`;
        const params = new HttpParams().set('api-version', '2022-04-01');
        
        return this.http.get<{value: any[]}>(url, { headers, params }).pipe(
          timeout(15000) // 15 second timeout for management API requests
        );
      }),
      switchMap(response => {
        const assignments = response.value || [];
        
        // Enrich with role definition names and principal details
        const enrichmentPromises = assignments.map(assignment => 
          this.enrichStorageAccountRoleAssignment(assignment)
        );
        
        return forkJoin(enrichmentPromises).pipe(
          catchError(() => of(assignments.map(a => this.mapToStorageAccountRoleAssignment(a))))
        );
      }),
      tap(assignments => {
        // Cache the result for 5 minutes
        this.setCache(cacheKey, assignments, 5 * 60 * 1000);
        // Remove from pending requests
        this.pendingStorageAccountRequests.delete(storageAccountId);
      }),
      catchError(error => {
        console.error('Failed to get storage account role assignments:', error);
        // Remove from pending requests on error
        this.pendingStorageAccountRequests.delete(storageAccountId);
        return of([]);
      }),
      share() // Share the observable to prevent multiple HTTP requests
    );

    // Store the pending request
    this.pendingStorageAccountRequests.set(storageAccountId, request);
    return request;
  }

  /**
   * Get storage account summary statistics
   */
  getStorageAccountSummary(subscriptionId: string): Observable<StorageAccountSummary> {
    return this.getStorageAccountsWithPermissions(subscriptionId).pipe(
      map(storageAccountPermissions => {
        const totalStorageAccounts = storageAccountPermissions.length;
        const totalRoleAssignments = storageAccountPermissions.reduce(
          (sum, sap) => sum + sap.roleAssignments.length, 0
        );
        
        // Group by location
        const storageAccountsByLocation: { [location: string]: number } = {};
        storageAccountPermissions.forEach(sap => {
          const location = sap.storageAccount.location;
          storageAccountsByLocation[location] = (storageAccountsByLocation[location] || 0) + 1;
        });
        
        // Role distribution
        const roleDistribution: { [roleName: string]: number } = {};
        storageAccountPermissions.forEach(sap => {
          sap.roleAssignments.forEach(assignment => {
            const roleName = assignment.properties.roleDefinitionName;
            roleDistribution[roleName] = (roleDistribution[roleName] || 0) + 1;
          });
        });
        
        // Recent assignments
        const recentAssignments = this.getRecentStorageAssignments(storageAccountPermissions);
        
        return {
          totalStorageAccounts,
          totalRoleAssignments,
          storageAccountsByLocation,
          roleDistribution,
          recentAssignments
        };
      })
    );
  }

  // Private helper methods for storage accounts

  private applyStorageAccountFilters(accounts: StorageAccount[], filter: StorageAccountFilter): StorageAccount[] {
    let filtered = [...accounts];
    
    if (filter.resourceGroup) {
      filtered = filtered.filter(account => 
        account.resourceGroup.toLowerCase().includes(filter.resourceGroup!.toLowerCase())
      );
    }
    
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(account => 
        account.name.toLowerCase().includes(query) ||
        account.resourceGroup.toLowerCase().includes(query) ||
        account.location.toLowerCase().includes(query)
      );
    }
    
    if (filter.location) {
      filtered = filtered.filter(account => 
        account.location.toLowerCase() === filter.location!.toLowerCase()
      );
    }
    
    if (filter.accountType) {
      filtered = filtered.filter(account => 
        account.properties.accountType?.toLowerCase().includes(filter.accountType!.toLowerCase())
      );
    }
    
    return filtered;
  }

  private enrichStorageAccountRoleAssignment(assignment: any): Observable<StorageAccountRoleAssignment> {
    // Cache key for this specific assignment
    const cacheKey = `enriched_assignment_${assignment.id}`;
    const cached = this.getFromCache<StorageAccountRoleAssignment>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        // Get role definition with caching
        const roleDefCacheKey = `role_def_${assignment.properties.roleDefinitionId}`;
        const cachedRoleDef = this.getFromCache<RoleDefinition>(roleDefCacheKey);
        
        const roleDefRequest = cachedRoleDef 
          ? of(cachedRoleDef)
          : this.http.get<RoleDefinition>(`${this.managementApiUrl}${assignment.properties.roleDefinitionId}?api-version=2022-04-01`, { headers })
              .pipe(
                timeout(10000), // 10 second timeout for role definition requests
                tap(roleDef => this.setCache(roleDefCacheKey, roleDef)),
                catchError(() => {
                  return of(null);
                })
              );
        
        // Get principal details (already has caching and error handling)
        const principalRequest = this.getPrincipalDetails(assignment.properties.principalId);
        
        return forkJoin({
          roleDef: roleDefRequest,
          principal: principalRequest
        });
      }),
      map(({ roleDef, principal }) => {
        const enrichedAssignment: StorageAccountRoleAssignment = {
          id: assignment.id,
          name: assignment.name,
          type: assignment.type,
          properties: {
            roleDefinitionId: assignment.properties.roleDefinitionId,
            roleDefinitionName: roleDef?.properties?.roleName || 'Unknown Role',
            principalId: assignment.properties.principalId,
            principalType: assignment.properties.principalType,
            principalDisplayName: principal?.displayName || `Unknown Principal (${assignment.properties.principalId.substring(0, 8)}...)`,
            principalEmail: principal?.mail || principal?.userPrincipalName,
            scope: assignment.properties.scope,
            createdOn: assignment.properties.createdOn,
            updatedOn: assignment.properties.updatedOn
          }
        };
        
        // Cache the enriched assignment
        this.setCache(cacheKey, enrichedAssignment);
        return enrichedAssignment;
      }),
      catchError(() => {
        const fallbackAssignment = this.mapToStorageAccountRoleAssignment(assignment);
        this.setCache(cacheKey, fallbackAssignment);
        return of(fallbackAssignment);
      })
    );
  }

  /** Resolve a single principal's display details from Graph API (cached) */
  resolvePrincipal(principalId: string): Observable<any> {
    return this.getPrincipalDetails(principalId);
  }

  private getPrincipalDetails(principalId: string): Observable<any> {
    // Cache to avoid repeated failed requests
    const cacheKey = `principal_${principalId}`;
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) {
      return of(cached);
    }

    // Check if we've already determined this principal doesn't exist
    const failureCacheKey = `principal_failure_${principalId}`;
    const cachedFailure = this.getFromCache<boolean>(failureCacheKey);
    if (cachedFailure) {
      const fallbackPrincipal = {
        id: principalId,
        displayName: `Unknown Principal (${principalId.substring(0, 8)}...)`,
        principalType: 'Unknown'
      };
      this.setCache(cacheKey, fallbackPrincipal);
      return of(fallbackPrincipal);
    }

    // Check if there's already a pending request for this principal
    const existingRequest = this.pendingPrincipalRequests.get(principalId);
    if (existingRequest) {
      return existingRequest;
    }

    // Create new request with deduplication
    const request = this.getGraphHeaders().pipe(
      switchMap(headers => {
        // Use a batch request approach to reduce API calls
        return this.tryGetPrincipalWithBatch(principalId, headers);
      }),
      shareReplay(1), // Share the result with multiple subscribers
      finalize(() => {
        // Remove from pending requests when complete
        this.pendingPrincipalRequests.delete(principalId);
      })
    );

    // Store the request to prevent duplicates
    this.pendingPrincipalRequests.set(principalId, request);
    return request;
  }

  private tryGetPrincipalWithBatch(principalId: string, headers: HttpHeaders): Observable<any> {
    const cacheKey = `principal_${principalId}`;
    const failureCacheKey = `principal_failure_${principalId}`;
    
    // Validate principal ID format
    if (!this.isValidPrincipalId(principalId)) {
      const fallbackPrincipal = {
        id: principalId,
        displayName: `Invalid Principal ID (${principalId.substring(0, 8)}...)`,
        principalType: 'Unknown'
      };
      this.setCache(cacheKey, fallbackPrincipal);
      this.setCache(failureCacheKey, true, 300000);
      return of(fallbackPrincipal);
    }
    
    // Try user first with silent error handling
    return this.makeGraphRequest(`users/${principalId}`, headers, 'id,displayName,mail,userPrincipalName').pipe(
      map(result => {
        result.principalType = 'User';
        result.isDeleted = false;
        this.setCache(cacheKey, result);
        return result;
      }),
      catchError((userError) => {
        if (userError.status === 404) {
          // Try service principal
          return this.makeGraphRequest(`servicePrincipals/${principalId}`, headers, 'id,displayName,appDisplayName').pipe(
            map(result => {
              result.principalType = 'ServicePrincipal';
              result.isDeleted = false;
              this.setCache(cacheKey, result);
              return result;
            }),
            catchError((spError) => {
              if (spError.status === 404) {
                // Try group as last resort
                return this.makeGraphRequest(`groups/${principalId}`, headers, 'id,displayName,mail').pipe(
                  map(result => {
                    result.principalType = 'Group';
                    result.isDeleted = false;
                    this.setCache(cacheKey, result);
                    return result;
                  }),
                  catchError((groupError) => {
                    // All attempts failed - cache the failure and return fallback
                    return this.handlePrincipalNotFound(principalId, cacheKey, failureCacheKey);
                  })
                );
              } else {
                // Non-404 error for service principal
                return this.handlePrincipalError(principalId, cacheKey, failureCacheKey, spError);
              }
            })
          );
        } else {
          // Non-404 error for user
          return this.handlePrincipalError(principalId, cacheKey, failureCacheKey, userError);
        }
      })
    );
  }

  private makeGraphRequest(endpoint: string, headers: HttpHeaders, selectFields: string): Observable<any> {
    return this.http.get<any>(`${this.graphApiUrl}/${endpoint}`, {
      headers,
      params: new HttpParams().set('$select', selectFields)
    }).pipe(
      timeout(10000), // 10 second timeout to prevent hanging requests
      catchError((error) => {
        // Suppress 404 console errors for expected failures
        if (error.status === 404) {
          // Don't log 404s as they are expected when principals don't exist
          return throwError(() => error);
        }
        // Handle timeout errors
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('Request timed out'));
        }
        return throwError(() => error);
      })
    );
  }

  private isValidPrincipalId(principalId: string): boolean {
    // Check if it's a valid GUID format
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return guidRegex.test(principalId);
  }

  private handlePrincipalNotFound(principalId: string, cacheKey: string, failureCacheKey: string): Observable<any> {
    this.setCache(failureCacheKey, true, 300000); // Cache failure for 5 minutes
    const fallbackPrincipal = {
      id: principalId,
      displayName: `Deleted Principal (${principalId.substring(0, 8)}...)`,
      principalType: 'Unknown',
      isDeleted: true
    };
    this.setCache(cacheKey, fallbackPrincipal);
    return of(fallbackPrincipal);
  }

  private handlePrincipalError(principalId: string, cacheKey: string, failureCacheKey: string, error: any): Observable<any> {
    this.setCache(failureCacheKey, true, 300000);
    const fallbackPrincipal = {
      id: principalId,
      displayName: `Error Loading Principal (${principalId.substring(0, 8)}...)`,
      principalType: 'Unknown',
      isDeleted: false,
      hasError: true
    };
    this.setCache(cacheKey, fallbackPrincipal);
    return of(fallbackPrincipal);
  }

  private mapToStorageAccountRoleAssignment(assignment: any): StorageAccountRoleAssignment {
    return {
      id: assignment.id,
      name: assignment.name,
      type: assignment.type,
      properties: {
        roleDefinitionId: assignment.properties.roleDefinitionId,
        roleDefinitionName: 'Unknown Role',
        principalId: assignment.properties.principalId,
        principalType: assignment.properties.principalType,
        principalDisplayName: 'Unknown Principal',
        scope: assignment.properties.scope,
        createdOn: assignment.properties.createdOn,
        updatedOn: assignment.properties.updatedOn
      }
    };
  }

  private extractResourceGroupFromId(resourceId: string): string {
    const parts = resourceId.split('/');
    const rgIndex = parts.indexOf('resourceGroups');
    return rgIndex !== -1 && rgIndex + 1 < parts.length ? parts[rgIndex + 1] : 'Unknown';
  }

  private getRecentStorageAssignments(storageAccountPermissions: StorageAccountPermission[]): any[] {
    const allAssignments: any[] = [];
    
    storageAccountPermissions.forEach(sap => {
      sap.roleAssignments.forEach(assignment => {
        allAssignments.push({
          storageAccountName: sap.storageAccount.name,
          principalName: assignment.properties.principalDisplayName,
          roleName: assignment.properties.roleDefinitionName,
          assignedDate: new Date(assignment.properties.createdOn),
          resourceGroup: sap.storageAccount.resourceGroup
        });
      });
    });
    
    return allAssignments
      .sort((a, b) => b.assignedDate.getTime() - a.assignedDate.getTime())
      .slice(0, 5);
  }

  /**
   * Assign permission to a storage account
   */
  assignStorageAccountPermission(request: {
    storageAccountId: string;
    principalId: string;
    roleDefinitionId: string;
    principalType: string;
  }): Observable<any> {
    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const assignmentId = this.generateGuid();
        const url = `${this.managementApiUrl}${request.storageAccountId}/providers/Microsoft.Authorization/roleAssignments/${assignmentId}?api-version=2022-04-01`;
        
        const body = {
          properties: {
            roleDefinitionId: request.roleDefinitionId,
            principalId: request.principalId,
            principalType: request.principalType
          }
        };
        
        return this.http.put(url, body, { headers }).pipe(
          tap(result => {
            // Log successful permission assignment
            this.appAuditService.logAction(
              'permission_added',
              'storage_account',
              request.storageAccountId,
              `Storage Account Permission`,
              {
                principalId: request.principalId,
                principalType: request.principalType,
                roleDefinitionId: request.roleDefinitionId,
                assignmentId: assignmentId,
                assignmentUrl: url
              },
              true
            );
          }),
          catchError(error => {
            console.error('Failed to assign storage account permission:', error);
            return throwError(() => this.handleError(error));
          })
        );
      })
    );
  }



  /**
   * Bulk assign permissions to multiple storage accounts
   */
  bulkAssignStorageAccountPermissions(requests: Array<{
    storageAccountId: string;
    principalId: string;
    roleDefinitionId: string;
    principalType: string;
  }>): Observable<any[]> {
    return this.queueOperation(() => {
      const operations = requests.map(request => 
        this.assignStorageAccountPermission(request).pipe(
          map(result => ({ success: true, result, request })),
          catchError(error => of({ success: false, error, request }))
        )
      );
      
      return forkJoin(operations);
    });
  }

  /**
   * Bulk remove permissions from storage accounts
   */
  bulkRemoveStorageAccountPermissions(assignments: Array<{
    assignmentId: string;
    storageAccountId: string;
    subscriptionId: string;
  }>): Observable<any[]> {
    return this.queueOperation(() => {
      const operations = assignments.map(assignment => 
        this.removeStorageAccountPermissionWithLockHandling(
          assignment.assignmentId,
          assignment.storageAccountId,
          assignment.subscriptionId
        ).pipe(
          map(result => ({ success: true, result, assignment })),
          catchError(error => of({ success: false, error, assignment }))
        )
      );
      
      return forkJoin(operations).pipe(
        tap(results => {
          const successful = results.filter(r => r.success).length;
          const failed = results.filter(r => !r.success).length;
          
          // Log bulk permission removal
          this.appAuditService.logAction(
            'bulk_permissions_removed',
            'storage_account',
            'multiple',
            `Bulk Permission Removal (${assignments.length} items)`,
            {
              totalRequests: assignments.length,
              successful,
              failed,
              assignments: assignments.map(a => ({
                assignmentId: a.assignmentId,
                storageAccountId: a.storageAccountId
              }))
            },
            false
          );
        })
      );
    });
  }

  /**
   * Clear cache and pending requests (useful for debugging or manual refresh)
   */
  clearPrincipalCache(): void {
    // Clear cache entries for principals
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith('principal_') || key.startsWith('enriched_assignment_')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
    
    // Clear pending requests
    this.pendingPrincipalRequests.clear();
    
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { totalEntries: number; principalEntries: number; pendingRequests: number } {
    let principalEntries = 0;
    this.cache.forEach((_, key) => {
      if (key.startsWith('principal_')) {
        principalEntries++;
      }
    });
    
    return {
      totalEntries: this.cache.size,
      principalEntries,
      pendingRequests: this.pendingPrincipalRequests.size
    };
  }

  /**
   * Get locks on a storage account
   */
  getStorageAccountLocks(storageAccountId: string): Observable<any[]> {
    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}${storageAccountId}/providers/Microsoft.Authorization/locks?api-version=2020-05-01`;
        
        return this.http.get<any>(url, { headers }).pipe(
          map(response => response.value || []),
          catchError(error => {
            console.error('Failed to get storage account locks:', error);
            return of([]);
          })
        );
      })
    );
  }

  /**
   * Temporarily remove locks
   */
  private temporarilyRemoveLocks(locks: any[], headers: HttpHeaders): Observable<any> {
    const removeOperations = locks.map(lock => {
      const url = `${this.managementApiUrl}${lock.id}?api-version=2020-05-01`;
      return this.http.delete(url, { headers }).pipe(
        timeout(10000), // 10 second timeout for lock operations
        catchError(() => {
          return of(null);
        })
      );
    });
    
    return forkJoin(removeOperations);
  }

  /**
   * Recreate locks after permission operation
   */
  private recreateLocks(locks: any[], headers: HttpHeaders): Observable<any> {
    const createOperations = locks.map(lock => {
      const url = `${this.managementApiUrl}${lock.id}?api-version=2020-05-01`;
      const body = {
        properties: {
          level: lock.properties.level,
          notes: lock.properties.notes || 'Recreated after permission operation'
        }
      };
      
      return this.http.put(url, body, { headers }).pipe(
        timeout(10000), // 10 second timeout for lock operations
        catchError(() => {
          return of(null);
        })
      );
    });
    
    return forkJoin(createOperations);
  }

  /**
   * Remove a role assignment
   */
  private removeRoleAssignment(assignmentId: string, headers: HttpHeaders): Observable<any> {
    const url = `${this.managementApiUrl}${assignmentId}?api-version=2022-04-01`;
    
    return this.http.delete(url, { headers }).pipe(
      timeout(15000), // 15 second timeout for delete operations
      catchError(error => {
        console.error('Failed to remove role assignment:', error);
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Generate a GUID for role assignments
   */
  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Extract storage account ID from assignment ID
   */
  private extractStorageAccountIdFromAssignmentId(assignmentId: string): string {
    // Assignment ID format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{name}/providers/Microsoft.Authorization/roleAssignments/{guid}
    const parts = assignmentId.split('/providers/Microsoft.Authorization/roleAssignments/');
    return parts.length > 0 ? parts[0] : assignmentId;
  }

  /**
   * Remove a storage account role assignment
   */
  private removeStorageAccountRoleAssignment(assignmentId: string): Observable<any> {
    return this.getManagementHeaders().pipe(
      switchMap(headers => {
        const url = `${this.managementApiUrl}${assignmentId}?api-version=2022-04-01`;

        return this.http.delete(url, { headers }).pipe(
          timeout(15000), // 15 second timeout for delete operations
          tap(() => {
            // Clear cache for storage account permissions
            this.clearStorageAccountCache(assignmentId);
            
            // Log successful permission removal
            this.appAuditService.logAction(
              'permission_removed',
              'storage_account',
              this.extractStorageAccountIdFromAssignmentId(assignmentId),
              'Storage Account Permission',
              {
                assignmentId: assignmentId,
                assignmentUrl: url
              },
              true
            );
          }),
          catchError(error => {
            console.error('❌ Failed to remove storage account role assignment:', error);
            // Don't transform the error here - let it bubble up with original format
            return throwError(() => error);
          })
        );
      })
    );
  }

  /**
    * Remove storage account permission with automatic lock handling
    */
   removeStorageAccountPermissionWithLockHandling(assignmentId: string, storageAccountId: string, subscriptionId: string): Observable<any> {
     // Don't use queueOperation for ScopeLocked errors - handle them directly
     return this.azureApiService.removeStorageAccountRoleAssignment(assignmentId, subscriptionId).pipe(
       catchError(error => {
         // Check if it's a ScopeLocked error
         if (this.lockManagementService.isScopeLockedError(error)) {
           // Use Observable-based lock handling
           const resourceId = this.lockManagementService.extractResourceIdFromError(error);
           if (resourceId) {
             return this.lockManagementService.handleScopeLockedErrorObservable(
               error,
               resourceId,
               () => this.azureApiService.removeStorageAccountRoleAssignment(assignmentId, subscriptionId),
               'permission removal'
             );
           } else {
             console.error('❌ Could not extract resource ID from ScopeLocked error');
             return throwError(() => error);
           }
         }
         
         // For other errors, use the queue with retry logic
         return this.queueOperation(() => {
           return this.azureApiService.removeStorageAccountRoleAssignment(assignmentId, subscriptionId);
         });
       })
     );
   }

   /**
    * Queue an operation to handle conflicts
    */
   private queueOperation<T>(operation: () => Observable<T>): Observable<T> {
     return new Observable<T>(observer => {
       this.operationQueue.push({
         operation,
         resolve: (value: T) => observer.next(value),
         reject: (error: any) => observer.error(error)
       });
       
       this.processQueue();
     });
   }

   /**
    * Process the operation queue
    */
   private processQueue(): void {
     if (this.isProcessingQueue || this.operationQueue.length === 0) {
       return;
     }

     this.isProcessingQueue = true;
     const queueItem = this.operationQueue.shift()!;

     this.executeWithRetry(queueItem.operation, this.MAX_RETRY_ATTEMPTS).subscribe({
       next: (result) => {
         queueItem.resolve(result);
         this.isProcessingQueue = false;
         this.processQueue(); // Process next item
       },
       error: (error) => {
         queueItem.reject(error);
         this.isProcessingQueue = false;
         this.processQueue(); // Process next item
       }
     });
   }

   /**
    * Execute operation with retry logic
    */
   private executeWithRetry<T>(operation: () => Observable<T>, maxAttempts: number): Observable<T> {
     return operation().pipe(
       catchError(error => {
         // Don't retry ScopeLocked errors - they need special handling
         if (this.lockManagementService.isScopeLockedError(error)) {
           throw error;
         }
         
         // Check if it's a conflict error (but not ScopeLocked)
         const isConflictError = error.status === 409 || 
                                error.error?.code === 'ConflictError' ||
                                error.message?.includes('conflict') ||
                                error.message?.includes('only one modification');
         
         if (isConflictError && maxAttempts > 1) {
           return new Observable<T>(observer => {
             setTimeout(() => {
               this.executeWithRetry(operation, maxAttempts - 1).subscribe(observer);
             }, this.RETRY_DELAY);
           });
         }
         
         throw error;
       })
     );
   }
}