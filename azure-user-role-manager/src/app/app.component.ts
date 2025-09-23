import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { AuthService } from './services/auth.service';
import { Subject, takeUntil, filter } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';
import { UtilityService } from './services/utility.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, NzIconModule, NzLayoutModule, NzMenuModule, NzAvatarModule, NzButtonModule, NzGridModule, NzBreadCrumbModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  isCollapsed = false;
  currentUser: AccountInfo | null = null;
  showMainLayout = false;
  currentPageTitle: string = '';
  breadcrumbs: Array<{label: string, link?: string, icon?: string}> = [];
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
            
            // Add a small delay to ensure MSAL state is fully updated
            setTimeout(() => {
              // Check if user is authenticated and redirect appropriately
                if (this.authService.isAuthenticated()) {
                  const currentRoute = this.router.url;
                  
                  // Check if this is a redirect after tenant switching
                  const postTenantSwitchRedirect = sessionStorage.getItem('postTenantSwitchRedirect');
                  if (postTenantSwitchRedirect) {
                    console.log('Redirecting after tenant switch to:', postTenantSwitchRedirect);
                    sessionStorage.removeItem('postTenantSwitchRedirect');
                    this.router.navigate([postTenantSwitchRedirect]);
                  } else if (currentRoute === '/' || currentRoute === '/login') {
                    // Check if user has already selected a tenant
                    const selectedTenant = localStorage.getItem('selectedTenant');
                    const currentUser = this.authService.getCurrentUser();
                    
                    if (selectedTenant) {
                      console.log('User has selected tenant, redirecting to user management');
                      this.router.navigate(['/user-management']);
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
                      this.router.navigate(['/user-management']);
                    } else {
                      this.router.navigate(['/tenants']);
                    }
                  }
                } else {
                  console.log('User not authenticated after initialization, redirecting to login');
                  const currentRoute = this.router.url;
                  if (currentRoute !== '/login') {
                    this.router.navigate(['/login']);
                  }
                }
              
              // Set initial layout visibility
              this.updateLayoutVisibility(this.router.url);
            }, 100); // Small delay to ensure state consistency
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
    // Hide main layout on login page
    this.showMainLayout = !url.includes('/login');
  }

  private updatePageInfo(url: string): void {
    // Reset breadcrumbs
    this.breadcrumbs = [];
    
    // Set page title and breadcrumbs based on route
    if (url.includes('/user-management')) {
      this.currentPageTitle = 'User Management';
      this.breadcrumbs = [
        { label: 'Dashboard', link: '/dashboard', icon: 'home' },
        { label: 'User Management', icon: 'user' }
      ];
    } else if (url.includes('/user-detail')) {
      this.currentPageTitle = 'User Details';
      this.breadcrumbs = [
        { label: 'Dashboard', link: '/dashboard', icon: 'home' },
        { label: 'User Management', link: '/user-management', icon: 'user' },
        { label: 'User Details', icon: 'profile' }
      ];
    } else if (url.includes('/dashboard')) {
      this.currentPageTitle = 'Dashboard';
      this.breadcrumbs = [
        { label: 'Dashboard', icon: 'home' }
      ];
    } else {
      this.currentPageTitle = 'Azure User Role Manager';
      this.breadcrumbs = [];
    }
  }
}
