import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';
import { MenuItem } from 'primeng/api';

// PrimeNG imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';

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
    CardModule,
    ButtonModule,
    BreadcrumbModule,
    TableModule,
    TagModule,
    ProgressSpinnerModule,
    DialogModule,
    ConfirmDialogModule,
    TooltipModule,
    DividerModule,
    AvatarModule,
    ToastModule,
    SkeletonModule
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
  
  // Breadcrumb items
  breadcrumbItems: MenuItem[] = [];
  homeItem: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private azureApiService: AzureApiService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
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
        this.initializeBreadcrumb();
        this.loadUserDetails();
        this.loadRoleAssignments();
      }
    });
  }

  private initializeBreadcrumb(): void {
    this.breadcrumbItems = [
      { label: 'Users', routerLink: '/users' },
      { label: 'User Details' }
    ];
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
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load user details'
          });
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
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load role assignments'
          });
        }
      });
  }

  confirmRemoveRole(assignment: RoleAssignment): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to remove this role assignment?',
      header: 'Confirm Removal',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.onRemoveRole(assignment);
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
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: `Role "${assignment.roleName}" removed successfully`
            });
            this.loadRoleAssignments(); // Reload the assignments
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: result.message || 'Failed to remove role assignment'
            });
          }
        },
        error: (error: any) => {
          console.error('Error removing role assignment:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to remove role assignment'
          });
        }
      });
  }

  // Navigation methods removed - handled by routerLink

  // Utility methods


}
