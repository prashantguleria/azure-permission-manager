import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzLayoutModule } from 'ng-zorro-antd/layout';

import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzGridModule } from 'ng-zorro-antd/grid';
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
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzSpinModule,
    NzEmptyModule,
    NzTypographyModule,
    NzLayoutModule,

    NzTagModule,
    NzMessageModule,
    NzGridModule
  ],
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
    private message: NzMessageService
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
            this.message.warning('No tenants found for your account');
          }
        },
        error: (error) => {
          console.error('Error loading tenants:', error);
          this.message.error('Failed to load tenants. Please try again.');
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
      this.message.success(`Already connected to tenant: ${tenant.displayName}`);
      localStorage.setItem('selectedTenant', JSON.stringify(tenant));
      this.router.navigate(['/user-management']);
      return;
    }

    // Show loading message for tenant switch
    this.message.loading(`Switching to tenant: ${tenant.displayName}...`, { nzDuration: 0 });
    
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
            this.message.remove();
            this.message.error(`Failed to switch to tenant: ${tenant.displayName}`);
          }
        },
        error: (error) => {
          console.error('Error switching tenant:', error);
          this.message.remove();
          this.message.error(`Error switching to tenant: ${tenant.displayName}`);
        }
      });
  }


}
