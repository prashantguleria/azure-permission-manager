import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-permission-details',
  standalone: true,
  imports: [CommonModule, ButtonModule, DividerModule],
  template: `
    <div class="permission-details p-4">
      <div class="mb-4">
        <h4 class="text-lg font-semibold mb-3">Principal Information</h4>
        <div class="grid grid-cols-1 gap-2">
          <div><strong>Name:</strong> {{ permission?.properties?.principalDisplayName || 'Unknown' }}</div>
          <div><strong>Email:</strong> {{ permission?.properties?.principalEmail || 'Not available' }}</div>
          <div><strong>ID:</strong> {{ permission?.properties?.principalId }}</div>
          <div><strong>Type:</strong> {{ permission?.properties?.principalType }}</div>
        </div>
      </div>
      
      <div class="mb-4">
        <h4 class="text-lg font-semibold mb-3">Role Assignment</h4>
        <div class="grid grid-cols-1 gap-2">
          <div><strong>Role:</strong> {{ permission?.properties?.roleDefinitionName }}</div>
          <div><strong>Scope:</strong> {{ permission?.properties?.scope }}</div>
          <div><strong>Created:</strong> {{ formatDate(permission?.properties?.createdOn) }}</div>
          <div><strong>Updated:</strong> {{ formatDate(permission?.properties?.updatedOn) }}</div>
        </div>
      </div>
      
      <div class="flex justify-end mt-4">
        <p-button 
          label="Close" 
          (onClick)="close()"
          styleClass="p-button-secondary">
        </p-button>
      </div>
    </div>
  `,
  styles: [`
    .permission-details {
      min-width: 400px;
    }
    
    .grid {
      display: grid;
    }
    
    .grid-cols-1 {
      grid-template-columns: repeat(1, minmax(0, 1fr));
    }
    
    .gap-2 {
      gap: 0.5rem;
    }
    
    .mb-3 {
      margin-bottom: 0.75rem;
    }
    
    .mb-4 {
      margin-bottom: 1rem;
    }
    
    .mt-4 {
      margin-top: 1rem;
    }
    
    .p-4 {
      padding: 1rem;
    }
    
    .text-lg {
      font-size: 1.125rem;
    }
    
    .font-semibold {
      font-weight: 600;
    }
    
    .justify-end {
      justify-content: flex-end;
    }
    
    .flex {
      display: flex;
    }
  `]
})
export class PermissionDetailsComponent {
  permission: any;

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig
  ) {
    this.permission = this.config.data?.permission;
  }

  close(): void {
    this.ref.close();
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleString();
  }
}