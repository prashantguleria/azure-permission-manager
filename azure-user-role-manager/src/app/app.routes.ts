import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { tenantGuard } from './guards/tenant.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/login' },
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
  { path: 'users', redirectTo: '/user-management' },
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
    path: 'audit', 
    loadComponent: () => import('./pages/audit-log/audit-log.component').then(m => m.AuditLogComponent),
    canActivate: [authGuard, tenantGuard] 
  },
  { path: 'unauthorized', loadChildren: () => import('./pages/welcome/welcome.routes').then(m => m.WELCOME_ROUTES) },
  { path: '**', redirectTo: '/tenants' }
];
