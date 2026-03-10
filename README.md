# Azure Permission Manager

A client-side Angular application for managing Azure AD users, role assignments, and resource permissions across multiple tenants. Runs entirely in the browser — no backend server, no data collection, no third-party infrastructure.

**🔗 [Live App → prashantguleria.github.io/azure-permission-manager](https://prashantguleria.github.io/azure-permission-manager/)**

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![PrimeNG](https://img.shields.io/badge/PrimeNG-21-4FC08D)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### User & Principal Management
- Search and browse Azure AD users, service principals, and groups
- View detailed user profiles with account status, department, and contact info
- Navigate directly to Azure Portal for any user or resource

### Permission Control
- View Entra ID directory roles and Azure RBAC assignments side-by-side
- Assign and revoke roles on any Azure resource (subscriptions, resource groups, storage accounts, etc.)
- Bulk add/remove permissions across multiple storage accounts
- Searchable role picker with 200+ Azure built-in roles

### Storage Account Management
- List all storage accounts in a subscription with permission counts
- Expand rows to view and manage individual role assignments inline
- Resource lock detection with automatic lock handling during permission changes
- Filter by resource group, location, access level, or free-text search

### Multi-Tenant Support
- Switch between Azure tenants without re-authenticating
- Tenant-specific token caching for fast switching
- Persistent tenant selection across page refreshes

### Audit Logging
- Client-side audit trail for all permission changes
- Filter by date, action type, user, and status
- Export audit logs to CSV

### Resource Permissions
- Browse permissions at subscription and resource group levels
- View inherited vs. direct role assignments
- Open any resource directly in Azure Portal

---

## Architecture

```
Browser (SPA)
  |
  |-- Microsoft Graph API      (users, directory roles, app roles)
  |-- Azure Resource Manager   (subscriptions, resources, RBAC, locks)
  |-- MSAL.js                  (authentication, token management)
  |
  No backend server
```

The app communicates exclusively with Microsoft APIs using OAuth 2.0 tokens acquired via MSAL. All state is stored in the browser (localStorage for tenant selection and audit logs, sessionStorage for transient auth state).

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Angular 21 (signals, standalone components, zoneless change detection) |
| UI Components | PrimeNG 21 with Aura theme |
| Authentication | MSAL Angular v3 / MSAL Browser v3 |
| Styling | SCSS with CSS custom properties (light/dark mode) |
| Build | Angular CLI, Yarn Berry v4 |
| Language | TypeScript 5.9 (strict mode) |

### Project Structure

```
src/app/
  guards/           # auth.guard.ts, tenant.guard.ts
  models/           # TypeScript interfaces for users, permissions, tenants, audit
  services/
    auth.service.ts           # MSAL authentication, tenant switching
    azure-api.service.ts      # Graph API + Management API calls
    permissions.service.ts    # Permission CRUD, caching, batch operations
    lock-management.service.ts # Resource lock handling
    app-audit.service.ts      # Client-side audit logging
    utility.service.ts        # Portal URLs, date formatting, helpers
    theme.service.ts          # Dark/light mode toggle
  components/       # Reusable: subscription-selector, bulk modals, skeleton-loader
  pages/
    homepage/           # Landing page
    login/              # MSAL login flow
    tenant-selection/   # Tenant picker
    user-management/    # User search & listing
    user-detail/        # Individual user profile
    user-permissions/   # Entra ID + RBAC permissions for a user
    storage-accounts/   # Storage account permission management
    resource-permissions/ # Subscription/resource group permissions
    audit-logs/         # Audit log viewer
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [Yarn](https://yarnpkg.com/) v4+ (or npm)
- An Azure AD tenant with an app registration

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/azure-permission-manager.git
cd azure-permission-manager
```

### 2. Install dependencies

```bash
yarn install
# or: npm install
```

### 3. Configure Azure AD App Registration

Create an app registration in Azure AD:

1. Go to [Azure Portal > App registrations > New registration](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Set **Supported account types** to "Accounts in any organizational directory (Multi-tenant)"
3. Set **Redirect URI** to `http://localhost:4200` (type: Single-page application)
4. After creation, copy the **Application (client) ID**

Update `src/app/msal.config.ts`:

```typescript
export const msalConfig = {
  auth: {
    clientId: '<YOUR_CLIENT_ID>',  // Replace this
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  // ...
};
```

### 4. Configure API Permissions

In your app registration, add the following **Delegated** permissions:

| API | Permission | Purpose |
|-----|-----------|---------|
| Microsoft Graph | `User.Read` | Sign-in and read own profile |
| Microsoft Graph | `User.Read.All` | Search and read user profiles |
| Microsoft Graph | `Directory.Read.All` | Read directory roles and group memberships |
| Microsoft Graph | `RoleManagement.ReadWrite.Directory` | Manage Entra ID role assignments |
| Microsoft Graph | `Organization.Read.All` | Read tenant information |
| Azure Service Management | `user_impersonation` | Manage Azure resources (RBAC, locks, storage) |

Grant admin consent for your tenant after adding the permissions.

### 5. Run the development server

```bash
yarn start
# or: npm start
```

Open [http://localhost:4200](http://localhost:4200) and sign in with your Azure AD account.

---

## Deployment

### GitHub Pages

Since this is a client-side SPA, it can be hosted on GitHub Pages:

```bash
# Build for production
yarn build --configuration production --base-href /azure-permission-manager/

# The output is in dist/azure-user-role-manager/browser/
# Deploy this folder to GitHub Pages
```

Using the [angular-cli-ghpages](https://github.com/angular-schule/angular-cli-ghpages) package:

```bash
# Install
yarn add -D angular-cli-ghpages

# Deploy
npx ngh --dir=dist/azure-user-role-manager/browser
```

After deploying, add `https://<your-username>.github.io/azure-permission-manager` as a redirect URI in your Azure AD app registration.

### Azure Static Web Apps

```bash
# Build
yarn build --configuration production

# Deploy via Azure CLI or GitHub Actions
az staticwebapp create --name azure-permission-manager --resource-group <rg> --source .
```

Add `https://<your-app>.azurestaticapps.net` as a redirect URI.

### Redirect URI Strategy

The app uses `window.location.origin` for redirect URIs, which automatically adapts to whatever domain it's deployed on. You just need to register each deployment URL in your Azure AD app registration under **Authentication > Redirect URIs**:

- `http://localhost:4200` (development)
- `https://<your-username>.github.io` (GitHub Pages)
- `https://your-custom-domain.com` (production)

---

## Configuration

### Theming

The app supports light and dark modes via CSS custom properties. Toggle with the theme button in the sidebar. Colors, spacing, and typography are defined in `src/styles.scss`.

### Routes

All authenticated routes are behind `/app/*` with lazy-loaded components:

| Route | Page | Guards |
|-------|------|--------|
| `/` | Homepage (landing) | None |
| `/app/login` | Login | None |
| `/app/tenants` | Tenant selection | `authGuard` |
| `/app/user-management` | User search | `authGuard` + `tenantGuard` |
| `/app/user-detail/:id` | User profile | `authGuard` + `tenantGuard` |
| `/app/user-permissions` | User permissions | `authGuard` + `tenantGuard` |
| `/app/storage-accounts` | Storage accounts | `authGuard` + `tenantGuard` |
| `/app/resource-permissions` | Resource permissions | `authGuard` + `tenantGuard` |
| `/app/audit-logs` | Audit logs | `authGuard` + `tenantGuard` |

---

## Security & Privacy

- **Zero server architecture** — the app runs entirely in the browser with no backend
- **No data collection** — no telemetry, analytics, or external tracking
- **Direct API communication** — tokens and data flow only between your browser and Microsoft APIs
- **Local audit logs** — audit trail is stored in browser localStorage, never transmitted
- **Automatic token management** — MSAL handles token refresh, caching, and secure storage
- **Tenant isolation** — tokens are scoped per tenant with explicit authority parameters

---

## Development

### Available Scripts

```bash
yarn start          # Development server on http://localhost:4200
yarn build          # Production build
yarn watch          # Development build with watch mode
yarn test           # Run unit tests
```

### Code Conventions

- **Signals** for all reactive state (`signal()`, `computed()`, `input()`, `output()`)
- **Standalone components** with `ChangeDetectionStrategy.OnPush`
- **Lazy-loaded routes** via `loadComponent()`
- **SCSS** with CSS custom properties (no hardcoded colors/spacing)
- **PrimeNG v4** severity types: `success | secondary | info | warn | danger | contrast`

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Links

- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)
- [Azure Resource Manager](https://learn.microsoft.com/en-us/azure/azure-resource-manager/)
- [MSAL Angular](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-angular)
- [PrimeNG](https://primeng.org/)
- [Angular](https://angular.dev/)
