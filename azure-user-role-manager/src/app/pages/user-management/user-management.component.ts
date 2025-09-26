import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, catchError, of, Subscription } from 'rxjs';

import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { PaginatorModule } from 'primeng/paginator';

import { AzureApiService } from '../../services/azure-api.service';
import { AuthService } from '../../services/auth.service';
import { UtilityService } from '../../services/utility.service';
import { User, UserSearchResult, Principal, PrincipalSearchResult } from '../../models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    InputTextModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    AvatarModule,
    CardModule,
    TooltipModule,
    ToastModule,
    CheckboxModule,
    PaginatorModule
  ],
  providers: [MessageService],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private tenantChangeSubscription?: Subscription;

  // Data properties
  users: User[] = [];
  allUsers: User[] = []; // Store all users for client-side pagination
  principals: Principal[] = [];
  allPrincipals: User[] = []; // Store all users for client-side pagination
  loading = false;
  searchQuery = '';
  totalCount = 0;
  pageSize = 25;
  pageIndex = 1;
  hasMore = false;

  // UI state
  selectedUsers: Set<string> = new Set();
  allChecked = false;
  indeterminate = false;
  currentUser: any = null;

  constructor(
    private azureApiService: AzureApiService,
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    public utilityService: UtilityService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.setupSearch();
    this.loadUsers();
    
    // Subscribe to tenant changes
    this.tenantChangeSubscription = this.authService.tenantChanged$.subscribe((newTenantId: string) => {
      console.log('User management: Tenant changed to', newTenantId);
      this.refreshUsers();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Unsubscribe from tenant changes
    if (this.tenantChangeSubscription) {
      this.tenantChangeSubscription.unsubscribe();
    }
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap(query => {
          this.loading = true;
          this.pageIndex = 1;
          return this.azureApiService.searchPrincipals(query, 'User', this.pageSize * 5) // Get more results for client-side pagination
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
        this.allPrincipals = result.users; // Store all users for pagination
        // Convert users to display format
        this.allUsers = result.users.filter((u: User) => u.principalType === 'User' || !u.principalType).map((u: User) => ({
           id: u.id,
           displayName: u.displayName,
           email: u.email || '',
           userPrincipalName: u.userPrincipalName || '',
           isEnabled: u.isEnabled || true,
           createdDate: u.createdDate || new Date()
         }));
         // Also include service principals as "users" for display
         const servicePrincipals = result.users.filter((u: User) => u.principalType === 'ServicePrincipal').map((u: User) => ({
            id: u.id,
            displayName: u.displayName + ' (Service Principal)',
            email: u.email || u.displayName || '',
            userPrincipalName: u.userPrincipalName || u.displayName || '',
            isEnabled: true,
            createdDate: u.createdDate || new Date()
         }));
        this.allUsers = [...this.allUsers, ...servicePrincipals];
        this.totalCount = this.allUsers.length;
        this.hasMore = result.hasMore;
        this.paginateUsers();
        this.loading = false;
        this.updateCheckboxState();
        this.cdr.markForCheck();
      });
  }

  loadUsers(reset: boolean = false): void {
    if (reset) {
      this.pageIndex = 1;
      this.searchQuery = '';
    }

    this.loading = true;

    this.azureApiService.searchPrincipals(this.searchQuery, 'User', this.pageSize * 5) // Get more results for client-side pagination
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Load principals error:', error);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load principals' });
          return of({ users: [], totalCount: 0, hasMore: false } as UserSearchResult);
        })
      )
      .subscribe(result => {
        this.allPrincipals = result.users; // Store all users for pagination
        // Convert users to display format
        this.allUsers = result.users.filter((u: User) => u.principalType === 'User' || !u.principalType).map((u: User) => ({
           id: u.id,
           displayName: u.displayName,
           email: u.email || '',
           userPrincipalName: u.userPrincipalName || '',
           isEnabled: u.isEnabled || true,
           createdDate: u.createdDate || new Date()
         }));
         // Also include service principals as "users" for display
         const servicePrincipals = result.users.filter((u: User) => u.principalType === 'ServicePrincipal').map((u: User) => ({
            id: u.id,
            displayName: u.displayName + ' (Service Principal)',
            email: u.email || u.userPrincipalName || '',
            userPrincipalName: u.userPrincipalName || '',
            isEnabled: u.isEnabled || true,
            createdDate: u.createdDate || new Date()
         }));
        this.allUsers = [...this.allUsers, ...servicePrincipals];
        this.totalCount = this.allUsers.length;
        this.hasMore = result.hasMore;
        this.paginateUsers();
        this.loading = false;
        this.updateCheckboxState();
        this.cdr.markForCheck();
      });
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onSearch(target?.value || '');
  }

  onPageChange(pageIndex: number): void {
    this.pageIndex = pageIndex;
    this.paginateUsers();
    this.cdr.markForCheck();
  }

  onPageSizeChange(pageSize: number | undefined): void {
    this.pageSize = pageSize ?? 10;
    this.pageIndex = 1;
    this.paginateUsers();
    this.cdr.markForCheck();
  }

  private paginateUsers(): void {
    const startIndex = (this.pageIndex - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.users = this.allUsers.slice(startIndex, endIndex);
  }

  // Selection methods
  onAllChecked(checked: boolean): void {
    this.users.forEach(user => {
      if (checked) {
        this.selectedUsers.add(user.id);
      } else {
        this.selectedUsers.delete(user.id);
      }
    });
    this.updateCheckboxState();
    this.cdr.markForCheck();
  }

  onItemChecked(userId: string, checked: boolean): void {
    if (checked) {
      this.selectedUsers.add(userId);
    } else {
      this.selectedUsers.delete(userId);
    }
    this.updateCheckboxState();
    this.cdr.markForCheck();
  }

  private updateCheckboxState(): void {
    const visibleUserIds = this.users.map(user => user.id);
    const selectedVisibleUsers = visibleUserIds.filter(id => this.selectedUsers.has(id));
    
    this.allChecked = selectedVisibleUsers.length === visibleUserIds.length && visibleUserIds.length > 0;
    this.indeterminate = selectedVisibleUsers.length > 0 && selectedVisibleUsers.length < visibleUserIds.length;
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
    this.selectedUsers.clear();
    this.loadUsers(true);
  }

  // Utility methods

  getCurrentUser(): any {
    return this.currentUser;
  }
}
