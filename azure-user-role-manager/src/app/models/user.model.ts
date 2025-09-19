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