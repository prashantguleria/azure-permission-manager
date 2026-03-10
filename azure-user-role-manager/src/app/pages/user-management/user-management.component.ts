import {
  Component,
  signal,
  computed,
  inject,
  DestroyRef,
  afterNextRender,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';

import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { PaginatorModule } from 'primeng/paginator';

import { AzureApiService } from '../../services/azure-api.service';
import { AuthService } from '../../services/auth.service';
import { UtilityService } from '../../services/utility.service';
import { User, UserSearchResult, Principal, PrincipalSearchResult } from '../../models/user.model';

const AVATAR_COLORS = [
  '#0F6CBD', '#7C3AED', '#D97706', '#1A7F37', '#CF222E',
  '#0891B2', '#9333EA', '#C2410C', '#4F46E5', '#059669'
];

@Component({
  selector: 'app-user-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterModule,
    TableModule,
    InputTextModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    TooltipModule,
    ToastModule,
    CheckboxModule,
    PaginatorModule
  ],
  providers: [MessageService],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent {
  private readonly azureApiService = inject(AzureApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly utilityService = inject(UtilityService);

  private readonly searchSubject = new Subject<string>();

  // Data signals
  readonly users = signal<User[]>([]);
  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly totalCount = signal(0);
  readonly pageSize = signal(25);
  readonly pageIndex = signal(1);
  readonly hasMore = signal(false);

  // UI state signals
  readonly selectedUsers = signal<Set<string>>(new Set());
  readonly allChecked = signal(false);
  readonly indeterminate = signal(false);
  readonly currentUser = signal<any>(null);

  // Computed
  readonly selectedCount = computed(() => this.selectedUsers().size);

  constructor() {
    afterNextRender(() => {
      this.currentUser.set(this.authService.getCurrentUser());
      this.setupSearch();
      this.loadUsers();

      // Subscribe to tenant changes
      this.authService.tenantChanged$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((newTenantId: string) => {
          this.refreshUsers();
        });
    });
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
        switchMap(query => {
          this.loading.set(true);
          this.pageIndex.set(1);
          return this.azureApiService.searchPrincipals(query, 'User', this.pageSize(), 0)
            .pipe(
              catchError(error => {
                console.error('Search error:', error);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to search principals' });
                return of({ users: [], totalCount: 0, hasMore: false } as UserSearchResult);
              })
            );
        })
      )
      .subscribe(result => {
        this.processResults(result);
      });
  }

  loadUsers(reset: boolean = false): void {
    if (reset) {
      this.pageIndex.set(1);
      this.searchQuery.set('');
    }

    this.loading.set(true);
    const skip = (this.pageIndex() - 1) * this.pageSize();

    this.azureApiService.searchPrincipals(this.searchQuery(), 'User', this.pageSize(), skip)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Load principals error:', error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load principals' });
          return of({ users: [], totalCount: 0, hasMore: false } as UserSearchResult);
        })
      )
      .subscribe(result => {
        this.processResults(result);
      });
  }

  private processResults(result: UserSearchResult): void {
    // Convert users to display format
    const regularUsers = result.users
      .filter((u: User) => u.principalType === 'User' || !u.principalType)
      .map((u: User) => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email || '',
        userPrincipalName: u.userPrincipalName || '',
        isEnabled: u.isEnabled || true,
        createdDate: u.createdDate || new Date(),
        jobTitle: u.jobTitle,
        department: u.department
      } as User));

    // Also include service principals as "users" for display
    const servicePrincipals = result.users
      .filter((u: User) => u.principalType === 'ServicePrincipal')
      .map((u: User) => ({
        id: u.id,
        displayName: u.displayName + ' (Service Principal)',
        email: u.email || u.userPrincipalName || '',
        userPrincipalName: u.userPrincipalName || '',
        isEnabled: u.isEnabled || true,
        createdDate: u.createdDate || new Date()
      } as User));

    const combined = [...regularUsers, ...servicePrincipals];
    this.users.set(combined);
    this.totalCount.set(result.totalCount);
    this.hasMore.set(result.hasMore);
    this.loading.set(false);
    this.updateCheckboxState();
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onSearch(target?.value || '');
  }

  onPageChange(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
    this.loadUsers();
  }

  onPageSizeChange(pageSize: number | undefined): void {
    this.pageSize.set(pageSize ?? 10);
    this.pageIndex.set(1);
    this.loadUsers();
  }

  // Selection methods
  onAllChecked(checked: boolean): void {
    const updated = new Set(this.selectedUsers());
    this.users().forEach(user => {
      if (checked) {
        updated.add(user.id);
      } else {
        updated.delete(user.id);
      }
    });
    this.selectedUsers.set(updated);
    this.updateCheckboxState();
  }

  onItemChecked(userId: string, checked: boolean): void {
    const updated = new Set(this.selectedUsers());
    if (checked) {
      updated.add(userId);
    } else {
      updated.delete(userId);
    }
    this.selectedUsers.set(updated);
    this.updateCheckboxState();
  }

  isSelected(userId: string): boolean {
    return this.selectedUsers().has(userId);
  }

  private updateCheckboxState(): void {
    const visibleUserIds = this.users().map(user => user.id);
    const selectedVisibleUsers = visibleUserIds.filter(id => this.selectedUsers().has(id));

    this.allChecked.set(selectedVisibleUsers.length === visibleUserIds.length && visibleUserIds.length > 0);
    this.indeterminate.set(selectedVisibleUsers.length > 0 && selectedVisibleUsers.length < visibleUserIds.length);
  }

  // Navigation methods
  viewUserDetail(userId: string): void {
    this.router.navigate(['/app/user-detail', userId]);
  }

  viewUserPermissions(user: User): void {
    this.router.navigate(['/app/user-permissions'], {
      queryParams: {
        userId: user.id,
        displayName: user.displayName,
        email: user.email
      }
    });
  }

  refreshUsers(): void {
    this.selectedUsers.set(new Set());
    this.loadUsers(true);
  }

  // Utility methods
  getCurrentUser(): any {
    return this.currentUser();
  }

  getAvatarColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }
}
