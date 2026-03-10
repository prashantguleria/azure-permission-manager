export interface AuditLog {
  id: string;
  timestamp: Date;
  adminUserId: string;
  adminEmail: string;
  tenantId: string;
  affectedUserId: string;
  affectedUserEmail: string;
  actionType: 'ROLE_REMOVED' | 'ROLE_ADDED';
  roleDetails: {
    roleDefinitionId: string;
    scope: string;
    roleName?: string;
    resourceScope?: string;
  };
  status: 'SUCCESS' | 'FAILED';
  resourceScope?: string;
  roleName?: string;
  result?: string;
  loggedByService?: string;
  ipAddress?: string;
  details?: string;
  activityDateTime?: Date;
  activityDisplayName?: string;
  userDisplayName?: string;
  userPrincipalName?: string;
  targetResource?: string;
  resourceType?: string;
  activity?: string;
  userAgent?: string;
  initiatedBy?: {
    user?: { displayName?: string };
    app?: { displayName?: string };
  };
  targetResources?: Array<{ displayName?: string }>;
}

export interface AuditLogFilter {
  startDate?: Date;
  endDate?: Date;
  adminEmail?: string;
  affectedUserEmail?: string;
  actionType?: string;
  activityType?: string;
  user?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogExportRequest {
  format: 'json' | 'csv';
  filter?: AuditLogFilter;
}