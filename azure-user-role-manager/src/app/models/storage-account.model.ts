export interface StorageAccount {
  id: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  subscriptionId: string;
  properties: {
    primaryEndpoints?: {
      blob?: string;
      file?: string;
      queue?: string;
      table?: string;
    };
    creationTime: string;
    provisioningState: string;
    accountType?: string;
    accessTier?: string;
    supportsHttpsTrafficOnly?: boolean;
  };
  tags?: { [key: string]: string };
}

export interface StorageAccountPermission {
  storageAccount: StorageAccount;
  roleAssignments: StorageAccountRoleAssignment[];
}

export interface StorageAccountRoleAssignment {
  id: string;
  name: string;
  type: string;
  properties: {
    roleDefinitionId: string;
    roleDefinitionName: string;
    principalId: string;
    principalType: string;
    principalDisplayName?: string;
    principalEmail?: string;
    scope: string;
    createdOn: string;
    updatedOn: string;
  };
}

export interface StorageAccountFilter {
  subscriptionId?: string;
  resourceGroup?: string;
  searchQuery?: string;
  location?: string;
  accountType?: string;
  roleType?: string;
}

export interface StorageAccountSummary {
  totalStorageAccounts: number;
  totalRoleAssignments: number;
  storageAccountsByLocation: { [location: string]: number };
  roleDistribution: { [roleName: string]: number };
  recentAssignments: RecentStorageAssignment[];
}

export interface RecentStorageAssignment {
  storageAccountName: string;
  principalName: string;
  roleName: string;
  assignedDate: Date;
  resourceGroup: string;
}

export class StorageAccountError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'StorageAccountError';
  }
}