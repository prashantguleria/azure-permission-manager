import {
  Component,
  signal,
  inject,
  DestroyRef,
  afterNextRender,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AccountInfo } from '@azure/msal-browser';
import { MenuItem } from 'primeng/api';

// PrimeNG imports
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    BreadcrumbModule,
    TableModule,
    TagModule,
    ProgressSpinnerModule,
    DialogModule,
    ConfirmDialogModule,
    TooltipModule,
    AvatarModule,
    ToastModule,
    SkeletonModule
  ],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss'
})
export class UserDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly azureApiService = inject(AzureApiService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly utilityService = inject(UtilityService);

  // Data signals
  readonly user = signal<User | null>(null);
  readonly roleAssignments = signal<RoleAssignment[]>([]);

  // UI state signals
  readonly loading = signal(false);
  readonly roleAssignmentsLoading = signal(false);
  readonly removingRoleId = signal<string | null>(null);

  // Current user info
  readonly currentUser = signal<any>(null);

  // User ID from route
  readonly userId = signal<string | null>(null);

  // Breadcrumb items
  readonly breadcrumbItems = signal<MenuItem[]>([]);
  readonly homeItem: MenuItem = { icon: 'pi pi-home', routerLink: '/app/user-management' };

  constructor() {
    afterNextRender(() => {
      this.initializeComponent();
    });
  }

  private initializeComponent(): void {
    // Get current user info
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user: AccountInfo | null) => {
        this.currentUser.set(user);
      });

    // Get user ID from route
    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.userId.set(params['id']);
        if (this.userId()) {
          this.initializeBreadcrumb();
          this.loadUserDetails();
          this.loadRoleAssignments();
        }
      });
  }

  private initializeBreadcrumb(): void {
    this.breadcrumbItems.set([
      { label: 'Users', routerLink: '/app/user-management' },
      { label: 'User Details' }
    ]);
  }

  private loadUserDetails(): void {
    if (!this.userId()) return;

    this.loading.set(true);
    this.azureApiService.getUserById(this.userId()!)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (user) => {
          this.user.set(user);
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
    if (!this.userId()) return;

    this.roleAssignmentsLoading.set(true);
    this.azureApiService.getUserRoleAssignments(this.userId()!)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.roleAssignmentsLoading.set(false))
      )
      .subscribe({
        next: (assignments) => {
          this.roleAssignments.set(assignments);
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
    if (!this.userId() || !assignment.id) return;

    this.removingRoleId.set(assignment.id);
    this.azureApiService.removeUserRole({ assignmentId: assignment.id })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.removingRoleId.set(null))
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
