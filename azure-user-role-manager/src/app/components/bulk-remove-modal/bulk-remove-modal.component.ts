import { Component, input, output, effect, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

export interface RemovePermissionRequest {
  roleAssignmentIds: string[];
}

@Component({
  selector: 'app-bulk-remove-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogModule,
    CheckboxModule,
    DividerModule
  ],
  template: `
    <p-dialog
      [visible]="visible()"
      header="Remove Permissions from Storage Accounts"
      (onHide)="onCancel()"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="bulk-remove-modal">

      <ng-template #content>
        <div class="bulk-remove-permission-form">
          <div class="selected-accounts">
            <h4>Removing permissions from {{ selectedAccounts().length }} storage account(s):</h4>
            <ul>
              @for (account of selectedAccounts(); track account.name) {
                <li>{{ account.name }}</li>
              }
            </ul>
          </div>

          <p-divider />

          @if (roleAssignments().length > 0) {
            <div class="permissions-list">
              <h4>Select permissions to remove:</h4>
              <form [formGroup]="removeForm">
                <div formArrayName="selectedAssignments">
                  @for (assignment of roleAssignments(); track assignment.id; let i = $index) {
                    <div class="permission-item">
                      <p-checkbox
                        [formControlName]="i"
                        [binary]="true"
                        [inputId]="'checkbox-' + i" />
                      <label [for]="'checkbox-' + i" class="permission-label">
                        <div class="permission-details">
                          <div class="role-name">{{ assignment.roleDefinitionName }}</div>
                          <div class="principal-info">
                            <span class="principal-name">{{ assignment.principalName || assignment.principalId }}</span>
                            <span class="principal-type">({{ assignment.principalType }})</span>
                          </div>
                          <div class="scope">Scope: {{ assignment.scope }}</div>
                        </div>
                      </label>
                    </div>
                  }
                </div>
              </form>
            </div>
          } @else {
            <div class="no-permissions">
              <p>No role assignments found for the selected storage accounts.</p>
            </div>
          }
        </div>
      </ng-template>

      <ng-template #footer>
        <div class="modal-footer">
          <button class="btn btn-text" (click)="onCancel()">
            <i class="pi pi-times"></i> Cancel
          </button>
          <button class="btn btn-danger" [disabled]="loading()" (click)="onOk()">
            @if (loading()) {
              <i class="pi pi-spinner pi-spin"></i>
            } @else {
              <i class="pi pi-trash"></i>
            }
            Remove Selected Permissions
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .bulk-remove-permission-form {
      padding: var(--space-4) 0;
    }

    .selected-accounts {
      margin-bottom: var(--space-4);
      padding: var(--space-3);
      background: var(--color-surface-hover);
      border-radius: var(--radius-sm);
    }

    .selected-accounts h4 {
      margin: 0 0 var(--space-2) 0;
    }

    .selected-accounts ul {
      margin: 0;
      padding-left: var(--space-5);
    }

    .permissions-list h4 {
      margin-bottom: var(--space-4);
    }

    .permissions-list {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: var(--space-3);
    }

    .permission-item {
      margin-bottom: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
    }

    .permission-item:hover {
      background: var(--color-surface-hover);
    }

    .permission-label {
      flex: 1;
      cursor: pointer;
    }

    .permission-details {
      margin: 0;
    }

    .role-name {
      font-weight: 500;
      color: var(--color-text);
      margin-bottom: var(--space-1);
    }

    .principal-info {
      margin-bottom: var(--space-1);
    }

    .principal-name {
      color: var(--color-text-secondary);
    }

    .principal-type {
      color: var(--color-text-tertiary);
      font-size: var(--font-size-xs);
    }

    .scope {
      font-size: var(--font-size-xs);
      color: var(--color-text-tertiary);
    }

    .no-permissions {
      text-align: center;
      padding: var(--space-6);
      color: var(--color-text-tertiary);
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
export class BulkRemoveModalComponent {
  readonly visible = input(false);
  readonly selectedAccounts = input<any[]>([]);
  readonly roleAssignments = input<any[]>([]);
  readonly loading = input(false);
  readonly visibleChange = output<boolean>();
  readonly removeRequest = output<RemovePermissionRequest>();

  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);

  removeForm: FormGroup;

  constructor() {
    this.removeForm = this.fb.group({
      selectedAssignments: this.fb.array([])
    });

    // Replace ngOnChanges with effect() to react to input changes
    effect(() => {
      const assignments = this.roleAssignments();
      if (assignments) {
        this.updateFormArray();
      }
    });
  }

  private updateFormArray() {
    const formArray = this.fb.array(
      this.roleAssignments().map(() => this.fb.control(false))
    );
    this.removeForm.setControl('selectedAssignments', formArray);
  }

  get selectedAssignmentsArray() {
    return this.removeForm.get('selectedAssignments') as FormArray;
  }

  onCancel() {
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onOk() {
    const selectedIndices = this.selectedAssignmentsArray.value
      .map((selected: boolean, index: number) => selected ? index : -1)
      .filter((index: number) => index !== -1);

    if (selectedIndices.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please select at least one permission to remove'
      });
      return;
    }

    const selectedRoleAssignmentIds = selectedIndices.map(
      (index: number) => this.roleAssignments()[index].id
    );

    this.removeRequest.emit({
      roleAssignmentIds: selectedRoleAssignmentIds
    });
  }

  private resetForm() {
    this.updateFormArray();
  }
}
