import { Component, signal, inject, DestroyRef, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ButtonModule, ProgressSpinnerModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly showManualLoginPrompt = signal(false);
  readonly authenticationMessage = signal('');

  constructor() {
    afterNextRender(() => {
      // Check if user is already authenticated
      if (this.authService.isAuthenticated()) {
        this.router.navigate(['/app/tenants']);
        return;
      }

      // Check if manual login is required due to authentication recovery failure
      const manualLoginRequired = sessionStorage.getItem('manualLoginRequired');
      if (manualLoginRequired === 'true') {
        this.showManualLoginPrompt.set(true);
        this.authenticationMessage.set('Your session has expired. Please sign in again to continue.');
        sessionStorage.removeItem('manualLoginRequired');
      }

      // Check for authentication initialization errors
      const authInitError = sessionStorage.getItem('authInitializationError');
      if (authInitError) {
        this.showManualLoginPrompt.set(true);
        this.authenticationMessage.set(authInitError);
        sessionStorage.removeItem('authInitializationError');
      }
    });
  }

  login(): void {
    this.isLoading.set(true);
    this.showManualLoginPrompt.set(false);
    this.authenticationMessage.set('');

    try {
      this.authService.login();
      // Note: isLoading will be reset when the page redirects or reloads
      // The redirect will happen automatically after Microsoft authentication
    } catch (error) {
      console.error('Login error:', error);
      this.isLoading.set(false);
      this.authenticationMessage.set('Login failed. Please try again.');
    }
  }

  retryLogin(): void {
    this.login();
  }
}
