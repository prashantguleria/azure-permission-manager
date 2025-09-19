import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
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

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly graphApiUrl = 'https://graph.microsoft.com/v1.0';
  private readonly managementApiUrl = 'https://management.azure.com';
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(
    private http: HttpClient,
    private authService: AuthService
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
   * Get directory roles for a user
   */
  getDirectoryRoles(userId?: string): Observable<DirectoryRole[]> {
    const endpoint = userId ? `/users/${userId}/memberOf` : '/me/memberOf';
    
    return this.getGraphHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}${endpoint}`, {
          headers,
          params: new HttpParams()
            .set('$select', 'id,displayName,description,roleTemplateId')
        })
      ),
      map(response => 
        response.value
          .filter((item: any) => item.roleTemplateId) // Directory roles have roleTemplateId
          .map((role: any) => ({
            id: role.id,
            displayName: role.displayName,
            description: role.description,
            roleTemplateId: role.roleTemplateId,
            isBuiltIn: true // Directory roles are typically built-in
          }))
      ),
      catchError(error => {
        console.error('Failed to get directory roles:', error);
        return throwError(() => this.handleError(error));
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
        const assignments = response.value;
        
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
        return throwError(() => this.handleError(error));
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
          
          // Enrich with role definition names
          const enrichmentPromises = assignments.map(assignment => 
            this.enrichRoleAssignment(assignment, headers)
          );
          
          return forkJoin(enrichmentPromises).pipe(
            catchError(() => of(assignments)) // Fallback to basic data
          );
        }),
        catchError(error => {
          console.warn(`Failed to get role assignments for subscription ${subscriptionId}:`, error);
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
        map(token => new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        })),
        catchError(error => throwError(() => this.handleError(error)))
      );
  }

  private getManagementHeaders(): Observable<HttpHeaders> {
    return this.authService.getAccessToken(['https://management.azure.com/.default'])
      .pipe(
        map(token => new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        })),
        catchError(error => throwError(() => this.handleError(error)))
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

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_DURATION
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
    if (error.status === 403) {
      return new PermissionError(
        'Insufficient permissions to access this resource',
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }
    
    if (error.status === 401) {
      return new PermissionError(
        'Authentication required',
        'AUTHENTICATION_REQUIRED',
        401
      );
    }
    
    return new PermissionError(
      'Failed to fetch permissions',
      'API_ERROR',
      error.status
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}