import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAlertModule } from 'ng-zorro-antd/alert';

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
    NzModalModule,
    NzButtonModule,
    NzIconModule,
    NzAlertModule
  ],
  template: `
    <nz-modal
      [(nzVisible)]="visible"
      nzTitle="Resource Lock Detected"
      [nzOkText]="'Remove Lock & Continue'"
      [nzCancelText]="'Cancel'"
      [nzOkType]="'primary'"
      [nzOkDanger]="true"
      [nzOkLoading]="loading"
      (nzOnOk)="onConfirm()"
      (nzOnCancel)="onCancel()"
      nzWidth="600px"
    >
      <ng-container *nzModalContent>
        <nz-alert
          nzType="warning"
          nzShowIcon
          [nzMessage]="alertMessage"
          [nzDescription]="alertDescription"
          class="mb-4"
        ></nz-alert>
        
        <div class="lock-details">
          <h4><i nz-icon nzType="lock" class="text-orange-500"></i> Lock Details</h4>
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
          <h4><i nz-icon nzType="info-circle" class="text-blue-500"></i> What will happen:</h4>
          <ol class="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li>The lock(s) will be temporarily removed</li>
            <li>The {{ data?.operationType }} operation will be performed</li>
            <li>The lock(s) will be recreated with the same configuration</li>
          </ol>
        </div>
        
        <nz-alert
          nzType="info"
          nzShowIcon
          nzMessage="Security Notice"
          nzDescription="The resource will be temporarily unprotected during this operation. The lock will be recreated immediately after completion."
          class="mt-4"
        ></nz-alert>
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    .lock-item {
      transition: all 0.2s ease;
    }
    
    .lock-item:hover {
      border-color: #d1d5db;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .lock-level-readonly {
      background-color: #fef3c7;
      color: #92400e;
    }
    
    .lock-level-cannotdelete {
      background-color: #fee2e2;
      color: #991b1b;
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