import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, catchError, of } from 'rxjs';

import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

import { AzureApiService } from '../../services/azure-api.service';
import { AuthService } from '../../services/auth.service';
import { UtilityService } from '../../services/utility.service';
import { User, UserSearchResult } from '../../models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzLayoutModule,
    NzBreadCrumbModule,
    NzInputModule,
    NzButtonModule,
    NzTableModule,
    NzTagModule,
    NzIconModule,
    NzSpinModule,
    NzEmptyModule,
    NzAvatarModule,
    NzTypographyModule,
    NzCardModule,
    NzGridModule,
    NzSpaceModule,
    NzToolTipModule
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // Data properties
  users: User[] = [];
  allUsers: User[] = []; // Store all users for client-side pagination
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
    private message: NzMessageService,
    public utilityService: UtilityService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.setupSearch();
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
          return this.azureApiService.searchUsers(query, this.pageSize * 5) // Get more results for client-side pagination
            .pipe(
              catchError(error => {
                console.error('Search error:', error);
                this.message.error('Failed to search users');
                return of({ users: [], totalCount: 0, hasMore: false } as UserSearchResult);
              })
            );
        })
      )
      .subscribe(result => {
        this.allUsers = result.users; // Store all users for pagination
        this.totalCount = result.users.length;
        this.hasMore = result.hasMore;
        this.paginateUsers();
        this.loading = false;
        this.updateCheckboxState();
      });
  }

  loadUsers(reset: boolean = false): void {
    if (reset) {
      this.pageIndex = 1;
      this.searchQuery = '';
    }

    this.loading = true;

    this.azureApiService.searchUsers(this.searchQuery, this.pageSize * 5) // Get more results for client-side pagination
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Load users error:', error);
          this.message.error('Failed to load users');
          return of({ users: [], totalCount: 0, hasMore: false } as UserSearchResult);
        })
      )
      .subscribe(result => {
        this.allUsers = result.users; // Store all users for pagination
        this.totalCount = result.users.length;
        this.hasMore = result.hasMore;
        this.paginateUsers();
        this.loading = false;
        this.updateCheckboxState();
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
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize = pageSize;
    this.pageIndex = 1;
    this.paginateUsers();
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
  }

  onItemChecked(userId: string, checked: boolean): void {
    if (checked) {
      this.selectedUsers.add(userId);
    } else {
      this.selectedUsers.delete(userId);
    }
    this.updateCheckboxState();
  }

  private updateCheckboxState(): void {
    const visibleUserIds = this.users.map(user => user.id);
    const selectedVisibleUsers = visibleUserIds.filter(id => this.selectedUsers.has(id));
    
    this.allChecked = selectedVisibleUsers.length === visibleUserIds.length && visibleUserIds.length > 0;
    this.indeterminate = selectedVisibleUsers.length > 0 && selectedVisibleUsers.length < visibleUserIds.length;
  }

  // Navigation methods
  viewUserDetail(userId: string): void {
    this.router.navigate(['/user-detail', userId]);
  }

  viewUserPermissions(user: User): void {
    this.router.navigate(['/user-permissions'], {
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
