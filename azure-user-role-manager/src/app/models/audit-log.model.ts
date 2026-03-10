export interface AuditLog {
  id: string;
  activityDateTime: Date;
  activityDisplayName: string;
  category: string;
  correlationId: string;
  result: string;
  resultReason?: string;
  loggedByService: string;
  operationType: string;
  userAgent?: string;
  ipAddress?: string;
  initiatedBy: {
    user?: {
      id: string;
      displayName: string;
      userPrincipalName: string;
    };
    app?: {
      appId: string;
      displayName: string;
      servicePrincipalId: string;
    };
  };
  targetResources: Array<{
    id: string;
    displayName: string;
    type: string;
    userPrincipalName?: string;
    groupType?: string;
    modifiedProperties?: Array<{
      displayName: string;
      oldValue: string;
      newValue: string;
    }>;
  }>;
  additionalDetails: Array<{
    key: string;
    value: string;
  }>;
}

export interface AuditLogFilter {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  activityDisplayName?: string;
  initiatedBy?: string;
  targetResource?: string;
  result?: string;
  pageSize?: number;
}

export interface AuditLogResponse {
  '@odata.context': string;
  '@odata.nextLink'?: string;
  value: AuditLog[];
}