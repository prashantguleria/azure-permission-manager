import { PublicClientApplication, BrowserCacheLocation } from '@azure/msal-browser';

// MSAL Configuration
export const msalConfig = {
  auth: {
    clientId: '310e9afa-5210-4f0e-b63c-189dd6ad9227', // Replace with your Azure AD app registration client ID
    authority: 'https://login.microsoftonline.com/common', // Use 'common' for multi-tenant support
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
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
        console.log(`MSAL [${level}]: ${message}`);
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

// Enhanced redirect promise handling with better error recovery
msalInstance.handleRedirectPromise().then((response) => {
  console.log('Redirect promise handled');
  if (response) {
    console.log('Authentication successful:', response.account?.username);
    console.log('Account tenant ID:', response.account?.tenantId);
    
    // Ensure the account is set as active
    if (response.account) {
      msalInstance.setActiveAccount(response.account);
      console.log('Active account set after redirect:', response.account.username);
    }
    
    // Clear any redirect flags
    sessionStorage.removeItem('postTenantSwitchRedirect');
  } else {
    // Check if we have cached accounts that might not have been detected
    const allAccounts = msalInstance.getAllAccounts();
    console.log('No redirect response, checking cached accounts:', allAccounts.length);
    
    if (allAccounts.length > 0 && !msalInstance.getActiveAccount()) {
      // Try to recover from cached accounts
      const targetTenantId = sessionStorage.getItem('targetTenantId');
      let accountToSet = allAccounts[0];
      
      if (targetTenantId) {
        const tenantAccount = allAccounts.find(account => 
          account.tenantId === targetTenantId || 
          account.idTokenClaims?.tid === targetTenantId
        );
        if (tenantAccount) {
          accountToSet = tenantAccount;
          console.log('Recovered account for tenant:', targetTenantId);
        }
      }
      
      msalInstance.setActiveAccount(accountToSet);
      console.log('Recovered active account:', accountToSet.username);
    }
  }
}).catch((error) => {
  console.error('Error handling redirect promise:', error);
  
  // Try to recover from error by checking cached accounts
  const allAccounts = msalInstance.getAllAccounts();
  if (allAccounts.length > 0) {
    console.log('Attempting account recovery after redirect error');
    msalInstance.setActiveAccount(allAccounts[0]);
  }
});

// Initialize MSAL instance
export const initializeMsal = async (): Promise<void> => {
  try {
    await msalInstance.initialize();
    console.log('MSAL initialized successfully');
  } catch (error) {
    console.error('MSAL initialization failed:', error);
    throw error;
  }
};