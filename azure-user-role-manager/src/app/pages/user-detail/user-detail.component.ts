import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';

// NG-ZORRO imports
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzGridModule } from 'ng-zorro-antd/grid';

// Services and Models
import { AuthService } from '../../services/auth.service';
import { AzureApiService } from '../../services/azure-api.service';
import { UtilityService } from '../../services/utility.service';
import { User, RoleAssignment } from '../../models/user.model';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzLayoutModule,
    NzBreadCrumbModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzTypographyModule,
    NzDescriptionsModule,
    NzTableModule,
    NzTagModule,
    NzSpinModule,
    NzEmptyModule,
    NzModalModule,
    NzPopconfirmModule,
    NzToolTipModule,
    NzDividerModule,
    NzAvatarModule,
    NzGridModule
  ],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss'
})
export class UserDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data properties
  user: User | null = null;
  roleAssignments: RoleAssignment[] = [];
  
  // UI state
  loading = false;
  roleAssignmentsLoading = false;
  removingRoleId: string | null = null;
  
  // Current user info
  currentUser: any = null;
  
  // User ID from route
  userId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private azureApiService: AzureApiService,
    private message: NzMessageService,
    public utilityService: UtilityService
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    // Get current user info
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: AccountInfo | null) => {
      this.currentUser = user;
    });

    // Get user ID from route
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.userId = params['id'];
      if (this.userId) {
        this.loadUserDetails();
        this.loadRoleAssignments();
      }
    });
  }

  private loadUserDetails(): void {
    if (!this.userId) return;
    
    this.loading = true;
    this.azureApiService.getUserById(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (user) => {
          this.user = user;
        },
        error: (error) => {
          console.error('Error loading user details:', error);
          this.message.error('Failed to load user details');
        }
      });
  }

  private loadRoleAssignments(): void {
    if (!this.userId) return;
    
    this.roleAssignmentsLoading = true;
    this.azureApiService.getUserRoleAssignments(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.roleAssignmentsLoading = false)
      )
      .subscribe({
        next: (assignments) => {
          this.roleAssignments = assignments;
        },
        error: (error) => {
          console.error('Error loading role assignments:', error);
          this.message.error('Failed to load role assignments');
        }
      });
  }

  onRemoveRole(assignment: RoleAssignment): void {
    if (!this.userId || !assignment.id) return;
    
    this.removingRoleId = assignment.id;
    this.azureApiService.removeUserRole({ assignmentId: assignment.id })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.removingRoleId = null)
      )
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.message.success(`Role "${assignment.roleName}" removed successfully`);
            this.loadRoleAssignments(); // Reload the assignments
          } else {
            this.message.error(result.message || 'Failed to remove role assignment');
          }
        },
        error: (error: any) => {
          console.error('Error removing role assignment:', error);
          this.message.error('Failed to remove role assignment');
        }
      });
  }

  // Navigation methods removed - handled by routerLink

  // Utility methods


}
