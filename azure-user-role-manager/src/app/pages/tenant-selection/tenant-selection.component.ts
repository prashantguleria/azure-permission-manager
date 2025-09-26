import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../services/auth.service';
import { AzureApiService } from '../../services/azure-api.service';
import { Tenant } from '../../models/tenant.model';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-tenant-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    ProgressSpinnerModule,
    TagModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './tenant-selection.component.html',
  styleUrl: './tenant-selection.component.scss'
})
export class TenantSelectionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  tenants: Tenant[] = [];
  filteredTenants: Tenant[] = [];
  searchTerm = '';
  isLoading = false;


  constructor(
    private authService: AuthService,
    private azureApiService: AzureApiService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTenants(): void {
    this.isLoading = true;
    
    this.azureApiService.getTenants()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tenants) => {
          this.tenants = tenants;
          this.filteredTenants = [...this.tenants];
          this.isLoading = false;
          
          if (tenants.length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'No tenants found for your account' });
          }
        },
        error: (error) => {
          console.error('Error loading tenants:', error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load tenants. Please try again.' });
          this.isLoading = false;
          
          // Fallback to empty array on error
          this.tenants = [];
          this.filteredTenants = [];
        }
      });
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredTenants = [...this.tenants];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredTenants = this.tenants.filter(tenant => 
      tenant.displayName.toLowerCase().includes(term) ||
      tenant.defaultDomain.toLowerCase().includes(term)
    );
  }

  selectTenant(tenant: Tenant): void {
    if (tenant.isDefault) {
      // If it's the current tenant, just navigate
      this.messageService.add({ severity: 'success', summary: 'Success', detail: `Already connected to tenant: ${tenant.displayName}` });
      localStorage.setItem('selectedTenant', JSON.stringify(tenant));
      this.router.navigate(['/app/user-management']);
      return;
    }

    // Show loading message for tenant switch
    this.messageService.add({ severity: 'info', summary: 'Info', detail: `Switching to tenant: ${tenant.displayName}...` });
    
    // Store tenant info for after redirect
    localStorage.setItem('selectedTenant', JSON.stringify(tenant));
    
    // Switch to the selected tenant - this will trigger a redirect
    this.azureApiService.switchToTenant(tenant.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            // The redirect will happen automatically, no need to navigate here
            console.log(`Tenant switch initiated for: ${tenant.displayName}`);
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
