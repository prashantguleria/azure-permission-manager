import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const tenantGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // First check if user is authenticated
  if (!authService.isAuthenticated()) {
    console.log('User not authenticated, redirecting to login');
    router.navigate(['/app/login']);
    return false;
  }

  // Check if a tenant has been selected
  const selectedTenant = localStorage.getItem('selectedTenant');
  const currentTenantId = authService.getCurrentTenantId();
  
  if (!selectedTenant || !currentTenantId) {
    console.log('No tenant selected, redirecting to tenant selection');
    router.navigate(['/app/tenants']);
    return false;
  }

  try {
    const tenant = JSON.parse(selectedTenant);
    // Verify that the selected tenant matches the current authenticated tenant
    if (tenant.id !== currentTenantId) {
      console.log('Tenant mismatch, redirecting to tenant selection');
      localStorage.removeItem('selectedTenant');
      router.navigate(['/app/tenants']);
      return false;
    }
  } catch (error) {
    console.error('Error parsing selected tenant:', error);
    localStorage.removeItem('selectedTenant');
    router.navigate(['/app/tenants']);
    return false;
  }

  // Tenant is properly selected, allow access
  return true;
};