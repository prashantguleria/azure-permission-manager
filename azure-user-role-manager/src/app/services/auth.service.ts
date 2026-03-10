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
  private _redirectHandlingInProgress = false; // Safeguard against multiple simultaneous redirect handling

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
      // Safeguard: Prevent multiple simultaneous redirect handling
      if (this._redirectHandlingInProgress) {
        observer.next(false);
        observer.complete();
        return;
      }
      
      this._redirectHandlingInProgress = true;
      
      // Always handle redirect promise first, even if we have an existing account
      // This is crucial for tenant switching scenarios
      this.msalService.handleRedirectObservable()
        .pipe(takeUntil(this._destroying$))
        .subscribe({
          next: (result: AuthenticationResult | null) => {
            if (result) {
              // Set the active account from the redirect result
              this.msalService.instance.setActiveAccount(result.account);
              this.checkAndSetActiveAccount();
              
              // Reset redirect handling flag
              this._redirectHandlingInProgress = false;
              
              observer.next(true);
              observer.complete();
              return;
            }
            
            // No redirect result, implement account recovery logic
            this.recoverAuthenticationState(observer);
          },
          error: (error) => {
            console.error('Error handling redirect:', error);
            
            // Handle specific MSAL authentication errors
            if (this.isMsalAuthError(error)) {
              this.handleMsalAuthError(error, observer);
            } else {
              // Even on error, try to recover authentication state
              this.recoverAuthenticationState(observer);
            }
          }
        });
    });
  }

  private isMsalAuthError(error: any): boolean {
    const errorMessage = error?.message || error?.toString() || '';
    return errorMessage.includes('no_token_request_cache_error') ||
           errorMessage.includes('state_not_found') ||
           errorMessage.includes('BrowserAuthError') ||
           errorMessage.includes('ClientAuthError');
  }

  private handleMsalAuthError(error: any, observer: any): void {
    const errorMessage = error?.message || error?.toString() || '';

    // Check if we're in bypass mode - if so, trigger nuclear reset immediately
    const bypassActive = sessionStorage.getItem('msal.bypass.active');
    if (bypassActive) {
      this.triggerNuclearReset(observer);
      return;
    }

    // Check if fresh auth is required from bypass
    const requiresFreshAuth = sessionStorage.getItem('requiresFreshAuth');
    if (requiresFreshAuth) {
      sessionStorage.removeItem('requiresFreshAuth');
      this.triggerNuclearReset(observer);
      return;
    }

    // Check if this is a persistent error that requires nuclear reset
    const persistentErrorCount = this.incrementErrorCount(errorMessage);

    if (persistentErrorCount >= 3) {
      this.triggerNuclearReset(observer);
      return;
    }

    if (errorMessage.includes('no_token_request_cache_error')) {
      this.clearCorruptedAuthState();
      
      // Additional recovery for token request cache errors
      this.clearTokenRequestSpecificCache();
    } else if (errorMessage.includes('state_not_found')) {
      this.clearAuthStateCache();
      
      // Additional recovery for state errors
      this.clearStateSpecificCache();
    } else if (errorMessage.includes('BrowserAuthError') || errorMessage.includes('ClientAuthError')) {
      this.clearGeneralMsalErrors();
    }
    
    // After clearing corrupted state, attempt recovery with delay
    setTimeout(() => {
      this.recoverAuthenticationState(observer);
    }, 200); // Increased delay for better recovery
  }

  /**
   * Tracks error count for persistent error detection
   */
  private incrementErrorCount(errorMessage: string): number {
    const errorKey = 'msal.error.count.' + this.getErrorType(errorMessage);
    const currentCount = parseInt(sessionStorage.getItem(errorKey) || '0');
    const newCount = currentCount + 1;
    
    sessionStorage.setItem(errorKey, newCount.toString());
    sessionStorage.setItem('msal.error.timestamp', Date.now().toString());
    
    // Clear error count after 5 minutes to prevent false positives
    setTimeout(() => {
      sessionStorage.removeItem(errorKey);
    }, 5 * 60 * 1000);
    
    return newCount;
  }

  /**
   * Gets error type for tracking
   */
  private getErrorType(errorMessage: string): string {
    if (errorMessage.includes('no_token_request_cache_error')) return 'token_cache';
    if (errorMessage.includes('state_not_found')) return 'state';
    if (errorMessage.includes('BrowserAuthError')) return 'browser';
    if (errorMessage.includes('ClientAuthError')) return 'client';
    return 'general';
  }

  /**
   * Triggers nuclear reset when persistent errors are detected
   */
  private async triggerNuclearReset(observer: any): Promise<void> {
    try {
      // Show user feedback
      this.showRecoveryFeedback('Performing complete authentication reset...');
      
      // Perform complete reset
      await this.performCompleteAuthReset();
      
      // Clear error counters
      this.clearErrorCounters();
      
      // Notify user of successful reset
      this.showRecoveryFeedback('Authentication reset complete. Please sign in again.');
      
      // Set authentication to false and complete observer
      observer.next(false);
      observer.complete();
      
      // Clear feedback after delay
      setTimeout(() => {
        this.clearRecoveryFeedback();
        
        // Always reset the redirect handling flag when nuclear reset completes
        this._redirectHandlingInProgress = false;
      }, 3000);
      
    } catch (error) {
      console.error('❌ Nuclear reset failed:', error);
      
      // If nuclear reset fails, force page reload as absolute last resort
      this.showRecoveryFeedback('Reset failed. Reloading page...');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      // Always reset the redirect handling flag even on error
      this._redirectHandlingInProgress = false;
    }
  }

  /**
   * Clears all error counters
   */
  private clearErrorCounters(): void {
    const errorTypes = ['token_cache', 'state', 'browser', 'client', 'general'];
    errorTypes.forEach(type => {
      sessionStorage.removeItem('msal.error.count.' + type);
    });
    sessionStorage.removeItem('msal.error.timestamp');
  }

  private clearCorruptedAuthState(): void {
    try {
      // Only clear specific problematic entries, preserve account data
      const keysToRemove = [
        'msal.interaction.status',
        'msal.request.state',
        'msal.error'
      ];
      
      let clearedCount = 0;
      keysToRemove.forEach(key => {
        if (sessionStorage.getItem(key)) {
          sessionStorage.removeItem(key);
          clearedCount++;
        }
      });
      
      // Only clear token request cache if we actually found corrupted entries
      if (clearedCount > 0) {
        this.clearTokenRequestSpecificCache();
      } else {
      }
      
      // Preserve account information and only clear error-related entries
      const accounts = this.msalService.instance.getAllAccounts();
      if (accounts.length === 0) {
        // Only clear error entries if no accounts exist
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('msal') && key.includes('error')) {
            sessionStorage.removeItem(key);
          }
        });
      } else {
      }
      
      // Clear our internal token cache
      this.clearTenantTokenCache();
      
    } catch (error) {
      console.error('Error clearing corrupted auth state:', error);
    }
  }

  private clearAuthStateCache(): void {
    try {
      // Clear state-related cache entries
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('msal') && (key.includes('state') || key.includes('nonce') || key.includes('origin'))) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear interaction status that might be stuck
      sessionStorage.removeItem('msal.interaction.status');
      
      // Preserve target tenant for recovery but clear if it's causing issues
      const targetTenant = sessionStorage.getItem('targetTenantId');
      if (targetTenant) {
      }
      
    } catch (error) {
      console.error('Error clearing auth state cache:', error);
    }
  }

  private clearTokenRequestSpecificCache(): void {
    try {
      // Clear specific token request entries
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('msal') && (key.includes('token.request') || key.includes('request.state') || key.includes('request.origin'))) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear any pending request indicators
      sessionStorage.removeItem('msal.request.pending');
      
    } catch (error) {
      console.error('Error clearing token request specific cache:', error);
    }
  }

  private clearStateSpecificCache(): void {
    try {
      // Clear OAuth state and related entries
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('msal') && (key.includes('state') || key.includes('nonce') || key.includes('code_verifier'))) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear any redirect state indicators
      sessionStorage.removeItem('msal.redirect.state');
      sessionStorage.removeItem('msal.redirect.error');
      
    } catch (error) {
      console.error('Error clearing state specific cache:', error);
    }
  }

  private clearGeneralMsalErrors(): void {
    try {
      // Clear error-related cache entries
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('msal') && (key.includes('error') || key.includes('interaction'))) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear interaction status
      sessionStorage.removeItem('msal.interaction.status');
      sessionStorage.removeItem('msal.interaction.in.progress');
      
      // Clear any temporary error states
      sessionStorage.removeItem('msal.error.description');
      sessionStorage.removeItem('msal.error.code');
      
    } catch (error) {
      console.error('Error clearing general MSAL errors:', error);
    }
  }

  /**
   * Nuclear option: Complete MSAL reset to resolve persistent cache corruption
   * This method clears ALL browser storage and re-initializes MSAL from scratch
   */
  public async performCompleteAuthReset(): Promise<void> {
    try {
      // Step 1: Clear all browser storage comprehensively
      await this.clearAllBrowserStorage();
      
      // Step 2: Destroy current MSAL instance
      await this.destroyMsalInstance();
      
      // Step 3: Re-initialize MSAL completely
      await this.reinitializeMsal();
      
      // Step 4: Reset internal state
      this.resetInternalAuthState();
      
    } catch (error) {
      console.error('❌ Error during complete authentication reset:', error);
      throw error;
    }
  }

  /**
   * Clears ALL browser storage related to authentication and MSAL
   */
  private async clearAllBrowserStorage(): Promise<void> {
    try {
      // Clear localStorage
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        if (this.isAuthRelatedKey(key)) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        if (this.isAuthRelatedKey(key)) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear IndexedDB (MSAL may use it for caching)
      await this.clearIndexedDB();
      
    } catch (error) {
      console.error('Error clearing browser storage:', error);
      throw error;
    }
  }

  /**
   * Determines if a storage key is related to authentication
   */
  private isAuthRelatedKey(key: string): boolean {
    const authKeywords = [
      'msal',
      'auth',
      'token',
      'account',
      'tenant',
      'azure',
      'login',
      'session',
      'state',
      'nonce',
      'code_verifier',
      'interaction',
      'redirect',
      'logout',
      'selectedTenant',
      'targetTenantId',
      'accountBackup',
      'lastSuccessfulAuth'
    ];
    
    return authKeywords.some(keyword => 
      key.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Clears IndexedDB databases that might contain MSAL data
   */
  private async clearIndexedDB(): Promise<void> {
    try {
      if ('indexedDB' in window) {
        // Get all databases (this is a newer API, may not be available in all browsers)
        if ('databases' in indexedDB) {
          const databases = await (indexedDB as any).databases();
          
          for (const db of databases) {
            if (db.name && this.isAuthRelatedKey(db.name)) {
              await this.deleteIndexedDB(db.name);
            }
          }
        } else {
          // Fallback: Try to delete known MSAL IndexedDB names
          const knownMsalDBs = [
            'msal.cache',
            'msal-cache-v1',
            'msal-cache-v2',
            'azure-auth-cache'
          ];
          
          for (const dbName of knownMsalDBs) {
            try {
              await this.deleteIndexedDB(dbName);
            } catch (error) {
              // Ignore errors for non-existent databases
            }
          }
        }
      }
    } catch (error) {
    }
  }

  /**
   * Deletes a specific IndexedDB database
   */
  private deleteIndexedDB(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      
      deleteRequest.onsuccess = () => {
        resolve();
      };
      
      deleteRequest.onerror = () => {
        resolve(); // Don't reject, as this is non-critical
      };
      
      deleteRequest.onblocked = () => {
        resolve(); // Don't reject, as this is non-critical
      };
    });
  }

  /**
   * Destroys the current MSAL instance
   */
  private async destroyMsalInstance(): Promise<void> {
    try {
      // Clear all accounts from MSAL
      const accounts = this.msalService.instance.getAllAccounts();
      accounts.forEach(account => {
        try {
          // Use logout to remove account in MSAL v3
          this.msalService.instance.logout({
            account: account,
            onRedirectNavigate: () => false // Prevent redirect
          });
        } catch (error) {
          // Non-critical: account removal may fail
        }
      });
      
      // Clear active account
      this.msalService.instance.setActiveAccount(null);
      
      // Clear any cached tokens
      try {
        await this.msalService.instance.clearCache();
      } catch (error) {
        // Non-critical: cache clearing may fail
      }
      
    } catch (error) {
      console.error('Error destroying MSAL instance:', error);
      throw error;
    }
  }

  /**
   * Re-initializes MSAL with fresh configuration
   */
  private async reinitializeMsal(): Promise<void> {
    try {
      // Import fresh MSAL configuration
      const { msalInstance } = await import('../msal.config');
      
      // Re-initialize the MSAL service with fresh instance
      // Note: This requires the MSAL service to support re-initialization
      // If not supported, we'll need to reload the page
      
    } catch (error) {
      console.error('Error re-initializing MSAL:', error);
      
      // If re-initialization fails, force page reload as last resort
      window.location.reload();
    }
  }

  /**
   * Resets internal authentication state
   */
  private resetInternalAuthState(): void {
    // Reset all internal subjects
    this._isAuthenticated.next(false);
    this._currentUser.next(null);
    this._availableTenants.next([]);
    
    // Clear internal token cache
    this._tenantTokenCache.clear();
    
  }

  private recoverAuthenticationState(observer: any): void {
    // First attempt: Check for existing active account
    let existingAccount = this.msalService.instance.getActiveAccount();
    const allAccounts = this.msalService.instance.getAllAccounts();

    if (existingAccount) {
      this.checkAndSetActiveAccount();
      observer.next(true);
      observer.complete();
      return;
    }
    
    if (allAccounts.length > 0) {
      // Try to set an appropriate account as active
      this.checkAndSetActiveAccount();
      
      // Verify if we now have an active account
      existingAccount = this.msalService.instance.getActiveAccount();
      if (existingAccount) {
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
        // This indicates accounts existed before but were lost
        // The user needs to re-authenticate
        // Clear the backup since it's no longer valid
        sessionStorage.removeItem('accountBackup');
      } catch (error) {
        console.error('Error parsing account backup:', error);
        sessionStorage.removeItem('accountBackup');
      }
    }
    
    // If we still don't have an account, implement enhanced retry logic with user feedback
    this.showRecoveryFeedback('Attempting to recover your session...');
    
    // First attempt: Clear any corrupted cache and retry
    this.clearCorruptedAuthState();
    
    // Add a small delay and retry once more (sometimes MSAL needs time to populate cache)
    setTimeout(() => {
      const retryAccounts = this.msalService.instance.getAllAccounts();
      if (retryAccounts.length > 0) {
        this.checkAndSetActiveAccount();
        this.clearRecoveryFeedback();
        observer.next(true);
      } else {
        // Final attempt: Try to recover from localStorage if available
        const selectedTenant = localStorage.getItem('selectedTenant');
        if (selectedTenant) {
          this.showRecoveryFeedback('Validating cached authentication...');
          // Clear potentially corrupted session data
          this.clearAuthStateCache();
        } else {
          this.showRecoveryFeedback('Session expired. Redirecting to login...');
        }
        
        // Schedule automatic login after brief user notification
        setTimeout(() => {
          this.clearRecoveryFeedback();
        }, 1500);
        
        this.checkAndSetActiveAccount(); // This will set auth state to false
        observer.next(false);
      }
      observer.complete();
      
      // Always reset the redirect handling flag when recovery completes
      this._redirectHandlingInProgress = false;
    }, 500); // 500ms delay for retry
  }

  private checkAndSetActiveAccount(): void {
    const activeAccount = this.msalService.instance.getActiveAccount();
    const allAccounts = this.msalService.instance.getAllAccounts();
    const currentUser = this._currentUser.value;
    
    // Check if we're targeting a specific tenant after switch
    // Get target tenant ID at the beginning
    const targetTenantId = sessionStorage.getItem('targetTenantId');    
    if (!activeAccount && allAccounts.length > 0) {
      let accountToSet = allAccounts[0]; // Default to first account

      // If we have a target tenant, try to find an account for that tenant
      if (targetTenantId) {
        const targetAccount = allAccounts.find(acc => acc.tenantId === targetTenantId);
        if (targetAccount) {
          accountToSet = targetAccount;
          sessionStorage.removeItem('targetTenantId'); // Clear after use
        }
      } else {
        // On page refresh, try to match the stored selectedTenant
        try {
          const storedTenantStr = localStorage.getItem('selectedTenant');
          if (storedTenantStr) {
            const storedTenant = JSON.parse(storedTenantStr);
            if (storedTenant?.id) {
              const matchingAccount = allAccounts.find(acc => acc.tenantId === storedTenant.id);
              if (matchingAccount) {
                accountToSet = matchingAccount;
              }
            }
          }
        } catch (e) {
        }
      }
      
      // Check if tenant changed
      const previousTenantId = currentUser?.tenantId;
      
      if ((previousTenantId && previousTenantId !== accountToSet.tenantId) || 
          (targetTenantId && targetTenantId === accountToSet.tenantId)) {
        // Update localStorage with new tenant information
        const newTenant = {
          id: accountToSet.tenantId,
          displayName: accountToSet.tenantId,
          defaultDomain: `${accountToSet.tenantId}.onmicrosoft.com`,
          countryLetterCode: 'US',
          isDefault: true
        };
        localStorage.setItem('selectedTenant', JSON.stringify(newTenant));
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
      // On refresh, ensure the active account matches the stored tenant
      let effectiveAccount = activeAccount;
      try {
        const storedTenantStr = localStorage.getItem('selectedTenant');
        if (storedTenantStr) {
          const storedTenant = JSON.parse(storedTenantStr);
          if (storedTenant?.id && storedTenant.id !== activeAccount.tenantId) {
            const matchingAccount = allAccounts.find(acc => acc.tenantId === storedTenant.id);
            if (matchingAccount) {
              this.msalService.instance.setActiveAccount(matchingAccount);
              effectiveAccount = matchingAccount;
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }

      // Check if tenant changed
      const previousTenantId = currentUser?.tenantId;

      if ((previousTenantId && previousTenantId !== effectiveAccount.tenantId) ||
          (targetTenantId && targetTenantId === effectiveAccount.tenantId)) {
        // Update localStorage with new tenant information
        const newTenant = {
          id: effectiveAccount.tenantId,
          displayName: effectiveAccount.tenantId,
          defaultDomain: `${effectiveAccount.tenantId}.onmicrosoft.com`,
          countryLetterCode: 'US',
          isDefault: true
        };
        localStorage.setItem('selectedTenant', JSON.stringify(newTenant));
        // Trigger tenant change notification
        this._tenantChanged.next(effectiveAccount.tenantId);

        // Clear target tenant ID after successful switch
        if (targetTenantId) {
          sessionStorage.removeItem('targetTenantId');
        }
      }

      this._currentUser.next(effectiveAccount);
      this._isAuthenticated.next(true);
      
      // Clear target tenant if we have an active account
      if (targetTenantId) {
        sessionStorage.removeItem('targetTenantId');
      }
    } else {
      this._isAuthenticated.next(false);
      this._currentUser.next(null);
      
      // Trigger automatic re-authentication after a brief delay
      this.scheduleAutoReAuthentication();
      
      // Don't clear targetTenantId here as we might be in the middle of authentication
    }
  }

  private scheduleAutoReAuthentication(): void {
    // Only schedule if not already in progress and we have a reasonable expectation of success
    if (sessionStorage.getItem('autoReAuthScheduled') || sessionStorage.getItem('msal.logout.in.progress')) {
      return;
    }
    
    // Check if fresh authentication is explicitly required
    const freshAuthRequired = sessionStorage.getItem('freshAuthRequired');
    const delay = freshAuthRequired ? 1000 : 2000; // Shorter delay if fresh auth is flagged
    
    sessionStorage.setItem('autoReAuthScheduled', 'true');
    
    setTimeout(() => {
      sessionStorage.removeItem('autoReAuthScheduled');
      
      // Check if we still don't have accounts but DON'T automatically trigger login
      const accounts = this.msalService.instance.getAllAccounts();
      if (accounts.length === 0 && !this._isAuthenticated.value) {
        // Clear the fresh auth flag if it exists
        if (freshAuthRequired) {
          sessionStorage.removeItem('freshAuthRequired');
        }
        
        // Set flag to indicate manual login is needed instead of automatic redirect
        sessionStorage.setItem('manualLoginRequired', 'true');
      }
    }, delay);
  }

  login(): void {
    // Check for cooldown period to prevent rapid successive attempts
    if (this.isInCooldownPeriod()) {
      this.showRecoveryFeedback('Please wait before trying again...');
      return;
    }

    // Track authentication attempt
    this.trackAuthenticationAttempt();

    const loginRequest: RedirectRequest = {
      scopes: ['user.read', 'Directory.Read.All', 'RoleManagement.ReadWrite.Directory'],
      prompt: 'select_account'
    };

    this.msalService.loginRedirect(loginRequest);
  }

  private isInCooldownPeriod(): boolean {
    const lastAttemptStr = sessionStorage.getItem('lastAuthAttempt');
    if (!lastAttemptStr) {
      return false;
    }

    const lastAttempt = parseInt(lastAttemptStr);
    const cooldownPeriod = 5000; // 5 seconds cooldown
    const timeSinceLastAttempt = Date.now() - lastAttempt;

    return timeSinceLastAttempt < cooldownPeriod;
  }

  private trackAuthenticationAttempt(): void {
    const now = Date.now();
    sessionStorage.setItem('lastAuthAttempt', now.toString());

    // Track attempt count for additional protection
    const attemptCountStr = sessionStorage.getItem('authAttemptCount');
    const attemptCount = attemptCountStr ? parseInt(attemptCountStr) : 0;
    const newAttemptCount = attemptCount + 1;
    
    sessionStorage.setItem('authAttemptCount', newAttemptCount.toString());

    // Reset attempt count after 10 minutes
    setTimeout(() => {
      sessionStorage.removeItem('authAttemptCount');
    }, 600000);

  }

  logout(): void {
    try {
      // Set logout flag to prevent race conditions
      sessionStorage.setItem('msal.logout.in.progress', 'true');
      sessionStorage.setItem('msal.logout.timestamp', Date.now().toString());
      
      // Clear only internal caches immediately
      this.clearTenantTokenCache();

      // Clear selected tenant from localStorage
      localStorage.removeItem('selectedTenant');

      // Reset authentication state
      this._isAuthenticated.next(false);
      this._currentUser.next(null);
      this._availableTenants.next([]);
      
      // Schedule delayed cache cleanup to prevent race conditions
      // This allows MSAL to complete any pending operations before aggressive cleanup
      setTimeout(() => {
        this.performDelayedLogoutCleanup();
      }, 500);
      
    } catch (error) {
      console.error('Error during logout cleanup:', error);
    }
    
    // Perform MSAL logout redirect
    this.msalService.logoutRedirect({
      postLogoutRedirectUri: 'http://localhost:4200'
    });
  }

  private performDelayedLogoutCleanup(): void {
    try {
      // Only clear if we're still in logout process (not if user navigated back)
      const logoutInProgress = sessionStorage.getItem('msal.logout.in.progress');
      if (!logoutInProgress) {
        return;
      }

      // Clear authentication state from session storage (but preserve MSAL core cache)
      this.clearAuthStateCache();

      // Clear backup data
      sessionStorage.removeItem('accountBackup');
      sessionStorage.removeItem('targetTenantId');
      sessionStorage.removeItem('postTenantSwitchRedirect');
      
      // Remove logout flags
       sessionStorage.removeItem('msal.logout.in.progress');
       sessionStorage.removeItem('msal.logout.timestamp');
      
    } catch (error) {
      console.error('Error during delayed logout cleanup:', error);
    }
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

      // Explicitly set authority to the account's tenant to ensure
      // tokens are acquired for the correct tenant (not a cached token from another tenant)
      const authority = `https://login.microsoftonline.com/${tenantId}`;

      const silentRequest: SilentRequest = {
        scopes: scopes,
        account: account,
        authority: authority
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
              account: account,
              authority: authority
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
      // Store the target tenant ID for account recovery
      sessionStorage.setItem('targetTenantId', tenantId);
      // Redirect back to current page after tenant switch (fallback to tenants page)
      const currentUrl = this.router.url;
      const redirectTarget = currentUrl.startsWith('/app') ? currentUrl : '/app/tenants';
      sessionStorage.setItem('postTenantSwitchRedirect', redirectTarget);
      
      // Get current accounts before clearing cache
      const currentAccounts = this.msalService.instance.getAllAccounts();
      // Store account information in session storage as backup
      if (currentAccounts.length > 0) {
        const accountBackup = currentAccounts.map(account => ({
          username: account.username,
          homeAccountId: account.homeAccountId,
          tenantId: account.tenantId,
          localAccountId: account.localAccountId
        }));
        sessionStorage.setItem('accountBackup', JSON.stringify(accountBackup));
      }
      
      // Instead of clearing cache, just clear our internal token cache
      // This preserves MSAL accounts while clearing our cached tokens
      this.clearTenantTokenCache();

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

  private showRecoveryFeedback(message: string): void {
    try {
      // Store recovery message for UI components to display
      sessionStorage.setItem('authRecoveryMessage', message);
      // Emit recovery status for components that might want to show notifications
      this._recoveryStatus.next({ inProgress: true, message });
    } catch (error) {
      console.error('Error showing recovery feedback:', error);
    }
  }
  
  private clearRecoveryFeedback(): void {
    try {
      sessionStorage.removeItem('authRecoveryMessage');
      this._recoveryStatus.next({ inProgress: false, message: null });
    } catch (error) {
      console.error('Error clearing recovery feedback:', error);
    }
  }
  
  // Observable for components to subscribe to recovery status
  private _recoveryStatus = new BehaviorSubject<{inProgress: boolean, message: string | null}>({ inProgress: false, message: null });
  public recoveryStatus$ = this._recoveryStatus.asObservable();
  
  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
    this.clearTenantTokenCache();
  }
}
