import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { tenantGuard } from './guards/tenant.guard';
import { LoginComponent } from './pages/login/login.component';
import { TenantSelectionComponent } from './pages/tenant-selection/tenant-selection.component';
import { UserManagementComponent } from './pages/user-management/user-management.component';
import { UserDetailComponent } from './pages/user-detail/user-detail.component';
import { UserPermissionsComponent } from './pages/user-permissions/user-permissions.component';
import { AuditLogComponent } from './pages/audit-log/audit-log.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/tenants' },
  { path: 'login', component: LoginComponent },
  { path: 'tenants', component: TenantSelectionComponent, canActivate: [authGuard] },
  { path: 'user-management', component: UserManagementComponent, canActivate: [authGuard, tenantGuard] },
  { path: 'users', redirectTo: '/user-management' },
  { path: 'user-detail/:id', component: UserDetailComponent, canActivate: [authGuard, tenantGuard] },
  { path: 'user-permissions', component: UserPermissionsComponent, canActivate: [authGuard, tenantGuard] },
  { path: 'audit', component: AuditLogComponent, canActivate: [authGuard, tenantGuard] },
  { path: 'unauthorized', loadChildren: () => import('./pages/welcome/welcome.routes').then(m => m.WELCOME_ROUTES) },
  { path: '**', redirectTo: '/tenants' }
];
