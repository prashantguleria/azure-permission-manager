import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AzureApiService } from '../../services/azure-api.service';
import { User, UserSearchResult } from '../../models/user.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil, of } from 'rxjs';
import { NzSpinModule } from 'ng-zorro-antd/spin';

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
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzSpinModule
  ],
  template: `
    <nz-modal
      [(nzVisible)]="visible"
      [nzTitle]="selectedAccounts.length === 1 ? 'Add Permission to ' + selectedAccounts[0]?.name : 'Add Permissions to Storage Accounts'"
      (nzOnCancel)="onCancel()"
      (nzOnOk)="onOk()"
      [nzOkLoading]="loading"
      [nzOkText]="selectedAccounts.length === 1 ? 'Add Permission' : 'Add Permissions'"
      nzCancelText="Cancel">
      
      <ng-container *nzModalContent>
        <div class="bulk-add-permission-form">
          <div class="selected-accounts" *ngIf="selectedAccounts.length > 1">
            <h4>Adding permissions to {{ selectedAccounts.length }} storage accounts:</h4>
            <ul>
              <li *ngFor="let account of selectedAccounts">{{ account.name }}</li>
            </ul>
          </div>
          
          <form nz-form [formGroup]="permissionForm" [nzLayout]="'vertical'">
            <nz-form-item>
              <nz-form-label nzRequired>Users</nz-form-label>
              <nz-form-control nzErrorTip="Please select at least one user">
                <nz-select 
                  formControlName="principalIds" 
                  nzPlaceHolder="Search and select users..."
                  nzMode="multiple"
                  nzShowSearch
                  nzServerSearch
                  [nzLoading]="searchingUsers"
                  (nzOnSearch)="onUserSearch($event)"
                  nzAllowClear>
                  <nz-option 
                    *ngFor="let user of searchedUsers" 
                    [nzValue]="user.id" 
                    [nzLabel]="user.displayName + ' (' + user.email + ')'">
                    <div class="user-option">
                      <div class="user-name">{{ user.displayName }}</div>
                      <div class="user-email">{{ user.email }}</div>
                    </div>
                  </nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            
            <nz-form-item>
              <nz-form-label nzRequired>Roles</nz-form-label>
              <nz-form-control nzErrorTip="Please select at least one role">
                <nz-select 
                  formControlName="roleDefinitionIds" 
                  nzPlaceHolder="Select roles..."
                  nzMode="multiple">
                  <nz-option 
                    *ngFor="let role of availableRoles" 
                    [nzValue]="role.value" 
                    [nzLabel]="role.label">
                  </nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            
            <nz-form-item>
              <nz-form-label nzRequired>Principal Type</nz-form-label>
              <nz-form-control nzErrorTip="Please select a principal type">
                <nz-select formControlName="principalType" nzPlaceHolder="Select principal type...">
                  <nz-option nzValue="User" nzLabel="User"></nz-option>
                  <nz-option nzValue="ServicePrincipal" nzLabel="Service Principal"></nz-option>
                  <nz-option nzValue="Group" nzLabel="Group"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </form>
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    .bulk-add-permission-form {
      padding: 16px 0;
    }
    .selected-accounts {
      margin-bottom: 24px;
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
    .user-option {
      padding: 4px 0;
    }
    .user-name {
      font-weight: 500;
      color: #262626;
    }
    .user-email {
      font-size: 12px;
      color: #8c8c8c;
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
    private message: NzMessageService,
    private azureApiService: AzureApiService
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
    
    // Setup user search with debouncing
    this.userSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of({ users: [], totalCount: 0, hasMore: false } as UserSearchResult);
        }
        this.searchingUsers = true;
        return this.azureApiService.searchUsers(query, 10).pipe(
          takeUntil(this.destroy$)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result: UserSearchResult) => {
        this.searchedUsers = result.users || [];
        this.searchingUsers = false;
      },
      error: (error) => {
        console.error('User search error:', error);
        this.searchedUsers = [];
        this.searchingUsers = false;
        this.message.error('Failed to search users');
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
        this.message.error('Please select at least one user and one role');
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
      this.message.error('Please fill in all required fields');
    }
  }
}