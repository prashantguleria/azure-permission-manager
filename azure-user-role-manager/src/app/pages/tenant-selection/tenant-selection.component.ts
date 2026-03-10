import { Component, signal, computed, inject, DestroyRef, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../services/auth.service';
import { AzureApiService } from '../../services/azure-api.service';
import { Tenant } from '../../models/tenant.model';

@Component({
  selector: 'app-tenant-selection',
  standalone: true,
  imports: [FormsModule, ToastModule],
  providers: [MessageService],
  templateUrl: './tenant-selection.component.html',
  styleUrl: './tenant-selection.component.scss'
})
export class TenantSelectionComponent {
  private readonly authService = inject(AuthService);
  private readonly azureApiService = inject(AzureApiService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tenants = signal<Tenant[]>([]);
  readonly searchTerm = signal('');
  readonly isLoading = signal(false);

  readonly filteredTenants = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const all = this.tenants();
    if (!term) {
      return all;
    }
    return all.filter(t =>
      t.displayName.toLowerCase().includes(term) ||
      t.defaultDomain.toLowerCase().includes(term)
    );
  });

  constructor() {
    afterNextRender(() => {
      this.loadTenants();
    });
  }

  private loadTenants(): void {
    this.isLoading.set(true);

    this.azureApiService.getTenants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tenants) => {
          this.tenants.set(tenants);
          this.isLoading.set(false);

          if (tenants.length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'No tenants found for your account' });
          }
        },
        error: (error) => {
          console.error('Error loading tenants:', error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load tenants. Please try again.' });
          this.isLoading.set(false);
          this.tenants.set([]);
        }
      });
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  selectTenant(tenant: Tenant): void {
    if (tenant.isDefault) {
      this.messageService.add({ severity: 'success', summary: 'Success', detail: `Already connected to tenant: ${tenant.displayName}` });
      localStorage.setItem('selectedTenant', JSON.stringify(tenant));
      this.router.navigate(['/app/user-management']);
      return;
    }

    this.messageService.add({ severity: 'info', summary: 'Info', detail: `Switching to tenant: ${tenant.displayName}...` });
    localStorage.setItem('selectedTenant', JSON.stringify(tenant));

    this.azureApiService.switchToTenant(tenant.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (success) => {
          if (success) {
            // Tenant switch initiated
          } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: `Failed to switch to tenant: ${tenant.displayName}` });
          }
        },
        error: (error) => {
          console.error('Error switching tenant:', error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: `Error switching to tenant: ${tenant.displayName}` });
        }
      });
  }
}
