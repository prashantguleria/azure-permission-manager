import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { DividerModule } from 'primeng/divider';

export interface RemovePermissionRequest {
  roleAssignmentIds: string[];
}

@Component({
  selector: 'app-bulk-remove-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    CheckboxModule,
    ButtonModule,
    DividerModule
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      header="Remove Permissions from Storage Accounts"
      (onHide)="onCancel()"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="bulk-remove-modal">
      
      <ng-template pTemplate="content">
        <div class="bulk-remove-permission-form">
          <div class="selected-accounts">
            <h4>Removing permissions from {{ selectedAccounts.length }} storage account(s):</h4>
            <ul>
              <li *ngFor="let account of selectedAccounts">{{ account.name }}</li>
            </ul>
          </div>
          
          <p-divider></p-divider>
          
          <div class="permissions-list" *ngIf="roleAssignments.length > 0">
            <h4>Select permissions to remove:</h4>
            <form [formGroup]="removeForm">
              <div formArrayName="selectedAssignments">
                <div 
                  *ngFor="let assignment of roleAssignments; let i = index" 
                  class="permission-item">
                  <p-checkbox 
                    [formControlName]="i"
                    [binary]="true"
                    inputId="checkbox-{{i}}">
                  </p-checkbox>
                  <label for="checkbox-{{i}}" class="permission-label">
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
              </div>
            </form>
          </div>
          
          <div class="no-permissions" *ngIf="roleAssignments.length === 0">
            <p>No role assignments found for the selected storage accounts.</p>
          </div>
        </div>
      </ng-template>
      
      <ng-template pTemplate="footer">
        <p-button 
          label="Cancel" 
          icon="pi pi-times" 
          (onClick)="onCancel()"
          styleClass="p-button-text">
        </p-button>
        <p-button 
          label="Remove Selected Permissions" 
          icon="pi pi-trash" 
          (onClick)="onOk()"
          [loading]="loading"
          severity="danger">
        </p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .bulk-remove-permission-form {
      padding: 16px 0;
    }
    .selected-accounts {
      margin-bottom: 16px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    .selected-accounts h4 {
      margin: 0 0 8px 0;
    }
    .selected-accounts ul {
      margin: 0;
      padding-left: 20px;
    }
    .permissions-list h4 {
      margin-bottom: 16px;
    }
    .permissions-list {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      padding: 12px;
    }
    .permission-item {
      margin-bottom: 12px;
      padding: 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      background: #fafafa;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .permission-item:hover {
      background: #f0f0f0;
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
      color: #262626;
      margin-bottom: 4px;
    }
    .principal-info {
      margin-bottom: 4px;
    }
    .principal-name {
      color: #595959;
    }
    .principal-type {
      color: #8c8c8c;
      font-size: 12px;
    }
    .scope {
      font-size: 12px;
      color: #8c8c8c;
    }
    .no-permissions {
      text-align: center;
      padding: 24px;
      color: #8c8c8c;
    }
  `]
})
export class BulkRemoveModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() selectedAccounts: any[] = [];
  @Input() roleAssignments: any[] = [];
  @Input() loading = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() removeRequest = new EventEmitter<RemovePermissionRequest>();

  removeForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService
  ) {
    this.removeForm = this.fb.group({
      selectedAssignments: this.fb.array([])
    });
  }

  ngOnChanges() {
    if (this.roleAssignments) {
      this.updateFormArray();
    }
  }

  private updateFormArray() {
    const formArray = this.fb.array(
      this.roleAssignments.map(() => this.fb.control(false))
    );
    this.removeForm.setControl('selectedAssignments', formArray);
  }

  get selectedAssignmentsArray() {
    return this.removeForm.get('selectedAssignments') as FormArray;
  }

  onCancel() {
    this.visible = false;
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
      (index: number) => this.roleAssignments[index].id
    );

    this.removeRequest.emit({
      roleAssignmentIds: selectedRoleAssignmentIds
    });
  }

  private resetForm() {
    this.updateFormArray();
  }
}