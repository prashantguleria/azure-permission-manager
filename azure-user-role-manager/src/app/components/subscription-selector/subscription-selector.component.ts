import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { PermissionsService } from '../../services/permissions.service';
import { Subscription } from '../../models/permissions.model';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-subscription-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzSelectModule,
    NzSpinModule,
    NzAlertModule
  ],
  template: `
    <div class="subscription-selector">
      <div class="selector-header">
        <label class="selector-label">Select Subscription:</label>
        <span class="required-indicator" *ngIf="required">*</span>
      </div>
      
      <div class="selector-content">
        <nz-select
          [(ngModel)]="selectedSubscriptionId"
          (ngModelChange)="onSubscriptionChange($event)"
          [nzPlaceHolder]="placeholder"
          [nzLoading]="loading"
          [nzDisabled]="loading || subscriptions.length === 0"
          nzShowSearch
          nzAllowClear
          class="subscription-select">
          <nz-option 
            *ngFor="let subscription of subscriptions" 
            [nzLabel]="getSubscriptionLabel(subscription)" 
            [nzValue]="subscription.subscriptionId">
          </nz-option>
        </nz-select>
        
        <nz-spin [nzSpinning]="loading" nzSize="small" class="loading-spinner" *ngIf="loading"></nz-spin>
      </div>
      
      <div class="subscription-info" *ngIf="selectedSubscription && !loading">
        <div class="info-item">
          <span class="info-label">Selected:</span>
          <span class="info-value">{{ selectedSubscription.displayName }}</span>
        </div>
        <div class="info-item" *ngIf="selectedSubscription.state">
          <span class="info-label">Status:</span>
          <span class="info-value" [class]="'status-' + selectedSubscription.state.toLowerCase()">{{ selectedSubscription.state }}</span>
        </div>
      </div>
      
      <nz-alert 
        *ngIf="!loading && subscriptions.length === 0 && !error"
        nzType="warning"
        nzMessage="No subscriptions available"
        nzDescription="You don't have access to any Azure subscriptions or they haven't been loaded yet."
        nzShowIcon>
      </nz-alert>
      
      <nz-alert 
        *ngIf="error"
        nzType="error"
        [nzMessage]="error"
        nzDescription="Failed to load subscriptions. Please try refreshing the page."
        nzShowIcon>
      </nz-alert>
    </div>
  `,
  styles: [`
    .subscription-selector {
      margin-bottom: 16px;
    }
    
    .selector-header {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .selector-label {
      font-weight: 500;
      color: #262626;
      margin-right: 4px;
    }
    
    .required-indicator {
      color: #ff4d4f;
      font-weight: bold;
    }
    
    .selector-content {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .subscription-select {
      flex: 1;
      min-width: 300px;
    }
    
    .loading-spinner {
      margin-left: 8px;
    }
    
    .subscription-info {
      margin-top: 8px;
      padding: 8px 12px;
      background-color: #f6f8fa;
      border-radius: 4px;
      border-left: 3px solid #1890ff;
    }
    
    .info-item {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
    }
    
    .info-item:last-child {
      margin-bottom: 0;
    }
    
    .info-label {
      font-weight: 500;
      color: #595959;
      margin-right: 8px;
      min-width: 60px;
    }
    
    .info-value {
      color: #262626;
    }
    
    .status-enabled {
      color: #52c41a;
      font-weight: 500;
    }
    
    .status-disabled {
      color: #ff4d4f;
      font-weight: 500;
    }
    
    .status-warned {
      color: #faad14;
      font-weight: 500;
    }
    
    nz-alert {
      margin-top: 8px;
    }
  `]
})
export class SubscriptionSelectorComponent implements OnInit {
  @Input() placeholder: string = 'Select a subscription';
  @Input() required: boolean = true;
  @Input() preselectedSubscriptionId?: string;
  @Input() selectedSubscription: Subscription | null = null;
  @Output() subscriptionSelected = new EventEmitter<Subscription | null>();
  @Output() subscriptionChanged = new EventEmitter<string | null>();

  subscriptions: Subscription[] = [];
  selectedSubscriptionId: string | null = null;
  loading = false;
  error: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private permissionsService: PermissionsService,
    private message: NzMessageService
  ) {}

  ngOnInit(): void {
    this.loadSubscriptions();
    
    // Set preselected subscription if provided
    if (this.preselectedSubscriptionId) {
      this.selectedSubscriptionId = this.preselectedSubscriptionId;
    } else if (this.selectedSubscription) {
      this.selectedSubscriptionId = this.selectedSubscription.subscriptionId;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSubscriptions(): void {
    this.loading = true;
    this.error = null;
    
    this.permissionsService.getRBACPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.subscriptions = result.subscriptions.filter(sub => sub.state === 'Enabled');
          this.loading = false;
          
          // Auto-select if there's a preselected ID or only one subscription
          if (this.preselectedSubscriptionId) {
            const preselected = this.subscriptions.find(sub => sub.subscriptionId === this.preselectedSubscriptionId);
            if (preselected) {
              this.onSubscriptionChange(preselected.subscriptionId);
            }
          } else if (this.subscriptions.length === 1) {
            this.onSubscriptionChange(this.subscriptions[0].subscriptionId);
          }
        },
        error: (error) => {
          console.error('Failed to load subscriptions:', error);
          this.error = 'Failed to load subscriptions';
          this.loading = false;
          this.message.error('Failed to load subscriptions. Please try again.');
        }
      });
  }

  onSubscriptionChange(subscriptionId: string | null): void {
    this.selectedSubscriptionId = subscriptionId;
    
    if (subscriptionId) {
      this.selectedSubscription = this.subscriptions.find(sub => sub.subscriptionId === subscriptionId) || null;
    } else {
      this.selectedSubscription = null;
    }
    
    this.subscriptionSelected.emit(this.selectedSubscription);
    this.subscriptionChanged.emit(subscriptionId);
  }

  getSubscriptionLabel(subscription: Subscription): string {
    return `${subscription.displayName} (${subscription.subscriptionId})`;
  }

  refreshSubscriptions(): void {
    this.loadSubscriptions();
  }

  clearSelection(): void {
    this.onSubscriptionChange(null);
  }
}