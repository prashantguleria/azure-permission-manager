import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDividerModule } from 'ng-zorro-antd/divider';

export interface RemovePermissionRequest {
  roleAssignmentIds: string[];
}

@Component({
  selector: 'app-bulk-remove-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzCheckboxModule,
    NzButtonModule,
    NzDividerModule
  ],
  template: `
    <nz-modal
      [(nzVisible)]="visible"
      nzTitle="Remove Permissions from Storage Accounts"
      (nzOnCancel)="onCancel()"
      (nzOnOk)="onOk()"
      [nzOkLoading]="loading"
      nzOkText="Remove Selected Permissions"
      nzCancelText="Cancel"
      [nzOkType]="'primary'"
      [nzOkDanger]="true">
      
      <ng-container *nzModalContent>
        <div class="bulk-remove-permission-form">
          <div class="selected-accounts">
            <h4>Removing permissions from {{ selectedAccounts.length }} storage account(s):</h4>
            <ul>
              <li *ngFor="let account of selectedAccounts">{{ account.name }}</li>
            </ul>
          </div>
          
          <nz-divider></nz-divider>
          
          <div class="permissions-list" *ngIf="roleAssignments.length > 0">
            <h4>Select permissions to remove:</h4>
            <form nz-form [formGroup]="removeForm">
              <div formArrayName="selectedAssignments">
                <div 
                  *ngFor="let assignment of roleAssignments; let i = index" 
                  class="permission-item">
                  <label nz-checkbox [formControlName]="i">
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
      </ng-container>
    </nz-modal>
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
    }
    .permission-item:hover {
      background: #f0f0f0;
    }
    .permission-details {
      margin-left: 8px;
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
export class BulkRemoveModalComponent {
  @Input() visible = false;
  @Input() selectedAccounts: any[] = [];
  @Input() roleAssignments: any[] = [];
  @Input() loading = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() removeRequest = new EventEmitter<RemovePermissionRequest>();

  removeForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private message: NzMessageService
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
      this.message.warning('Please select at least one permission to remove');
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