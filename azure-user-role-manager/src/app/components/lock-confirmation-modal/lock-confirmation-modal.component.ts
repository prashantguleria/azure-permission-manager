import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    MessageModule
  ],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="onCancel()"
      header="Resource Lock Detected"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="lock-confirmation-modal"
      [style]="{width: '600px'}"
      (onHide)="onCancel()">
      <ng-template #content>
        <p-message
          severity="warn"
          [text]="alertMessage() + ': ' + alertDescription()"
          styleClass="alert-message">
          <ng-template #icon>
            <i class="pi pi-exclamation-triangle"></i>
          </ng-template>
        </p-message>

        <section class="lock-details">
          <h4><i class="pi pi-lock icon-warning"></i> Lock Details</h4>
          <div class="lock-list">
            @for (lock of data()?.locks; track lock.name) {
              <div class="lock-item">
                <div class="lock-item-header">
                  <strong>{{ lock.name }}</strong>
                  <span class="lock-level-badge" [class]="getLockLevelClass(lock.level)">{{ lock.level }}</span>
                </div>
                @if (lock.notes) {
                  <div class="lock-notes">
                    <strong>Notes:</strong> {{ lock.notes }}
                  </div>
                }
              </div>
            }
          </div>
        </section>

        <section class="workflow-explanation">
          <h4><i class="pi pi-info-circle icon-info"></i> What will happen:</h4>
          <ol class="workflow-steps">
            <li>The lock(s) will be temporarily removed</li>
            <li>The {{ data()?.operationType }} operation will be performed</li>
            <li>The lock(s) will be recreated with the same configuration</li>
          </ol>
        </section>

        <p-message
          severity="info"
          text="Security Notice: The resource will be temporarily unprotected during this operation. The lock will be recreated immediately after completion."
          styleClass="security-notice" />
      </ng-template>

      <ng-template #footer>
        <div class="modal-footer">
          <button class="btn btn-text" (click)="onCancel()">
            <i class="pi pi-times"></i> Cancel
          </button>
          <button class="btn btn-danger" [disabled]="loading()" (click)="onConfirm()">
            @if (loading()) {
              <i class="pi pi-spinner pi-spin"></i>
            } @else {
              <i class="pi pi-unlock"></i>
            }
            Remove Lock &amp; Continue
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .alert-message {
      margin-bottom: var(--space-4);
    }

    .lock-details h4,
    .workflow-explanation h4 {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .icon-warning {
      color: var(--color-warning);
    }

    .icon-info {
      color: var(--color-info);
    }

    .lock-list {
      margin-top: var(--space-2);
    }

    .lock-item {
      transition: all var(--transition-base);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      margin-bottom: var(--space-2);
      background-color: var(--color-surface-hover);
    }

    .lock-item:hover {
      border-color: var(--color-border-strong);
      box-shadow: var(--shadow-sm);
    }

    .lock-item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .lock-level-badge {
      padding: 2px var(--space-2);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      font-weight: 500;
    }

    .lock-level-readonly {
      background-color: var(--color-warning-bg);
      color: var(--color-warning);
    }

    .lock-level-cannotdelete {
      background-color: var(--color-danger-bg);
      color: var(--color-danger);
    }

    .lock-notes {
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-top: var(--space-1);
    }

    .workflow-explanation {
      margin-top: var(--space-4);
    }

    .workflow-steps {
      list-style-type: decimal;
      list-style-position: inside;
      margin-top: var(--space-2);
      font-size: var(--font-size-sm);
    }

    .workflow-steps li + li {
      margin-top: var(--space-1);
    }

    .security-notice {
      margin-top: var(--space-4);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) 0 0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-base);
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all var(--transition-fast);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-text {
      background: transparent;
      color: var(--color-text-secondary);
      border-color: transparent;
    }

    .btn-text:hover:not(:disabled) {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }

    .btn-danger {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border-color: var(--color-danger);
    }

    .btn-danger:hover:not(:disabled) {
      opacity: 0.9;
    }
  `]
})
export class LockConfirmationModalComponent {
  readonly visible = input(false);
  readonly loading = input(false);
  readonly data = input<LockConfirmationData | null>(null);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly alertMessage = computed(() => {
    const lockCount = this.data()?.lockCount || 0;
    return `Resource Lock${lockCount > 1 ? 's' : ''} Preventing Operation`;
  });

  readonly alertDescription = computed(() => {
    const lockCount = this.data()?.lockCount || 0;
    const resourceName = this.data()?.resourceName || 'this resource';
    const operationType = this.data()?.operationType || 'the operation';
    return `${resourceName} has ${lockCount} active lock${lockCount > 1 ? 's' : ''} that prevent${lockCount === 1 ? 's' : ''} ${operationType}. To proceed, the lock${lockCount > 1 ? 's' : ''} must be temporarily removed.`;
  });

  getLockLevelClass(level: string): string {
    switch (level?.toLowerCase()) {
      case 'readonly':
        return 'lock-level-badge lock-level-readonly';
      case 'cannotdelete':
        return 'lock-level-badge lock-level-cannotdelete';
      default:
        return 'lock-level-badge';
    }
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
