import { PublicClientApplication, BrowserCacheLocation } from '@azure/msal-browser';

// MSAL Configuration
export const msalConfig = {
  auth: {
    clientId: '310e9afa-5210-4f0e-b63c-189dd6ad9227', // Replace with your Azure AD app registration client ID
    authority: 'https://login.microsoftonline.com/common', // Use 'common' for multi-tenant support
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    knownAuthorities: [], // Will be populated dynamically for tenant-specific authorities
    cloudDiscoveryMetadata: '', // Optional: for custom cloud environments
    authorityMetadata: '' // Optional: for custom authority metadata
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
    storeAuthStateInCookie: false,
    // Ensure accounts persist across tenant switches
    claimsBasedCachingEnabled: true
  },
  system: {
    allowNativeBroker: false, // Disables WAM Broker
    // Increase timeout for better reliability during tenant switches
    tokenRenewalOffsetSeconds: 300,
    loggerOptions: {
      loggerCallback: (level: any, message: string, containsPii: boolean) => {
        if (containsPii) {
          return;
        }
        // MSAL log suppressed for production
      },
      piiLoggingEnabled: false,
      logLevel: 2 // Info level for better debugging
    }
  }
};

// Helper function to create tenant-specific MSAL configuration
export const createTenantSpecificConfig = (tenantId: string) => {
  return {
    ...msalConfig,
    auth: {
      ...msalConfig.auth,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      knownAuthorities: [`https://login.microsoftonline.com/${tenantId}`]
    }
  };
};

// Helper function to get tenant-specific configuration
export const getTenantSpecificConfig = (tenantId: string) => {
  return {
    auth: {
      clientId: msalConfig.auth.clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: msalConfig.auth.redirectUri,
      postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
    }
  };
};

// Create and export the MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Handle redirect promise after initialization
let redirectHandled = false;

const handleRedirectAfterInit = async () => {
  if (redirectHandled) return;
  redirectHandled = true;
  
  try {
    // Check if we're in bypass mode
    if (isInBypassMode()) {
      return;
    }
    
    // Detect cache corruption before processing
    if (detectCacheCorruption()) {
      await bypassCorruptedCache();
      return;
    }
    
    // Check if logout is in progress to prevent race conditions
    const initialLogoutCheck = sessionStorage.getItem('msal.logout.in.progress');
    if (initialLogoutCheck) {
      // Clear the logout flag if it's stale (older than 10 seconds)
      const logoutTimestamp = sessionStorage.getItem('msal.logout.timestamp');
      if (!logoutTimestamp || (Date.now() - parseInt(logoutTimestamp)) > 10000) {
        sessionStorage.removeItem('msal.logout.in.progress');
        sessionStorage.removeItem('msal.logout.timestamp');
      } else {
        return; // Skip redirect handling during active logout
      }
    }
    
    // Skip manual redirect handling - auth.service.ts handles this through handleRedirectObservable
    // This prevents duplicate handleRedirectPromise calls that cause authentication errors
    // Only perform account recovery if no logout is in progress
    const accountRecoveryLogoutCheck = sessionStorage.getItem('msal.logout.in.progress');
    if (accountRecoveryLogoutCheck) {
      return;
    }
    
    // Check for existing accounts without calling handleRedirectPromise
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      let targetAccount = accounts[0];

      // Match stored selectedTenant to pick the correct MSAL account on refresh
      try {
        const storedTenantStr = localStorage.getItem('selectedTenant');
        if (storedTenantStr) {
          const storedTenant = JSON.parse(storedTenantStr);
          if (storedTenant?.id) {
            const matchingAccount = accounts.find((acc: any) => acc.tenantId === storedTenant.id);
            if (matchingAccount) {
              targetAccount = matchingAccount;
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }

      msalInstance.setActiveAccount(targetAccount);
      return;
    }
    return;
    
    // All redirect handling is now delegated to auth.service.ts to prevent duplicate calls
  } catch (error) {
    console.error('Error in MSAL initialization:', error);
    // Clear potentially corrupted cache and let auth.service.ts handle authentication
    await clearCorruptedCacheEntries();
  }
};

// Cache corruption detection
const detectCacheCorruption = (): boolean => {
  try {
    // Check for common corruption indicators
    const corruptionIndicators = [
      'msal.request.pending',
      'msal.interaction.status',
      'msal.error'
    ];
    
    let corruptionCount = 0;
    
    // Check session storage for corruption indicators
    corruptionIndicators.forEach(key => {
      if (sessionStorage.getItem(key)) {
        corruptionCount++;
      }
    });
    
    // Check for orphaned state entries
    const stateKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('msal') && key.includes('state')
    );
    
    if (stateKeys.length > 3) {
      corruptionCount++;
    }
    
    // Check for mismatched token requests
    const tokenRequestKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('msal') && key.includes('token.request')
    );
    
    const activeRequests = tokenRequestKeys.length;
    if (activeRequests > 2) {
      corruptionCount++;
    }
    
    const isCorrupted = corruptionCount >= 2;
    return isCorrupted;
  } catch (error) {
    console.error('Error detecting cache corruption:', error);
    return true; // Assume corruption if detection fails
  }
};

// Complete cache bypass for corrupted state
const bypassCorruptedCache = async (): Promise<void> => {
  try {
    // Mark that we're in bypass mode
    sessionStorage.setItem('msal.bypass.active', 'true');
    sessionStorage.setItem('msal.bypass.timestamp', Date.now().toString());
    
    // Clear all MSAL-related storage immediately
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('msal') && !key.includes('bypass')) {
        sessionStorage.removeItem(key);
      }
    });
    
    Object.keys(localStorage).forEach(key => {
      if (key.includes('msal')) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear any authentication-related entries
    const authKeys = ['accountBackup', 'accountBackup.timestamp', 'targetTenantId', 'freshAuthRequired'];
    authKeys.forEach(key => {
      sessionStorage.removeItem(key);
    });
    
    
    // Set flag for fresh authentication
    sessionStorage.setItem('requiresFreshAuth', 'true');
    
  } catch (error) {
    console.error('Error in cache bypass:', error);
  }
};

// Check if we're in bypass mode
const isInBypassMode = (): boolean => {
  const bypassActive = sessionStorage.getItem('msal.bypass.active');
  const bypassTimestamp = sessionStorage.getItem('msal.bypass.timestamp');
  
  if (!bypassActive || !bypassTimestamp) {
    return false;
  }
  
  // Check if bypass is recent (within last 5 minutes)
  const timeSinceBypass = Date.now() - parseInt(bypassTimestamp);
  const isRecentBypass = timeSinceBypass < 5 * 60 * 1000;
  
  if (!isRecentBypass) {
    // Clear old bypass flags
    sessionStorage.removeItem('msal.bypass.active');
    sessionStorage.removeItem('msal.bypass.timestamp');
    return false;
  }
  
  return true;
};

// Helper functions for cache management
const clearTokenRequestCache = async (): Promise<void> => {
  try {
    // Clear session storage entries related to token requests
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('msal') && (key.includes('token.request') || key.includes('request.state'))) {
        sessionStorage.removeItem(key);
      }
    });

    // Clear local storage entries related to token requests
    Object.keys(localStorage).forEach(key => {
      if (key.includes('msal') && key.includes('token.request')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing token request cache:', error);
  }
};

const clearAuthStateCache = async (): Promise<void> => {
  try {
    // Clear state and nonce related entries
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('msal') && (key.includes('state') || key.includes('nonce') || key.includes('origin'))) {
        sessionStorage.removeItem(key);
      }
    });
    
    // Clear target tenant if it might be causing issues
    const targetTenant = sessionStorage.getItem('targetTenantId');
    if (targetTenant) {
    }
  } catch (error) {
    console.error('Error clearing auth state cache:', error);
  }
};

const clearCorruptedCacheEntries = async (): Promise<void> => {
  try {
    // Clear entries that might be corrupted
    const keysToCheck = ['msal.interaction.status', 'msal.request.state', 'msal.error'];
    keysToCheck.forEach(key => {
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing corrupted cache entries:', error);
  }
};

const clearAllAuthCache = async (): Promise<void> => {
  try {
    // Clear all MSAL-related entries from both storages
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('msal')) {
        sessionStorage.removeItem(key);
      }
    });
    
    Object.keys(localStorage).forEach(key => {
      if (key.includes('msal')) {
        localStorage.removeItem(key);
      }
    });
    
  } catch (error) {
    console.error('Error performing complete cache clear:', error);
  }
};

const storeAccountBackup = (accounts: any[]): void => {
  try {
    const accountBackup = accounts.map(account => ({
      username: account.username,
      tenantId: account.tenantId,
      homeAccountId: account.homeAccountId
    }));
    sessionStorage.setItem('accountBackup', JSON.stringify(accountBackup));
    sessionStorage.setItem('accountBackup.timestamp', Date.now().toString());
  } catch (error) {
    console.error('Error storing account backup:', error);
  }
};

// Initialize MSAL instance with enhanced error handling
export const initializeMsal = async (): Promise<void> => {
  try {
    await msalInstance.initialize();
    
    // Handle redirect promise with comprehensive error handling
    handleRedirectAfterInit().catch(error => {
      console.error('Background redirect handling failed:', error);
      
      // Attempt final recovery
      setTimeout(async () => {
        try {
          const emergencyAccounts = msalInstance.getAllAccounts();
          if (emergencyAccounts.length > 0) {
            msalInstance.setActiveAccount(emergencyAccounts[0]);
          }
        } catch (emergencyError) {
          console.error('Emergency recovery failed:', emergencyError);
        }
      }, 1000);
    });
  } catch (error) {
    console.error('MSAL initialization failed:', error);
    throw error;
  }
};