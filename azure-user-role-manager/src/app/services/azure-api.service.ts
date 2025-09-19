import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { User, UserSearchResult, RoleAssignment, RoleRemovalRequest, RoleRemovalResult } from '../models/user.model';
import { Tenant } from '../models/tenant.model';
import { AuditLog, AuditLogFilter } from '../models/audit.model';

@Injectable({
  providedIn: 'root'
})
export class AzureApiService {
  private readonly graphApiUrl = 'https://graph.microsoft.com/v1.0';
  private readonly betaApiUrl = 'https://graph.microsoft.com/beta';
  private readonly managementApiUrl = 'https://management.azure.com';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): Observable<HttpHeaders> {
    return this.authService.getAccessToken(['https://graph.microsoft.com/.default'])
      .pipe(
        map(token => new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        })),
        catchError(error => {
          console.error('Failed to get access token:', error);
          return throwError(() => error);
        })
      );
  }

  private getManagementAuthHeaders(): Observable<HttpHeaders> {
    return this.authService.getAccessToken(['https://management.azure.com/.default'])
      .pipe(
        map(token => new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        })),
        catchError(error => {
          console.error('Failed to get management API access token:', error);
          return throwError(() => error);
        })
      );
  }

  // Tenant Operations
  switchToTenant(tenantId: string): Observable<boolean> {
    console.log(`Switching to tenant: ${tenantId}`);
    
    // Check if we're already authenticated to this tenant
    const currentTenantId = this.authService.getCurrentTenantId();
    if (currentTenantId === tenantId) {
      console.log('Already authenticated to this tenant');
      return of(true);
    }
    
    // Use auth service to switch tenant with re-authentication
    return this.authService.switchTenant(tenantId);
  }

  getTenants(): Observable<Tenant[]> {
    return this.getManagementAuthHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.managementApiUrl}/tenants?api-version=2022-12-01`, { headers })
      ),
      map(response => {
        const currentTenantId = this.authService.getCurrentTenantId();
        const tenants = response.value.map((tenant: any) => ({
          id: tenant.tenantId,
          displayName: tenant.displayName || tenant.defaultDomain || tenant.tenantId,
          defaultDomain: tenant.defaultDomain || `${tenant.tenantId}.onmicrosoft.com`,
          countryLetterCode: tenant.countryCode || 'US',
          isDefault: tenant.tenantId === currentTenantId
        }));
        
        return tenants;
      }),
      catchError(error => {
        console.error('Failed to get tenants from Azure Management API:', error);
        // Fallback to Graph API organization endpoint if Management API fails
        return this.getAuthHeaders().pipe(
          switchMap(headers => 
            this.http.get<any>(`${this.graphApiUrl}/organization`, { headers })
          ),
          map(response => {
            return response.value.map((org: any) => ({
              id: org.id,
              displayName: org.displayName,
              defaultDomain: org.verifiedDomains?.find((d: any) => d.isDefault)?.name || org.id,
              countryLetterCode: org.countryLetterCode || 'US',
              isDefault: true
            }));
          })
        );
      })
    );
  }

  // User Operations
  searchUsers(query: string, top: number = 25, skip: number = 0): Observable<UserSearchResult> {
    let params = new HttpParams()
      .set('$top', top.toString())
      .set('$select', 'id,displayName,mail,userPrincipalName,accountEnabled,createdDateTime');
    
    // Use $filter instead of $search for better compatibility
    if (query) {
      const filterQuery = `startswith(displayName,'${query}') or startswith(mail,'${query}') or startswith(userPrincipalName,'${query}')`;
      params = params.set('$filter', filterQuery);
      // Note: $orderby is not supported with $filter queries in Microsoft Graph API
    } else {
      // Only add orderby when not filtering
      params = params.set('$orderby', 'displayName');
    }

    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}/users`, { 
          headers, 
          params 
        })
      ),
      map(response => ({
        users: response.value.map((user: any) => ({
          id: user.id,
          displayName: user.displayName,
          email: user.mail || user.userPrincipalName,
          userPrincipalName: user.userPrincipalName,
          isEnabled: user.accountEnabled,
          createdDate: new Date(user.createdDateTime)
        })),
        totalCount: response['@odata.count'] || response.value.length,
        hasMore: !!response['@odata.nextLink']
      })),
      catchError(error => {
        console.error('Failed to search users:', error);
        return throwError(() => error);
      })
    );
  }

  getUserById(userId: string): Observable<User> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}/users/${userId}`, { 
          headers,
          params: new HttpParams().set('$select', 'id,displayName,mail,userPrincipalName,accountEnabled,createdDateTime,department,jobTitle')
        })
      ),
      map(user => ({
        id: user.id,
        displayName: user.displayName,
        email: user.mail || user.userPrincipalName,
        userPrincipalName: user.userPrincipalName,
        isEnabled: user.accountEnabled,
        createdDate: new Date(user.createdDateTime),
        department: user.department,
        jobTitle: user.jobTitle
      })),
      catchError(error => {
        console.error('Failed to get user:', error);
        return throwError(() => error);
      })
    );
  }

  // Role Operations
  getUserRoleAssignments(userId: string): Observable<RoleAssignment[]> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}/roleManagement/directory/roleAssignments`, {
          headers,
          params: new HttpParams()
            .set('$filter', `principalId eq '${userId}'`)
            .set('$expand', 'roleDefinition')
        })
      ),
      map(response => {
        return response.value.map((assignment: any) => ({
          id: assignment.id,
          roleId: assignment.roleDefinitionId,
          roleName: assignment.roleDefinition?.displayName || 'Unknown Role',
          roleDescription: assignment.roleDefinition?.description || '',
          assignedDate: new Date(assignment.createdDateTime),
          assignmentType: assignment.directoryScopeId === '/' ? 'Directory' : 'Scoped',
          scope: assignment.directoryScopeId || '/'
        }));
      }),
      catchError(error => {
        console.error('Failed to get user role assignments:', error);
        return throwError(() => error);
      })
    );
  }

  removeUserRole(request: RoleRemovalRequest): Observable<RoleRemovalResult> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.delete(`${this.graphApiUrl}/roleManagement/directory/roleAssignments/${request.assignmentId}`, { headers })
      ),
      map(() => ({
        success: true,
        assignmentId: request.assignmentId,
        message: 'Role removed successfully'
      })),
      catchError(error => {
        console.error('Failed to remove user role:', error);
        return of({
          success: false,
          assignmentId: request.assignmentId,
          message: error.error?.error?.message || 'Failed to remove role',
          error: error.error
        });
      })
    );
  }

  // Audit Operations
  getAuditLogs(filter?: AuditLogFilter): Observable<AuditLog[]> {
    let params = new HttpParams()
      .set('$top', (filter?.pageSize || 50).toString())
      .set('$orderby', 'activityDateTime desc');

    if (filter?.startDate) {
      params = params.set('$filter', `activityDateTime ge ${filter.startDate.toISOString()}`);
    }

    if (filter?.endDate) {
      const existingFilter = params.get('$filter');
      const dateFilter = `activityDateTime le ${filter.endDate.toISOString()}`;
      params = params.set('$filter', existingFilter ? `${existingFilter} and ${dateFilter}` : dateFilter);
    }

    return this.getAuthHeaders().pipe(
      switchMap(headers => 
        this.http.get<any>(`${this.graphApiUrl}/auditLogs/directoryAudits`, { headers, params })
      ),
      map(response => {
        return response.value.map((log: any) => ({
          id: log.id,
          activityDisplayName: log.activityDisplayName,
          activityDateTime: new Date(log.activityDateTime),
          loggedByService: log.loggedByService,
          operationType: log.operationType,
          initiatedBy: {
            user: log.initiatedBy?.user ? {
              displayName: log.initiatedBy.user.displayName,
              userPrincipalName: log.initiatedBy.user.userPrincipalName
            } : undefined,
            app: log.initiatedBy?.app ? {
              displayName: log.initiatedBy.app.displayName,
              appId: log.initiatedBy.app.appId
            } : undefined
          },
          targetResources: log.targetResources?.map((target: any) => ({
            displayName: target.displayName,
            type: target.type,
            userPrincipalName: target.userPrincipalName
          })) || [],
          result: log.result,
          resultReason: log.resultReason
        }));
      }),
      catchError(error => {
        console.error('Failed to get audit logs:', error);
        return throwError(() => error);
      })
    );
  }

  exportAuditLogs(filter?: AuditLogFilter): Observable<Blob> {
    return this.getAuditLogs(filter).pipe(
      map(logs => {
        const csvContent = this.convertToCSV(logs);
        return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      })
    );
  }

  private convertToCSV(logs: AuditLog[]): string {
    const headers = ['Date', 'Activity', 'User', 'Target', 'Result', 'Service'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.activityDateTime?.toISOString() || '',
        `"${log.activityDisplayName || ''}"`,
        `"${log.initiatedBy?.user?.displayName || log.initiatedBy?.app?.displayName || 'System'}"`,
        `"${log.targetResources?.map(t => t.displayName).join('; ') || ''}"`,
        log.result || '',
        log.loggedByService || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}
