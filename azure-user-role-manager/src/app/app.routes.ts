import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { tenantGuard } from './guards/tenant.guard';

export const routes: Routes = [
  // Homepage route (default)
  { 
    path: '', 
    pathMatch: 'full', 
    loadComponent: () => import('./pages/homepage/homepage.component').then(m => m.HomepageComponent)
  },
  
  // Application routes under /app
  {
    path: 'app',
    children: [
      { path: '', pathMatch: 'full', redirectTo: '/app/login' },
      { 
        path: 'login', 
        loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
      },
      { 
        path: 'tenants', 
        loadComponent: () => import('./pages/tenant-selection/tenant-selection.component').then(m => m.TenantSelectionComponent),
        canActivate: [authGuard] 
      },
      { 
        path: 'user-management', 
        loadComponent: () => import('./pages/user-management/user-management.component').then(m => m.UserManagementComponent),
        canActivate: [authGuard, tenantGuard] 
      },
      { path: 'users', redirectTo: '/app/user-management' },
      { 
        path: 'user-detail/:id', 
        loadComponent: () => import('./pages/user-detail/user-detail.component').then(m => m.UserDetailComponent),
        canActivate: [authGuard, tenantGuard] 
      },
      { 
        path: 'user-permissions', 
        loadComponent: () => import('./pages/user-permissions/user-permissions.component').then(m => m.UserPermissionsComponent),
        canActivate: [authGuard, tenantGuard] 
      },
      { 
        path: 'storage-accounts', 
        loadComponent: () => import('./pages/storage-accounts/storage-accounts.component').then(m => m.StorageAccountsComponent),
        canActivate: [authGuard, tenantGuard] 
      },
      { 
        path: 'audit-logs', 
        loadComponent: () => import('./pages/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent),
        canActivate: [authGuard, tenantGuard] 
      },
      { path: 'unauthorized', loadChildren: () => import('./pages/welcome/welcome.routes').then(m => m.WELCOME_ROUTES) },
      { path: '**', redirectTo: '/app/tenants' }
    ]
  },
  
  // Fallback for any unmatched routes
  { path: '**', redirectTo: '/' }
];
