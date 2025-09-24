export interface AppAuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: AuditAction;
  targetType: 'user' | 'storage_account' | 'lock';
  targetId: string;
  targetName: string;
  details: AuditDetails;
  reversible: boolean;
  reverted?: boolean;
  revertedAt?: Date;
}

export interface AuditDetails {
  // For permission operations
  roleId?: string;
  roleName?: string;
  assignmentId?: string;
  assignmentUrl?: string;
  principalId?: string;
  principalType?: string;
  roleDefinitionId?: string;
  
  // Lock operations
  lockLevel?: 'ReadOnly' | 'Delete';
  lockNotes?: string;
  lockId?: string;
  lockName?: string;
  originalLockId?: string;
  
  // For bulk operations
  totalRequests?: number;
  successful?: number;
  failed?: number;
  assignments?: any[];
  
  // Common details
  previousValue?: any;
  newValue?: any;
  additionalInfo?: string;
}

export type AuditAction = 
  | 'permission_added'
  | 'permission_removed'
  | 'permission_modified'
  | 'bulk_permissions_removed'
  | 'lock_added'
  | 'lock_created'
  | 'lock_removed'
  | 'lock_modified';

export interface AuditLogFilter {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: AuditAction;
  targetType?: 'user' | 'storage_account' | 'lock';
  reversible?: boolean;
  reverted?: boolean;
}

export interface RevertOperation {
  auditLogId: string;
  success: boolean;
  message: string;
  error?: any;
}