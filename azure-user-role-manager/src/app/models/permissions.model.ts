export interface UserPermissions {
  directoryRoles: DirectoryRole[];
  appRoles: AppRoleAssignment[];
  rbacRoles: AzureRoleAssignment[];
  subscriptions: Subscription[];
}

export interface DirectoryRole {
  id: string;
  displayName: string;
  description?: string;
  roleTemplateId: string;
  isBuiltIn: boolean;
}

export interface AppRoleAssignment {
  id: string;
  appRoleId: string;
  principalId: string;
  principalType: string;
  resourceId: string;
  resourceDisplayName: string;
  appDisplayName?: string;
  appRoleDisplayName?: string;
  appRoleDescription?: string;
  createdDateTime: string;
}

export interface AzureRoleAssignment {
  id: string;
  name: string;
  type: string;
  properties: {
    roleDefinitionId: string;
    roleDefinitionName?: string;
    principalId: string;
    principalType: string;
    scope: string;
    scopeDisplayName?: string;
    scopeType?: 'Subscription' | 'ResourceGroup' | 'Resource';
    createdOn: string;
    updatedOn: string;
  };
}

export interface Subscription {
  subscriptionId: string;
  displayName: string;
  state: string;
  tenantId?: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  type: string;
  properties: {
    roleName: string;
    description: string;
    type: string;
    permissions: Permission[];
    assignableScopes: string[];
  };
}

export interface Permission {
  actions: string[];
  notActions: string[];
  dataActions: string[];
  notDataActions: string[];
}

export interface PermissionSummary {
  totalDirectoryRoles: number;
  totalAppRoles: number;
  totalRbacRoles: number;
  totalSubscriptions: number;
  highPrivilegeRoles: string[];
  recentAssignments: RecentAssignment[];
}

export interface RecentAssignment {
  roleName: string;
  resourceName: string;
  assignedDate: Date;
  type: 'Directory' | 'Application' | 'RBAC';
}

export interface PermissionFilter {
  permissionType?: 'all' | 'directory' | 'application' | 'rbac';
  subscriptionId?: string;
  resourceGroup?: string;
  searchQuery?: string;
  roleType?: 'builtin' | 'custom' | 'all';
}

export interface PermissionExportData {
  userId: string;
  userDisplayName: string;
  userEmail: string;
  permissions: UserPermissions;
  exportDate: Date;
  tenantId: string;
}

export class PermissionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}