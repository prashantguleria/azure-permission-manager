import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

export interface LockConfirmationData {
  resourceName: string;
  operationType: string;
  lockCount: number;
  locks: Array<{
    name: string;
    level: string;
    notes?: string;
  }>;
}

@Component({
  selector: 'app-lock-confirmation-modal',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    MessageModule
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      header="Resource Lock Detected"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="lock-confirmation-modal"
      [style]="{width: '600px'}"
      (onHide)="onCancel()">
      <ng-template pTemplate="content">
        <p-message
          severity="warn"
          [text]="alertMessage + ': ' + alertDescription"
          styleClass="mb-4">
          <ng-template pTemplate="icon">
            <i class="pi pi-exclamation-triangle"></i>
          </ng-template>
        </p-message>
        
        <div class="lock-details">
          <h4><i class="pi pi-lock text-orange-500"></i> Lock Details</h4>
          <div class="lock-list mt-2">
            <div 
              *ngFor="let lock of data?.locks" 
              class="lock-item p-3 border border-gray-200 rounded mb-2 bg-gray-50"
            >
              <div class="flex justify-between items-start">
                <div>
                  <strong>{{ lock.name }}</strong>
                  <span class="ml-2 px-2 py-1 text-xs rounded" 
                        [class]="getLockLevelClass(lock.level)">{{ lock.level }}</span>
                </div>
              </div>
              <div *ngIf="lock.notes" class="text-sm text-gray-600 mt-1">
                <strong>Notes:</strong> {{ lock.notes }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="workflow-explanation mt-4">
          <h4><i class="pi pi-info-circle text-blue-500"></i> What will happen:</h4>
          <ol class="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li>The lock(s) will be temporarily removed</li>
            <li>The {{ data?.operationType }} operation will be performed</li>
            <li>The lock(s) will be recreated with the same configuration</li>
          </ol>
        </div>
        
        <p-message
          severity="info"
          text="Security Notice: The resource will be temporarily unprotected during this operation. The lock will be recreated immediately after completion."
          styleClass="mt-4">
          <ng-template pTemplate="icon">
            <i class="pi pi-info-circle"></i>
          </ng-template>
        </p-message>
       </ng-template>
       
       <ng-template pTemplate="footer">
         <p-button
           label="Cancel"
           icon="pi pi-times"
           [text]="true"
           (onClick)="onCancel()"
           styleClass="p-button-text">
         </p-button>
         <p-button
           label="Remove Lock & Continue"
           icon="pi pi-unlock"
           [loading]="loading"
           (onClick)="onConfirm()"
           styleClass="p-button-danger">
         </p-button>
       </ng-template>
     </p-dialog>
  `,
  styles: [`
    .lock-details h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 600;
      color: #495057;
    }
    
    .workflow-explanation h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 600;
      color: #495057;
    }
    
    .lock-item {
      transition: all 0.2s ease;
      padding: 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      margin-bottom: 8px;
      background-color: #f8f9fa;
    }
    
    .lock-item:hover {
      border-color: #adb5bd;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .lock-level-readonly {
      background-color: #fff3cd;
      color: #856404;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .lock-level-cannotdelete {
      background-color: #f8d7da;
      color: #721c24;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .text-orange-500 {
      color: #f97316;
    }
    
    .text-blue-500 {
      color: #3b82f6;
    }
    
    .mb-4 {
      margin-bottom: 1rem;
    }
    
    .mt-4 {
      margin-top: 1rem;
    }
    
    .mt-2 {
      margin-top: 0.5rem;
    }
    
    .mt-1 {
      margin-top: 0.25rem;
    }
    
    .list-decimal {
      list-style-type: decimal;
    }
    
    .list-inside {
      list-style-position: inside;
    }
    
    .space-y-1 > * + * {
      margin-top: 0.25rem;
    }
    
    .text-sm {
      font-size: 14px;
    }
    
    .text-gray-600 {
      color: #6b7280;
    }
    
    ::ng-deep .lock-confirmation-modal .p-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
    }
  `]
})
export class LockConfirmationModalComponent {
  @Input() visible = false;
  @Input() loading = false;
  @Input() data: LockConfirmationData | null = null;
  
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  
  get alertMessage(): string {
    const lockCount = this.data?.lockCount || 0;
    return `Resource Lock${lockCount > 1 ? 's' : ''} Preventing Operation`;
  }
  
  get alertDescription(): string {
    const lockCount = this.data?.lockCount || 0;
    const resourceName = this.data?.resourceName || 'this resource';
    const operationType = this.data?.operationType || 'the operation';
    
    return `${resourceName} has ${lockCount} active lock${lockCount > 1 ? 's' : ''} that prevent${lockCount === 1 ? 's' : ''} ${operationType}. To proceed, the lock${lockCount > 1 ? 's' : ''} must be temporarily removed.`;
  }
  
  getLockLevelClass(level: string): string {
    switch (level?.toLowerCase()) {
      case 'readonly':
        return 'lock-level-readonly';
      case 'cannotdelete':
        return 'lock-level-cannotdelete';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  }
  
  onConfirm(): void {
    this.confirm.emit();
  }
  
  onCancel(): void {
    this.cancel.emit();
  }
}