export interface User {
  id: string;
  displayName: string;
  email: string;
  mail?: string;
  userPrincipalName: string;
  isEnabled: boolean;
  accountEnabled?: boolean;
  businessPhones?: string[];
  mobilePhone?: string;
  officeLocation?: string;
  createdDate: Date;
  createdDateTime?: Date;
  lastSignInDate?: Date;
  jobTitle?: string;
  department?: string;
  principalType?: string; // Added to support service principals and groups
  appId?: string; // For service principals
  servicePrincipalType?: string; // For service principals
  description?: string; // For groups
}

export interface UserSearchResult {
  users: User[];
  totalCount: number;
  hasMore: boolean;
}

export interface RoleAssignment {
  id: string;
  roleId: string;
  roleName: string;
  roleDescription?: string;
  roleType?: string;
  scope: string;
  scopeName?: string;
  scopeType?: string;
  principalId: string;
  assignedDate: Date;
}

export interface RoleRemovalRequest {
  assignmentId: string;
}

export interface RoleRemovalResult {
  success: boolean;
  assignmentId: string;
  message: string;
  error?: any;
}

export interface Principal {
  id: string;
  displayName: string;
  email?: string;
  userPrincipalName?: string;
  principalType: 'User' | 'ServicePrincipal' | 'Group';
  isEnabled?: boolean;
  createdDate?: Date;
  appId?: string;
  appDisplayName?: string;
  servicePrincipalType?: string;
  description?: string;
}

export interface PrincipalSearchResult {
  principals: Principal[];
  totalCount: number;
  hasMore: boolean;
}