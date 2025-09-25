import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MsalService } from '@azure/msal-angular';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const msalService = inject(MsalService);

  console.log('Auth guard checking authentication for route:', state.url);
  
  // Check if we're in the middle of a redirect flow
  const isRedirectInProgress = sessionStorage.getItem('postTenantSwitchRedirect');
  if (isRedirectInProgress) {
    console.log('Redirect in progress, allowing navigation');
    return true;
  }

  // Get all accounts and active account
  const allAccounts = msalService.instance.getAllAccounts();
  const activeAccount = msalService.instance.getActiveAccount();
  
  console.log('Auth guard - All accounts:', allAccounts.length);
  console.log('Auth guard - Active account:', activeAccount?.username);

  // If we have accounts but no active account, try to recover authentication state
  if (!activeAccount && allAccounts.length > 0) {
    console.log('Attempting to recover authentication state with available accounts');
    
    // Check if we have a target tenant from recent tenant switch
    const targetTenantId = sessionStorage.getItem('targetTenantId');
    let accountToSet = allAccounts[0]; // Default to first account
    
    if (targetTenantId) {
      // Try to find account for the target tenant
      const tenantAccount = allAccounts.find(account => 
        account.tenantId === targetTenantId || 
        account.idTokenClaims?.tid === targetTenantId
      );
      if (tenantAccount) {
        accountToSet = tenantAccount;
        console.log('Found account for target tenant:', targetTenantId);
      }
    }
    
    msalService.instance.setActiveAccount(accountToSet);
    
    // Give the auth service a moment to update its state
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Check authentication status
  if (!authService.isAuthenticated()) {
    console.log('User not authenticated, redirecting to login');
    router.navigate(['/app/login']);
    return false;
  }

  // Check if user has selected a tenant (except for tenant selection page)
  if (!state.url.includes('/tenants')) {
    const selectedTenantStr = localStorage.getItem('selectedTenant');
    const currentUser = authService.getCurrentUser();
    

    
    // Parse and validate selected tenant
    let selectedTenant = null;
    if (selectedTenantStr) {
      try {
        selectedTenant = JSON.parse(selectedTenantStr);
        
      } catch (e) {
        
        localStorage.removeItem('selectedTenant'); // Remove invalid JSON
      }
    }
    
    // If we have a valid selected tenant, we're good to go
    if (selectedTenant && selectedTenant.id) {
      
      return true;
    }
    
    // If no valid selected tenant but we have a current user with tenant ID, auto-select it
    if ((!selectedTenant || !selectedTenant.id) && currentUser?.tenantId) {
      console.log('Auto-selecting current tenant:', currentUser.tenantId);
      const defaultTenant = {
        id: currentUser.tenantId,
        displayName: currentUser.tenantId,
        defaultDomain: `${currentUser.tenantId}.onmicrosoft.com`,
        countryLetterCode: 'US',
        isDefault: true
      };
      localStorage.setItem('selectedTenant', JSON.stringify(defaultTenant));
      return true;
    }
    
    // If we're in the middle of a tenant switch, allow navigation
    const targetTenantId = sessionStorage.getItem('targetTenantId');
    if (targetTenantId) {
      console.log('Auth guard - Tenant switch in progress, allowing navigation');
      return true;
    }
    
    // No tenant selected and no current user tenant, redirect to tenant selection
    console.log('No tenant selected, redirecting to tenant selection');
    router.navigate(['/app/tenants']);
    return false;
  }

  console.log('Auth guard - Authentication check passed');
  return true;
};
