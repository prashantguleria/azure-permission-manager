import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult, InteractionStatus, PopupRequest, RedirectRequest, SilentRequest } from '@azure/msal-browser';
import { Observable, BehaviorSubject, filter, takeUntil, Subject } from 'rxjs';
import { Tenant } from '../models/tenant.model';
import { getTenantSpecificConfig } from '../msal.config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly _destroying$ = new Subject<void>();
  private _isAuthenticated = new BehaviorSubject<boolean>(false);
  private _currentUser = new BehaviorSubject<AccountInfo | null>(null);
  private _availableTenants = new BehaviorSubject<Tenant[]>([]);
  private _tenantChanged = new Subject<string>();
  private _tenantTokenCache = new Map<string, { token: string; expiry: number; scopes: string[] }>();

  public isAuthenticated$ = this._isAuthenticated.asObservable();
  public currentUser$ = this._currentUser.asObservable();
  public availableTenants$ = this._availableTenants.asObservable();
  public tenantChanged$ = this._tenantChanged.asObservable();

  constructor(
    private msalService: MsalService,
    private msalBroadcastService: MsalBroadcastService,
    private router: Router
  ) {
    // Authentication initialization is now handled by app.component.ts
  }

  initializeAuth(): Observable<boolean> {
    return new Observable(observer => {
      console.log('Initializing authentication...');
      
      // Always handle redirect promise first, even if we have an existing account
      // This is crucial for tenant switching scenarios
      this.msalService.handleRedirectObservable()
        .pipe(takeUntil(this._destroying$))
        .subscribe({
          next: (result: AuthenticationResult | null) => {
            console.log('handleRedirectPromise result:', result);
            
            if (result) {
              console.log('Authentication successful via redirect for account:', result.account?.username);
              console.log('Tenant ID:', result.account?.tenantId);
              
              // Set the active account from the redirect result
              this.msalService.instance.setActiveAccount(result.account);
              this.checkAndSetActiveAccount();
              
              observer.next(true);
              observer.complete();
              return;
            }
            
            // No redirect result, implement account recovery logic
            this.recoverAuthenticationState(observer);
          },
          error: (error) => {
            console.error('Error handling redirect:', error);
            // Even on error, try to recover authentication state
            this.recoverAuthenticationState(observer);
          }
        });
    });
  }

  private recoverAuthenticationState(observer: any): void {
    console.log('Attempting to recover authentication state...');
    
    // First attempt: Check for existing active account
    let existingAccount = this.msalService.instance.getActiveAccount();
    const allAccounts = this.msalService.instance.getAllAccounts();
    
    console.log('Recovery - Active account:', existingAccount?.username);
    console.log('Recovery - All accounts count:', allAccounts.length);
    
    if (existingAccount) {
      console.log('Found existing active account:', existingAccount.username);
      this.checkAndSetActiveAccount();
      observer.next(true);
      observer.complete();
      return;
    }
    
    if (allAccounts.length > 0) {
      console.log('No active account but found', allAccounts.length, 'cached accounts');
      
      // Try to set an appropriate account as active
      this.checkAndSetActiveAccount();
      
      // Verify if we now have an active account
      existingAccount = this.msalService.instance.getActiveAccount();
      if (existingAccount) {
        console.log('Successfully recovered authentication with account:', existingAccount.username);
        observer.next(true);
        observer.complete();
        return;
      }
    }
    
    // Try to recover from backup accounts if available
    const accountBackup = sessionStorage.getItem('accountBackup');
    if (accountBackup) {
      try {
        const backupAccounts = JSON.parse(accountBackup);
        console.log('Found account backup with', backupAccounts.length, 'accounts');
        
        // This indicates accounts existed before but were lost
        // The user needs to re-authenticate, but we can provide better error messaging
        console.log('Accounts were previously available but are now missing - cache may have been cleared');
        
        // Clear the backup since it's no longer valid
        sessionStorage.removeItem('accountBackup');
      } catch (error) {
        console.error('Error parsing account backup:', error);
        sessionStorage.removeItem('accountBackup');
      }
    }
    
    // If we still don't have an account, implement retry logic
    console.log('No accounts found, implementing retry logic...');
    
    // Add a small delay and retry once more (sometimes MSAL needs time to populate cache)
    setTimeout(() => {
      const retryAccounts = this.msalService.instance.getAllAccounts();
      console.log('Retry - Found', retryAccounts.length, 'accounts after delay');
      
      if (retryAccounts.length > 0) {
        console.log('Retry successful - setting active account');
        this.checkAndSetActiveAccount();
        observer.next(true);
      } else {
        console.log('No authenticated accounts found after retry, authentication failed');
        this.checkAndSetActiveAccount(); // This will set auth state to false
        observer.next(false);
      }
      observer.complete();
    }, 500); // 500ms delay for retry
  }

  private checkAndSetActiveAccount(): void {
    const activeAccount = this.msalService.instance.getActiveAccount();
    const allAccounts = this.msalService.instance.getAllAccounts();
    const currentUser = this._currentUser.value;
    
    console.log('checkAndSetActiveAccount - Active account:', activeAccount?.username);
    console.log('checkAndSetActiveAccount - All accounts count:', allAccounts.length);
    
    // Check if we're targeting a specific tenant after switch
    // Get target tenant ID at the beginning
    const targetTenantId = sessionStorage.getItem('targetTenantId');    
    if (!activeAccount && allAccounts.length > 0) {
      console.log('No active account but accounts exist, selecting appropriate account');
      
      let accountToSet = allAccounts[0]; // Default to first account
      
      // If we have a target tenant, try to find an account for that tenant
      if (targetTenantId) {
        const targetAccount = allAccounts.find(acc => acc.tenantId === targetTenantId);
        if (targetAccount) {
          accountToSet = targetAccount;
          console.log('Found account for target tenant:', targetTenantId);
          sessionStorage.removeItem('targetTenantId'); // Clear after use
        }
      }
      
      console.log('Setting active account:', accountToSet.username, 'Tenant:', accountToSet.tenantId);
      
      // Check if tenant changed
      const previousTenantId = currentUser?.tenantId;
      
      if ((previousTenantId && previousTenantId !== accountToSet.tenantId) || 
          (targetTenantId && targetTenantId === accountToSet.tenantId)) {
        console.log('Tenant changed from', previousTenantId, 'to', accountToSet.tenantId);
        
        // Update localStorage with new tenant information
        const newTenant = {
          id: accountToSet.tenantId,
          displayName: accountToSet.tenantId,
          defaultDomain: `${accountToSet.tenantId}.onmicrosoft.com`,
          countryLetterCode: 'US',
          isDefault: true
        };
        localStorage.setItem('selectedTenant', JSON.stringify(newTenant));
        console.log('Updated selectedTenant in localStorage for new tenant:', accountToSet.tenantId);
        
        // Trigger tenant change notification
        this._tenantChanged.next(accountToSet.tenantId);
        
        // Clear target tenant ID after successful switch
        if (targetTenantId) {
          sessionStorage.removeItem('targetTenantId');
        }
      }
      
      this.msalService.instance.setActiveAccount(accountToSet);
      this._currentUser.next(accountToSet);
      this._isAuthenticated.next(true);
    } else if (activeAccount) {
      console.log('Active account found:', activeAccount.username, 'Tenant:', activeAccount.tenantId);
      
      // Check if tenant changed
      const previousTenantId = currentUser?.tenantId;
      
      if ((previousTenantId && previousTenantId !== activeAccount.tenantId) || 
          (targetTenantId && targetTenantId === activeAccount.tenantId)) {
        console.log('Tenant changed from', previousTenantId, 'to', activeAccount.tenantId);
        
        // Update localStorage with new tenant information
        const newTenant = {
          id: activeAccount.tenantId,
          displayName: activeAccount.tenantId,
          defaultDomain: `${activeAccount.tenantId}.onmicrosoft.com`,
          countryLetterCode: 'US',
          isDefault: true
        };
        localStorage.setItem('selectedTenant', JSON.stringify(newTenant));
        console.log('Updated selectedTenant in localStorage for new tenant:', activeAccount.tenantId);
        
        // Trigger tenant change notification
        this._tenantChanged.next(activeAccount.tenantId);
        
        // Clear target tenant ID after successful switch
        if (targetTenantId) {
          sessionStorage.removeItem('targetTenantId');
        }
      }
      
      this._currentUser.next(activeAccount);
      this._isAuthenticated.next(true);
      
      // Clear target tenant if we have an active account
      if (targetTenantId) {
        sessionStorage.removeItem('targetTenantId');
      }
    } else {
      console.log('No accounts found, setting authentication state to false');
      this._isAuthenticated.next(false);
      this._currentUser.next(null);
      
      // Don't clear targetTenantId here as we might be in the middle of authentication
    }
  }

  login(): void {
    const loginRequest: RedirectRequest = {
      scopes: ['user.read', 'Directory.Read.All', 'RoleManagement.ReadWrite.Directory'],
      prompt: 'select_account'
    };

    this.msalService.loginRedirect(loginRequest);
  }

  logout(): void {
    this.msalService.logoutRedirect({
      postLogoutRedirectUri: 'http://localhost:4200'
    });
  }

  getAccessToken(scopes: string[]): Observable<string> {
    return new Observable(observer => {
      const account = this.msalService.instance.getActiveAccount();
      if (!account) {
        observer.error('No active account');
        return;
      }

      // Check cache first for tenant-specific token
      const tenantId = account.tenantId;
      const cacheKey = `${tenantId}_${scopes.sort().join(',')}`;
      const cachedToken = this._tenantTokenCache.get(cacheKey);
      
      if (cachedToken && cachedToken.expiry > Date.now()) {
        observer.next(cachedToken.token);
        observer.complete();
        return;
      }

      const silentRequest: SilentRequest = {
        scopes: scopes,
        account: account
      };

      this.msalService.acquireTokenSilent(silentRequest)
        .subscribe({
          next: (result: AuthenticationResult) => {
            // Cache the token with tenant context
            this.cacheTokenForTenant(tenantId, result.accessToken, scopes, result.expiresOn || undefined);
            observer.next(result.accessToken);
            observer.complete();
          },
          error: (error) => {
            // If silent request fails, try interactive request
            const interactiveRequest: PopupRequest = {
              scopes: scopes,
              account: account
            };
            
            this.msalService.acquireTokenPopup(interactiveRequest)
              .subscribe({
                next: (result: AuthenticationResult) => {
                  // Cache the token with tenant context
                  this.cacheTokenForTenant(tenantId, result.accessToken, scopes, result.expiresOn || undefined);
                  observer.next(result.accessToken);
                  observer.complete();
                },
                error: (interactiveError) => {
                  observer.error(interactiveError);
                }
              });
          }
        });
    });
  }

  getCurrentUser(): AccountInfo | null {
    return this.msalService.instance.getActiveAccount();
  }

  isAuthenticated(): boolean {
    return this.msalService.instance.getActiveAccount() !== null;
  }

  async switchTenant(tenantId: string): Promise<void> {
    try {
      console.log('Switching to tenant:', tenantId);
      
      // Store the target tenant ID for account recovery
      sessionStorage.setItem('targetTenantId', tenantId);
      sessionStorage.setItem('postTenantSwitchRedirect', '/user-management');
      
      // Get current accounts before clearing cache
      const currentAccounts = this.msalService.instance.getAllAccounts();
      console.log('Accounts before tenant switch:', currentAccounts.length);
      
      // Store account information in session storage as backup
      if (currentAccounts.length > 0) {
        const accountBackup = currentAccounts.map(account => ({
          username: account.username,
          homeAccountId: account.homeAccountId,
          tenantId: account.tenantId,
          localAccountId: account.localAccountId
        }));
        sessionStorage.setItem('accountBackup', JSON.stringify(accountBackup));
        console.log('Account backup stored:', accountBackup.length, 'accounts');
      }
      
      // Instead of clearing cache, just clear our internal token cache
      // This preserves MSAL accounts while clearing our cached tokens
      this.clearTenantTokenCache();
      console.log('Internal token cache cleared, MSAL accounts preserved');
      
      // Verify accounts are still available
      const accountsAfterClear = this.msalService.instance.getAllAccounts();
      console.log('Accounts after cache clear:', accountsAfterClear.length);
      
      // Update the authority for the new tenant
      const tenantConfig = getTenantSpecificConfig(tenantId);
      
      // Perform login redirect for the new tenant
      const loginRequest = {
        scopes: ['user.read', 'Directory.Read.All', 'RoleManagement.ReadWrite.Directory'],
        authority: tenantConfig.auth.authority,
        redirectUri: tenantConfig.auth.redirectUri,
        prompt: 'select_account'
      };
      
      await this.msalService.instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Error switching tenant:', error);
      sessionStorage.removeItem('targetTenantId');
      sessionStorage.removeItem('postTenantSwitchRedirect');
      sessionStorage.removeItem('accountBackup');
      throw error;
    }
  }

  getCurrentTenantId(): string | null {
    const account = this.getCurrentUser();
    return account?.tenantId || null;
  }

  private cacheTokenForTenant(tenantId: string, token: string, scopes: string[], expiresOn?: Date): void {
    const cacheKey = `${tenantId}_${scopes.sort().join(',')}`;
    const expiry = expiresOn ? expiresOn.getTime() - (5 * 60 * 1000) : Date.now() + (55 * 60 * 1000); // 5 min buffer or 55 min default
    
    this._tenantTokenCache.set(cacheKey, {
      token,
      expiry,
      scopes: [...scopes]
    });
  }

  clearTenantTokenCache(tenantId?: string): void {
    if (tenantId) {
      // Clear tokens for specific tenant
      const keysToDelete = Array.from(this._tenantTokenCache.keys())
        .filter(key => key.startsWith(`${tenantId}_`));
      keysToDelete.forEach(key => this._tenantTokenCache.delete(key));
    } else {
      // Clear all cached tokens
      this._tenantTokenCache.clear();
    }
  }

  getTokenForTenant(tenantId: string, scopes: string[]): Observable<string> {
    return new Observable(observer => {
      // Check if we have an account for this tenant
      const accounts = this.msalService.instance.getAllAccounts();
      const tenantAccount = accounts.find(account => account.tenantId === tenantId);
      
      if (!tenantAccount) {
        observer.error(`No account found for tenant: ${tenantId}`);
        return;
      }

      // Check cache first
      const cacheKey = `${tenantId}_${scopes.sort().join(',')}`;
      const cachedToken = this._tenantTokenCache.get(cacheKey);
      
      if (cachedToken && cachedToken.expiry > Date.now()) {
        observer.next(cachedToken.token);
        observer.complete();
        return;
      }

      // Acquire token for specific tenant account
      const silentRequest: SilentRequest = {
        scopes: scopes,
        account: tenantAccount,
        authority: `https://login.microsoftonline.com/${tenantId}`
      };

      this.msalService.acquireTokenSilent(silentRequest)
        .subscribe({
          next: (result: AuthenticationResult) => {
            this.cacheTokenForTenant(tenantId, result.accessToken, scopes, result.expiresOn || undefined);
            observer.next(result.accessToken);
            observer.complete();
          },
          error: (error) => {
            console.error(`Failed to acquire token for tenant ${tenantId}:`, error);
            observer.error(error);
          }
        });
    });
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
    this.clearTenantTokenCache();
  }
}
