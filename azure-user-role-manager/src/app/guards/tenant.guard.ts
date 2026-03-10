import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const tenantGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // First check if user is authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/app/login']);
    return false;
  }

  // Check if a tenant has been selected
  const selectedTenant = localStorage.getItem('selectedTenant');
  const currentTenantId = authService.getCurrentTenantId();
  
  if (!selectedTenant || !currentTenantId) {
    router.navigate(['/app/tenants']);
    return false;
  }

  try {
    const tenant = JSON.parse(selectedTenant);
    if (!tenant || !tenant.id) {
      localStorage.removeItem('selectedTenant');
      router.navigate(['/app/tenants']);
      return false;
    }
    // If there's a mismatch between stored tenant and MSAL active account tenant,
    // trust the stored tenant — this can happen on refresh when MSAL picks a
    // different cached account. The auth service will resolve the correct account.
  } catch (error) {
    console.error('Error parsing selected tenant:', error);
    localStorage.removeItem('selectedTenant');
    router.navigate(['/app/tenants']);
    return false;
  }

  // Tenant is properly selected, allow access
  return true;
};