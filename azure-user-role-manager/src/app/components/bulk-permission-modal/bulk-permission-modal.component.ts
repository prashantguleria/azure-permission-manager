import { Component, input, output, ChangeDetectionStrategy, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { AzureApiService } from '../../services/azure-api.service';
import { User, UserSearchResult } from '../../models/user.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

export interface BulkPermissionRequest {
  principalIds: string[];
  roleDefinitionIds: string[];
  principalType: string;
}

@Component({
  selector: 'app-bulk-permission-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    ProgressSpinnerModule
  ],
  template: `
    <p-dialog
      [visible]="visible()"
      header="Assign Permissions to Selected Accounts"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="bulk-permission-modal"
      [style]="{width: '600px'}"
      (onHide)="onCancel()">
      <ng-template #content>
        <div class="bulk-add-permission-form">
          @if (selectedAccounts().length > 1) {
            <div class="selected-accounts">
              <h4>Adding permissions to {{ selectedAccounts().length }} storage accounts:</h4>
              <ul>
                @for (account of selectedAccounts(); track account.name) {
                  <li>{{ account.name }}</li>
                }
              </ul>
            </div>
          }

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
                appendTo="body"
                styleClass="w-full">
              </p-select>
            </div>

            <!-- Principal Selection -->
            <div class="form-field">
              <label for="principalIds" class="form-label required">{{ getPrincipalLabel() }}</label>
              <p-multiSelect
                inputId="principalIds"
                formControlName="principalIds"
                [options]="allPrincipalOptions()"
                optionLabel="displayName"
                [placeholder]="'Search and select ' + getPrincipalLabel().toLowerCase() + '...'"
                [filter]="true"
                filterBy="displayName"
                [showClear]="true"
                [loading]="searchingUsers()"
                (onFilter)="onUserSearch($event.filter)"
                (onPanelShow)="onPanelOpen()"
                emptyFilterMessage="Type to search..."
                appendTo="body"
                styleClass="w-full">
                <ng-template let-user #item>
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
                appendTo="body"
                styleClass="w-full">
              </p-multiSelect>
            </div>
          </form>
        </div>
      </ng-template>

      <ng-template #footer>
        <div class="modal-footer">
          <button class="btn btn-text" (click)="onCancel()">
            <i class="pi pi-times"></i> Cancel
          </button>
          <button
            class="btn btn-primary"
            [disabled]="!permissionForm.valid || loading()"
            (click)="onOk()">
            @if (loading()) {
              <i class="pi pi-spinner pi-spin"></i>
            } @else {
              <i class="pi pi-check"></i>
            }
            Assign Permissions
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .bulk-add-permission-form {
      padding: var(--space-4) 0;
    }

    .selected-accounts {
      margin-bottom: var(--space-4);
      padding: var(--space-3);
      background-color: var(--color-surface-hover);
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
    }

    .selected-accounts h4 {
      margin: 0 0 var(--space-2) 0;
      font-size: var(--font-size-base);
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .selected-accounts ul {
      margin: 0;
      padding-left: var(--space-5);
    }

    .permission-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .form-label {
      font-weight: 600;
      color: var(--color-text-secondary);
      font-size: var(--font-size-base);
    }

    .form-label.required::after {
      content: ' *';
      color: var(--color-danger);
    }

    .user-option {
      padding: var(--space-2) 0;
    }

    .user-name {
      font-weight: 500;
      color: var(--color-text-secondary);
      font-size: var(--font-size-base);
    }

    .user-info {
      font-size: var(--font-size-xs);
      color: var(--color-text-tertiary);
      margin-top: 2px;
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

    .btn-primary {
      background: var(--color-primary);
      color: var(--color-primary-text);
      border-color: var(--color-primary);
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
    }
  `]
})
export class BulkPermissionModalComponent {
  readonly visible = input(false);
  readonly selectedAccounts = input<any[]>([]);
  readonly subscriptionId = input('');
  readonly loading = input(false);
  readonly visibleChange = output<boolean>();
  readonly permissionRequest = output<BulkPermissionRequest>();

  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly azureApiService = inject(AzureApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchedUsers = signal<User[]>([]);
  readonly searchingUsers = signal(false);
  /** Merged list: search results + previously selected users (so selected chips keep their labels) */
  readonly allPrincipalOptions = computed(() => {
    const searched = this.searchedUsers();
    const selected: User[] = this.permissionForm?.get('principalIds')?.value || [];
    if (!selected.length) return searched;
    const searchedIds = new Set(searched.map(u => u.id));
    const extras = selected.filter(u => u && !searchedIds.has(u.id));
    return [...extras, ...searched];
  });

  private readonly userSearchSubject = new Subject<string>();

  permissionForm: FormGroup;
  availableRoles = [
    // General Azure roles
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635',
      label: 'Owner'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c',
      label: 'Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/acdd72a7-3385-48ef-bd42-f606fba81ae7',
      label: 'Reader'
    },
    // Storage Account roles
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/17d1049b-9a84-46fb-8f53-869881c3d3ab',
      label: 'Storage Account Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/81a9662b-bebf-436f-a333-f67b29880f12',
      label: 'Storage Account Key Operator Service Role'
    },
    // Blob Storage roles
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/b7e6dc6d-f1e8-4753-8033-0f276bb0955b',
      label: 'Storage Blob Data Owner'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe',
      label: 'Storage Blob Data Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/2a2b9908-6ea1-4ae2-8e65-a410df84e7d1',
      label: 'Storage Blob Data Reader'
    },
    // Queue Storage roles
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/974c5e8b-45b9-4653-ba55-5f855dd0fb88',
      label: 'Storage Queue Data Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/19e7f393-937e-4f77-808e-94535e297925',
      label: 'Storage Queue Data Reader'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/c6a89b2d-59bc-44d0-9f4c-60707430ef2e',
      label: 'Storage Queue Data Message Sender'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/8a0f0c08-91a1-4084-bc3d-661d67233fed',
      label: 'Storage Queue Data Message Processor'
    },
    // Table Storage roles
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3',
      label: 'Storage Table Data Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/76199698-9eea-4c19-bc75-cec21354c6b6',
      label: 'Storage Table Data Reader'
    },
    // File Share roles
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb',
      label: 'Storage File Data SMB Share Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/aba4ae5f-2193-4029-9191-0cb91df5e314',
      label: 'Storage File Data SMB Share Reader'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/a7264617-510b-434b-a828-9731dc254ea4',
      label: 'Storage File Data SMB Share Elevated Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/69566ab7-960f-475b-8e7c-b3118f30c6bd',
      label: 'Storage File Data Privileged Contributor'
    },
    {
      value: '/subscriptions/{{subscriptionId}}/providers/Microsoft.Authorization/roleDefinitions/b8ead5d4-5043-42d9-9e2a-e3e8600f9cde',
      label: 'Storage File Data Privileged Reader'
    }
  ];

  constructor() {
    this.permissionForm = this.fb.group({
      principalIds: [[], [Validators.required]],
      roleDefinitionIds: [[], [Validators.required]],
      principalType: ['User', [Validators.required]]
    });

    // Update role definitions with subscription ID
    this.updateRoleDefinitions();

    // Setup principal search with debouncing
    this.userSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.searchingUsers.set(true);
        const principalType = this.permissionForm.get('principalType')?.value || 'User';
        // Empty or short query: load initial list; otherwise search
        const searchQuery = (!query || query.length < 2) ? '' : query;
        return this.azureApiService.searchPrincipals(searchQuery, principalType, 25);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result: UserSearchResult) => {
        this.searchedUsers.set(result.users || []);
        this.searchingUsers.set(false);
      },
      error: (error) => {
        console.error('Principal search error:', error);
        this.searchedUsers.set([]);
        this.searchingUsers.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to search principals'
        });
      }
    });
  }

  onUserSearch(query: string): void {
    this.userSearchSubject.next(query);
  }

  onPanelOpen(): void {
    // Load initial results if none loaded yet
    if (this.searchedUsers().length === 0) {
      this.loadInitialPrincipals();
    }
  }

  private loadInitialPrincipals(): void {
    this.searchingUsers.set(true);
    const principalType = this.permissionForm.get('principalType')?.value || 'User';
    this.azureApiService.searchPrincipals('', principalType, 25)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.searchedUsers.set(result.users || []);
          this.searchingUsers.set(false);
        },
        error: () => {
          this.searchingUsers.set(false);
        }
      });
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
    if (this.selectedAccounts().length > 0) {
      const subscriptionId = this.selectedAccounts()[0].subscriptionId;
      this.availableRoles = this.availableRoles.map(role => ({
        ...role,
        value: role.value.replace('{{subscriptionId}}', subscriptionId)
      }));
    }
  }

  onModalVisibilityChange(vis: boolean): void {
    this.visibleChange.emit(vis);

    if (vis) {
      // Update role definitions when modal opens
      this.updateRoleDefinitions();
      // Clear previous search results
      this.searchedUsers.set([]);
    } else {
      this.permissionForm.reset({
        principalIds: [],
        roleDefinitionIds: [],
        principalType: 'User'
      });
    }
  }

  onCancel() {
    this.visibleChange.emit(false);
    this.permissionForm.reset({ principalType: 'User' });
  }

  onOk() {
    if (this.permissionForm.valid) {
      const formValue = this.permissionForm.value;
      // principalIds now holds full User objects (no optionValue), extract IDs
      const selectedPrincipals: User[] = formValue.principalIds || [];
      const principalIds = selectedPrincipals.map(u => u.id);
      // Validate that arrays are not empty
      if (!principalIds.length || !formValue.roleDefinitionIds?.length) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'Please select at least one user and one role'
        });
        return;
      }

      this.permissionRequest.emit({
        principalIds,
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
