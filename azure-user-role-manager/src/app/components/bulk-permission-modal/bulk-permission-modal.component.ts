import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AzureApiService } from '../../services/azure-api.service';
import { User, UserSearchResult } from '../../models/user.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil, of } from 'rxjs';

export interface BulkPermissionRequest {
  principalIds: string[];
  roleDefinitionIds: string[];
  principalType: string;
}

@Component({
  selector: 'app-bulk-permission-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    ButtonModule,
    ProgressSpinnerModule
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      header="Assign Permissions to Selected Accounts"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="bulk-permission-modal"
      [style]="{width: '600px'}"
      (onHide)="onCancel()">
      <ng-template pTemplate="content">
        <div class="bulk-add-permission-form">
          <div class="selected-accounts" *ngIf="selectedAccounts.length > 1">
            <h4>Adding permissions to {{ selectedAccounts.length }} storage accounts:</h4>
            <ul>
              <li *ngFor="let account of selectedAccounts">{{ account.name }}</li>
            </ul>
          </div>
          
          <form [formGroup]="permissionForm" class="permission-form">
            <!-- Principal Type Selection -->
            <div class="form-field">
              <label for="principalType" class="form-label required">Principal Type</label>
              <p-select
                inputId="principalType"
                formControlName="principalType"
                [options]="[
                  {label: 'Users', value: 'User'},
                  {label: 'Service Principals', value: 'ServicePrincipal'},
                  {label: 'Groups', value: 'Group'}
                ]"
                placeholder="Select principal type"
                (onChange)="onUserSearch('')"
                styleClass="w-full">
              </p-select>
            </div>
            
            <!-- Principal Selection -->
            <div class="form-field">
              <label for="principalIds" class="form-label required">{{ getPrincipalLabel() }}</label>
              <p-multiSelect
                inputId="principalIds"
                formControlName="principalIds"
                [options]="searchedUsers"
                optionLabel="displayName"
                optionValue="id"
                [placeholder]="'Search and select ' + getPrincipalLabel().toLowerCase() + '...'"
                [filter]="true"
                [showClear]="true"
                [loading]="searchingUsers"
                (onFilter)="onUserSearch($event.filter)"
                styleClass="w-full"
                [virtualScroll]="true"
                [virtualScrollItemSize]="40">
                <ng-template let-user pTemplate="item">
                  <div class="user-option">
                    <div class="user-name">{{ user.displayName }}</div>
                    <div class="user-info">{{ getPrincipalDisplayInfo(user) }}</div>
                  </div>
                </ng-template>
              </p-multiSelect>
            </div>
            
            <!-- Role Selection -->
             <div class="form-field">
               <label for="roleDefinitionIds" class="form-label required">Roles</label>
               <p-multiSelect
                 inputId="roleDefinitionIds"
                 formControlName="roleDefinitionIds"
                 [options]="availableRoles"
                 optionLabel="label"
                 optionValue="value"
                 placeholder="Select roles to assign..."
                 [showClear]="true"
                 styleClass="w-full">
               </p-multiSelect>
             </div>
          </form>
         </div>
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
           label="Assign Permissions"
           icon="pi pi-check"
           [loading]="loading"
           [disabled]="!permissionForm.valid"
           (onClick)="onOk()"
           styleClass="p-button-primary">
         </p-button>
       </ng-template>
     </p-dialog>
  `,
  styles: [`
    .bulk-add-permission-form {
      padding: 16px 0;
    }
    
    .selected-accounts {
      margin-bottom: 16px;
      padding: 12px;
      background-color: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }
    
    .selected-accounts h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: #495057;
    }
    
    .account-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .account-tag {
      background-color: #007bff;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .permission-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .form-label {
      font-weight: 600;
      color: #495057;
      font-size: 14px;
    }
    
    .form-label.required::after {
      content: ' *';
      color: #dc3545;
    }
    
    .user-option {
      padding: 8px 0;
    }
    
    .user-name {
      font-weight: 500;
      color: #495057;
      font-size: 14px;
    }
    
    .user-info {
      font-size: 12px;
      color: #6c757d;
      margin-top: 2px;
    }
    
    ::ng-deep .bulk-permission-modal .p-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
    }
    
    .selected-accounts ul {
      margin: 0;
      padding-left: 20px;
    }
    
    .user-email {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 2px;
    }
    
    .user-type {
      font-size: 10px;
      color: #1890ff;
      font-weight: 500;
      margin-top: 2px;
    }
  `]
})
export class BulkPermissionModalComponent implements OnInit, OnDestroy {
  @Input() visible = false;
  @Input() selectedAccounts: any[] = [];
  @Input() subscriptionId = '';
  @Input() loading = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() permissionRequest = new EventEmitter<BulkPermissionRequest>();

  permissionForm: FormGroup;
  searchedUsers: User[] = [];
  searchingUsers = false;
  private destroy$ = new Subject<void>();
  private userSearchSubject = new Subject<string>();
  availableRoles = [
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe',
      label: 'Storage Blob Data Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/2a2b9908-6ea1-4ae2-8e65-a410df84e7d1',
      label: 'Storage Blob Data Reader'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/b7e6dc6d-f1e8-4753-8033-0f276bb0955b',
      label: 'Storage Blob Data Owner'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/17d1049b-9a84-46fb-8f53-869881c3d3ab',
      label: 'Storage Account Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/81a9662b-bebf-436f-a333-f67b29880f12',
      label: 'Storage Account Key Operator Service Role'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private azureApiService: AzureApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.permissionForm = this.fb.group({
      principalIds: [[], [Validators.required]],
      roleDefinitionIds: [[], [Validators.required]],
      principalType: ['User', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Update role definitions with subscription ID
    this.updateRoleDefinitions();
    
    // Setup principal search with debouncing
    this.userSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of({ users: [], totalCount: 0, hasMore: false } as UserSearchResult);
        }
        this.searchingUsers = true;
        this.cdr.markForCheck();
        const principalType = this.permissionForm.get('principalType')?.value || 'User';
        return this.azureApiService.searchPrincipals(query, principalType, 10).pipe(
          takeUntil(this.destroy$)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result: UserSearchResult) => {
        this.searchedUsers = result.users || [];
        this.searchingUsers = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Principal search error:', error);
        this.searchedUsers = [];
        this.searchingUsers = false;
        this.cdr.markForCheck();
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to search principals'
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onUserSearch(query: string): void {
    this.userSearchSubject.next(query);
  }

  getPrincipalLabel(): string {
    const principalType = this.permissionForm.get('principalType')?.value || 'User';
    switch (principalType) {
      case 'ServicePrincipal':
        return 'Service Principals';
      case 'Group':
        return 'Groups';
      default:
        return 'Users';
    }
  }

  getPrincipalDisplayLabel(user: User): string {
    const principalType = this.permissionForm.get('principalType')?.value || 'User';
    switch (principalType) {
      case 'ServicePrincipal':
        return `${user.displayName} (${user.userPrincipalName || user.email}) [Service Principal]`;
      case 'Group':
        return `${user.displayName} (${user.email || user.displayName}) [Group]`;
      default:
        return `${user.displayName} (${user.email})`;
    }
  }

  getPrincipalDisplayInfo(user: any): string {
    const principalType = this.permissionForm.get('principalType')?.value;
    switch (principalType) {
      case 'User':
        return user.email || user.userPrincipalName || '';
      case 'ServicePrincipal':
        const spInfo = [];
        if (user.appId) spInfo.push(`App ID: ${user.appId}`);
        if (user.servicePrincipalType) spInfo.push(`Type: ${user.servicePrincipalType}`);
        return spInfo.join(' | ') || user.userPrincipalName || '';
      case 'Group':
        return user.description || user.mail || '';
      default:
        return user.email || user.userPrincipalName || '';
    }
  }



  private updateRoleDefinitions(): void {
    // Update role definition IDs with actual subscription ID
    if (this.selectedAccounts.length > 0) {
      const subscriptionId = this.selectedAccounts[0].subscriptionId;
      this.availableRoles = this.availableRoles.map(role => ({
        ...role,
        value: role.value.replace('{{subscriptionId}}', subscriptionId)
      }));
    }
  }

  onModalVisibilityChange(visible: boolean): void {
    this.visible = visible;
    this.visibleChange.emit(visible);
    
    if (visible) {
      // Update role definitions when modal opens
      this.updateRoleDefinitions();
      // Clear previous search results
      this.searchedUsers = [];
    } else {
      this.permissionForm.reset({
        principalIds: [],
        roleDefinitionIds: [],
        principalType: 'User'
      });
    }
  }

  onCancel() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.permissionForm.reset({ principalType: 'User' });
  }

  onOk() {
    if (this.permissionForm.valid) {
      const formValue = this.permissionForm.value;
      // Validate that arrays are not empty
      if (!formValue.principalIds?.length || !formValue.roleDefinitionIds?.length) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'Please select at least one user and one role'
        });
        return;
      }
      
      this.permissionRequest.emit({
        principalIds: formValue.principalIds,
        roleDefinitionIds: formValue.roleDefinitionIds,
        principalType: formValue.principalType
      });
    } else {
      // Mark all fields as dirty to show validation errors
      Object.values(this.permissionForm.controls).forEach(control => {
        control.markAsDirty();
        control.updateValueAndValidity();
      });
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill in all required fields'
      });
    }
  }
}