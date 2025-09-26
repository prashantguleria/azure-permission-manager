import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { BreadcrumbModule } from 'primeng/breadcrumb';

import { MenuItem } from 'primeng/api';
import { AuthService } from './services/auth.service';
import { Subject, takeUntil, filter } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';
import { UtilityService } from './services/utility.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, MenubarModule, AvatarModule, ButtonModule, BreadcrumbModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  isCollapsed = false;
  currentUser: AccountInfo | null = null;
  showMainLayout = false;
  currentPageTitle: string = '';
  breadcrumbs: Array<{label: string, link?: string, icon?: string}> = [];
  breadcrumbItems: MenuItem[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    public utilityService: UtilityService
  ) {}

  ngOnInit(): void {
    // Listen to router events to update breadcrumbs and page title
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        // Update breadcrumbs and page title based on current route
        this.updatePageInfo(event.url);
        this.updateLayoutVisibility(event.url);
      });

    // Subscribe to current user changes (always active)
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: AccountInfo | null) => {
      this.currentUser = user;
      console.log('Current user updated:', user);
    });

    // Initialize authentication and handle redirect results
    this.authService.initializeAuth()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (result) {
            console.log('Authentication initialized successfully');
            
            // Optimize by reducing delay and checking auth state immediately
            setTimeout(() => {
              const currentRoute = this.router.url;
              
              // Only handle authentication redirects for /app routes
              if (currentRoute.startsWith('/app')) {
                // Check if user is authenticated and redirect appropriately
                if (this.authService.isAuthenticated()) {
                  // Check if this is a redirect after tenant switching
                  const postTenantSwitchRedirect = sessionStorage.getItem('postTenantSwitchRedirect');
                  if (postTenantSwitchRedirect) {
                    console.log('Redirecting after tenant switch to:', postTenantSwitchRedirect);
                    sessionStorage.removeItem('postTenantSwitchRedirect');
                    this.router.navigate([postTenantSwitchRedirect]);
                  } else if (currentRoute === '/app' || currentRoute === '/app/login') {
                    // Check if user has already selected a tenant
                    const selectedTenant = localStorage.getItem('selectedTenant');
                    const currentUser = this.authService.getCurrentUser();
                    
                    if (selectedTenant) {
                      console.log('User has selected tenant, redirecting to user management');
                      this.router.navigate(['/app/user-management']);
                    } else if (currentUser?.tenantId) {
                      // Auto-select current tenant if no tenant selected
                      console.log('Auto-selecting current tenant:', currentUser.tenantId);
                      const defaultTenant = {
                        id: currentUser.tenantId,
                        displayName: currentUser.tenantId,
                        defaultDomain: `${currentUser.tenantId}.onmicrosoft.com`,
                        countryLetterCode: 'US',
                        isDefault: true
                      };
                      localStorage.setItem('selectedTenant', JSON.stringify(defaultTenant));
                      this.router.navigate(['/app/user-management']);
                    } else {
                      this.router.navigate(['/app/tenants']);
                    }
                  }
                } else {
                  console.log('User not authenticated, redirecting to login');
                  if (currentRoute !== '/app/login') {
                    this.router.navigate(['/app/login']);
                  }
                }
              }
              
              // Set initial layout visibility
              this.updateLayoutVisibility(this.router.url);
            }, 50); // Reduced delay for faster startup
          } else {
            console.log('Authentication initialization returned false');
            // Set initial layout visibility even if auth failed
            this.updateLayoutVisibility(this.router.url);
          }
        },
        error: (error) => {
          console.error('Authentication initialization failed:', error);
          // Set initial layout visibility even on error
          this.updateLayoutVisibility(this.router.url);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  logout(): void {
    this.authService.logout();
  }



  private updateLayoutVisibility(url: string): void {
    // Hide main layout on login page and homepage
    this.showMainLayout = !url.includes('/login') && url !== '/';
  }

  private updatePageInfo(url: string): void {
    // Reset breadcrumbs
    this.breadcrumbs = [];
    this.breadcrumbItems = [];
    
    // Set page title and breadcrumbs based on route
    if (url.includes('/user-management')) {
      this.currentPageTitle = 'User Management';
      this.breadcrumbs = [
        { label: 'Dashboard', link: '/app/dashboard', icon: 'home' },
        { label: 'User Management', icon: 'user' }
      ];
      this.breadcrumbItems = [
        { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/app/dashboard' },
        { label: 'User Management', icon: 'pi pi-users' }
      ];
    } else if (url.includes('/user-detail')) {
      this.currentPageTitle = 'User Details';
      this.breadcrumbs = [
        { label: 'Dashboard', link: '/app/dashboard', icon: 'home' },
        { label: 'User Management', link: '/app/user-management', icon: 'user' },
        { label: 'User Details', icon: 'profile' }
      ];
      this.breadcrumbItems = [
        { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/app/dashboard' },
        { label: 'User Management', icon: 'pi pi-users', routerLink: '/app/user-management' },
        { label: 'User Details', icon: 'pi pi-user' }
      ];
    } else if (url.includes('/dashboard')) {
      this.currentPageTitle = 'Dashboard';
      this.breadcrumbs = [
        { label: 'Dashboard', icon: 'home' }
      ];
      this.breadcrumbItems = [
        { label: 'Dashboard', icon: 'pi pi-home' }
      ];
    } else {
      this.currentPageTitle = 'Azure User Role Manager';
      this.breadcrumbs = [];
      this.breadcrumbItems = [];
    }
  }
}
