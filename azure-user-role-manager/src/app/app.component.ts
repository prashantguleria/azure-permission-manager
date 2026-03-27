import { Component, signal, computed, inject, DestroyRef, effect } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, Router, NavigationEnd, RouterModule, RouterLinkActive } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { AuthService } from './services/auth.service';
import { filter, retry, catchError, of, timer } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';
import { UtilityService } from './services/utility.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, RouterLinkActive, DrawerModule, NgTemplateOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly utilityService = inject(UtilityService);
  readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  // Reactive state via signals
  readonly isCollapsed = signal(false);
  private readonly mobileQuery = window.matchMedia('(max-width: 768px)');
  readonly isMobile = signal(this.mobileQuery.matches);
  readonly drawerVisible = signal(false);
  readonly currentUser = signal<AccountInfo | null>(null);
  readonly showMainLayout = signal(false);
  readonly currentPageTitle = signal('');
  readonly breadcrumbs = signal<Array<{ label: string; link?: string; icon?: string }>>([]);
  readonly breadcrumbItems = signal<MenuItem[]>([]);

  // Derived state
  readonly userInitials = computed(() => {
    const user = this.currentUser();
    return this.utilityService.getUserInitials(user?.name ?? null);
  });

  readonly userName = computed(() => this.currentUser()?.name || 'User');

  readonly isDarkMode = computed(() => this.themeService.mode() === 'dark');

  /** Navigation items for the sidebar */
  readonly navItems = [
    { label: 'Tenants', icon: 'pi pi-building', route: '/app/tenants' },
    { label: 'User Management', icon: 'pi pi-users', route: '/app/user-management' },
    { label: 'Storage Accounts', icon: 'pi pi-database', route: '/app/storage-accounts' },
    { label: 'Resource Permissions', icon: 'pi pi-th-large', route: '/app/resource-permissions' },
    { label: 'Audit Logs', icon: 'pi pi-file-edit', route: '/app/audit-logs' }
  ];

  constructor() {
    // Listen to viewport changes for mobile detection
    this.mobileQuery.addEventListener('change', (e) => {
      this.isMobile.set(e.matches);
      if (!e.matches) {
        this.drawerVisible.set(false);
      }
    });

    // Listen to router events to update breadcrumbs and page title
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event: NavigationEnd) => {
        this.updatePageInfo(event.url);
        this.updateLayoutVisibility(event.url);
      });

    // Subscribe to current user changes (always active)
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user: AccountInfo | null) => {
        this.currentUser.set(user);
      });

    // Initialize authentication and handle redirect results with error boundaries
    this.initializeAuthenticationWithErrorBoundary();

    // Subscribe to recovery status for user feedback
    this.authService.recoveryStatus$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(status => {
        if (status.inProgress && status.message) {
          // Authentication recovery in progress
        }
      });
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.drawerVisible.update(v => !v);
    } else {
      this.isCollapsed.update(v => !v);
    }
  }

  closeDrawer(): void {
    this.drawerVisible.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  // ───────────────────────────────────────────
  // Authentication initialisation & error handling
  // ───────────────────────────────────────────

  /**
   * Initialize authentication with comprehensive error boundaries and recovery mechanisms
   */
  private initializeAuthenticationWithErrorBoundary(): void {
    try {
      this.authService.initializeAuth()
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          // Add retry logic for transient failures
          retry({
            count: 2,
            delay: (error, retryCount) => {
              // Authentication initialization attempt failed, retrying
              return timer(1000 * retryCount); // Exponential backoff
            }
          }),
          // Catch and handle errors gracefully
          catchError((error) => {
            console.error('Authentication initialization failed after retries:', error);
            this.handleAuthenticationInitializationError(error);
            return of(false); // Return false to indicate failure
          })
        )
        .subscribe({
          next: (result) => {
            this.handleAuthenticationInitializationSuccess(result);
          },
          error: (error) => {
            // This should not be reached due to catchError, but keeping as safety net
            console.error('Unexpected authentication initialization error:', error);
            this.handleAuthenticationInitializationError(error);
          }
        });
    } catch (error) {
      // Handle synchronous errors during subscription setup
      console.error('Critical error during authentication initialization setup:', error);
      this.handleAuthenticationInitializationError(error);
    }
  }

  /**
   * Handle successful authentication initialization
   */
  private handleAuthenticationInitializationSuccess(result: boolean): void {
    try {
      if (result) {
        this.handleSuccessfulAuthentication();
      } else {
        this.handleFailedAuthentication();
      }
    } catch (error) {
      console.error('Error handling authentication success:', error);
      this.fallbackToSafeState();
    }
  }

  /**
   * Handle authentication initialization errors
   */
  private handleAuthenticationInitializationError(error: any): void {
    try {
      console.error('Authentication initialization error:', error);

      // Clear potentially corrupted session data
      this.clearCorruptedSessionData();

      // Set safe default state
      this.fallbackToSafeState();

      // Show user-friendly error message if needed
      this.showAuthenticationErrorFeedback(error);

    } catch (fallbackError) {
      console.error('Critical error in error handler:', fallbackError);
      // Last resort: navigate to login with minimal state
      this.router.navigate(['/app/login']).catch(navError => {
        console.error('Failed to navigate to login:', navError);
      });
    }
  }

  /**
   * Handle successful authentication flow
   */
  private handleSuccessfulAuthentication(): void {
    setTimeout(() => {
      try {
        const currentRoute = this.router.url;

        // Check for post-tenant-switch redirect regardless of current route
        // (MSAL redirects back to '/' which is the homepage, not '/app')
        const postTenantSwitchRedirect = sessionStorage.getItem('postTenantSwitchRedirect');
        if (postTenantSwitchRedirect && this.authService.isAuthenticated()) {
          sessionStorage.removeItem('postTenantSwitchRedirect');
          this.router.navigate([postTenantSwitchRedirect]);
          this.updateLayoutVisibility(postTenantSwitchRedirect);
          return;
        }

        // Handle authentication redirects for /app routes
        if (currentRoute.startsWith('/app')) {
          if (this.authService.isAuthenticated()) {
            this.handleAuthenticatedUserRouting();
          } else {
            this.redirectToLogin('User not authenticated after successful initialization');
          }
        }

        this.updateLayoutVisibility(this.router.url);
      } catch (error) {
        console.error('Error in successful authentication handling:', error);
        this.fallbackToSafeState();
      }
    }, 50);
  }

  /**
   * Handle failed authentication flow
   */
  private handleFailedAuthentication(): void {
    try {
      // Check if fresh authentication is required
      const freshAuthRequired = sessionStorage.getItem('freshAuthRequired');
      if (freshAuthRequired) {
        sessionStorage.removeItem('freshAuthRequired');

        // Navigate to login page instead of automatic redirect
        if (this.router.url.startsWith('/app') && this.router.url !== '/app/login') {
          this.router.navigate(['/app/login']);
        }
      }

      this.updateLayoutVisibility(this.router.url);
    } catch (error) {
      console.error('Error handling failed authentication:', error);
      this.fallbackToSafeState();
    }
  }

  /**
   * Handle routing for authenticated users
   */
  private handleAuthenticatedUserRouting(): void {
    const currentRoute = this.router.url;

    if (currentRoute === '/app' || currentRoute === '/app/login') {
      // Check if user has already selected a tenant
      const selectedTenant = localStorage.getItem('selectedTenant');
      const currentUser = this.authService.getCurrentUser();

      if (selectedTenant) {
        this.router.navigate(['/app/user-management']);
      } else if (currentUser?.tenantId) {
        // Auto-select current tenant if no tenant selected
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
  }

  /**
   * Redirect to login with logging
   */
  private redirectToLogin(reason: string): void {
    const currentRoute = this.router.url;
    if (currentRoute !== '/app/login') {
      this.router.navigate(['/app/login']);
    }
  }

  /**
   * Clear potentially corrupted session data
   */
  private clearCorruptedSessionData(): void {
    try {
      const itemsToClear = [
        'freshAuthRequired',
        'postTenantSwitchRedirect',
        'autoReAuthScheduled',
        'authAttempts',
        'lastAuthAttempt',
        'manualLoginRequired'
      ];

      itemsToClear.forEach(item => {
        if (sessionStorage.getItem(item)) {
          sessionStorage.removeItem(item);
        }
      });
    } catch (error) {
      console.error('Error clearing corrupted session data:', error);
    }
  }

  /**
   * Fallback to safe application state
   */
  private fallbackToSafeState(): void {
    try {
      // Set layout visibility to safe default
      this.updateLayoutVisibility(this.router.url);

      // If we're in an app route and not already at login, navigate to login
      const currentRoute = this.router.url;
      if (currentRoute.startsWith('/app') && currentRoute !== '/app/login') {
        this.router.navigate(['/app/login']).catch(error => {
          console.error('Failed to navigate to safe state:', error);
        });
      }
    } catch (error) {
      console.error('Error setting fallback safe state:', error);
    }
  }

  /**
   * Show user-friendly error feedback
   */
  private showAuthenticationErrorFeedback(error: any): void {
    try {
      const errorMessage = this.getAuthenticationErrorMessage(error);
      sessionStorage.setItem('authInitializationError', errorMessage);
    } catch (feedbackError) {
      console.error('Error setting authentication error feedback:', feedbackError);
    }
  }

  /**
   * Get user-friendly error message based on error type
   */
  private getAuthenticationErrorMessage(error: any): string {
    if (error?.message?.includes('no_token_request_cache_error')) {
      return 'Authentication session expired. Please sign in again.';
    } else if (error?.message?.includes('state_not_found')) {
      return 'Authentication state error. Please try signing in again.';
    } else if (error?.message?.includes('network')) {
      return 'Network error during authentication. Please check your connection and try again.';
    } else {
      return 'Authentication error occurred. Please try signing in again.';
    }
  }

  private updateLayoutVisibility(url: string): void {
    // Hide main layout on login page and homepage
    this.showMainLayout.set(!url.includes('/login') && url !== '/');
  }

  private updatePageInfo(url: string): void {
    // Reset breadcrumbs
    this.breadcrumbs.set([]);
    this.breadcrumbItems.set([]);

    // Set page title and breadcrumbs based on route
    if (url.includes('/user-management')) {
      this.currentPageTitle.set('User Management');
      this.breadcrumbs.set([
        { label: 'Dashboard', link: '/app/user-management', icon: 'home' },
        { label: 'User Management', icon: 'user' }
      ]);
      this.breadcrumbItems.set([
        { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/app/user-management' },
        { label: 'User Management', icon: 'pi pi-users' }
      ]);
    } else if (url.includes('/user-detail')) {
      this.currentPageTitle.set('User Details');
      this.breadcrumbs.set([
        { label: 'Dashboard', link: '/app/user-management', icon: 'home' },
        { label: 'User Management', link: '/app/user-management', icon: 'user' },
        { label: 'User Details', icon: 'profile' }
      ]);
      this.breadcrumbItems.set([
        { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/app/user-management' },
        { label: 'User Management', icon: 'pi pi-users', routerLink: '/app/user-management' },
        { label: 'User Details', icon: 'pi pi-user' }
      ]);
    } else if (url.includes('/dashboard')) {
      this.currentPageTitle.set('Dashboard');
      this.breadcrumbs.set([
        { label: 'Dashboard', icon: 'home' }
      ]);
      this.breadcrumbItems.set([
        { label: 'Dashboard', icon: 'pi pi-home' }
      ]);
    } else {
      this.currentPageTitle.set('Azure User Role Manager');
      this.breadcrumbs.set([]);
      this.breadcrumbItems.set([]);
    }
  }
}
