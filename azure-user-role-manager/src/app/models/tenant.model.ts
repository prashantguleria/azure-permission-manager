export interface Tenant {
  id: string;
  displayName: string;
  defaultDomain: string;
  countryLetterCode: string;
  isDefault: boolean;
}

export interface TenantContext {
  selectedTenant: Tenant | null;
  availableTenants: Tenant[];
}