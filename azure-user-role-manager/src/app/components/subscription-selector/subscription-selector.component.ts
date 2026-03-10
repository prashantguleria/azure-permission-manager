import { Component, input, output, ChangeDetectionStrategy, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { PermissionsService } from '../../services/permissions.service';
import { Subscription } from '../../models/permissions.model';

@Component({
  selector: 'app-subscription-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    ProgressSpinnerModule,
    MessageModule
  ],
  template: `
    <div class="subscription-selector">
      <div class="selector-header">
        <span class="selector-label">Subscription</span>
        @if (required()) {
          <span class="required-indicator">*</span>
        }
      </div>

      <div class="selector-content">
        <p-select
          class="subscription-select"
          [placeholder]="placeholder()"
          [(ngModel)]="selectedSubscriptionId"
          (onChange)="onSubscriptionChange($event.value)"
          [disabled]="loading()"
          [showClear]="true"
          [options]="subscriptions()"
          optionLabel="displayName"
          optionValue="subscriptionId">
          <ng-template #selectedItem let-selectedOption>
            @if (selectedOption) {
              <div>{{ getSubscriptionLabel(selectedOption) }}</div>
            }
          </ng-template>
          <ng-template #item let-subscription>
            <div>{{ getSubscriptionLabel(subscription) }}</div>
          </ng-template>
        </p-select>

        @if (loading()) {
          <p-progressSpinner class="loading-spinner" [style]="{width: '20px', height: '20px'}" />
        }
      </div>

      @if (selectedSub() && !loading()) {
        <div class="subscription-info">
          <div class="info-item">
            <span class="info-label">Selected:</span>
            <span class="info-value">{{ selectedSub()!.displayName }}</span>
          </div>
          @if (selectedSub()!.state) {
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value" [class]="'status-' + selectedSub()!.state!.toLowerCase()">{{ selectedSub()!.state }}</span>
            </div>
          }
        </div>
      }

      @if (!loading() && subscriptions().length === 0 && !error()) {
        <p-message
          severity="warn"
          text="No subscriptions available. You do not have access to any Azure subscriptions or they have not been loaded yet." />
      }

      @if (error()) {
        <p-message
          severity="error"
          [text]="getErrorMessage()" />
      }
    </div>
  `,
  styles: [`
    .subscription-selector {
      margin-bottom: var(--space-4);
    }

    .selector-header {
      display: flex;
      align-items: center;
      margin-bottom: var(--space-2);
    }

    .selector-label {
      font-weight: 500;
      color: var(--color-text);
      margin-right: var(--space-1);
    }

    .required-indicator {
      color: var(--color-danger);
      font-weight: bold;
    }

    .selector-content {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .subscription-select {
      flex: 1;
      min-width: 300px;
    }

    .loading-spinner {
      margin-left: var(--space-2);
    }

    .subscription-info {
      margin-top: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background-color: var(--color-info-bg);
      border-radius: var(--radius-sm);
      border-left: 3px solid var(--color-primary);
    }

    .info-item {
      display: flex;
      align-items: center;
      margin-bottom: var(--space-1);
    }

    .info-item:last-child {
      margin-bottom: 0;
    }

    .info-label {
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-right: var(--space-2);
      min-width: 60px;
    }

    .info-value {
      color: var(--color-text);
    }

    .status-enabled {
      color: var(--color-success);
      font-weight: 500;
    }

    .status-disabled {
      color: var(--color-danger);
      font-weight: 500;
    }

    .status-warned {
      color: var(--color-warning);
      font-weight: 500;
    }
  `]
})
export class SubscriptionSelectorComponent {
  readonly placeholder = input('Select a subscription');
  readonly required = input(true);
  readonly preselectedSubscriptionId = input<string | undefined>(undefined);
  readonly selectedSubscription = input<Subscription | null>(null);
  readonly subscriptionSelected = output<Subscription | null>();
  readonly subscriptionChanged = output<string | null>();

  private readonly permissionsService = inject(PermissionsService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly subscriptions = signal<Subscription[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedSub = signal<Subscription | null>(null);

  selectedSubscriptionId: string | null = null;

  constructor() {
    this.loadSubscriptions();

    // Set preselected subscription if provided
    const preselected = this.preselectedSubscriptionId();
    const selected = this.selectedSubscription();
    if (preselected) {
      this.selectedSubscriptionId = preselected;
    } else if (selected) {
      this.selectedSubscriptionId = selected.subscriptionId;
      this.selectedSub.set(selected);
    }
  }

  private loadSubscriptions(): void {
    this.loading.set(true);
    this.error.set(null);

    this.permissionsService.getRBACPermissions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.subscriptions.set(result.subscriptions.filter(sub => sub.state === 'Enabled'));
          this.loading.set(false);

          // Auto-select if there's a preselected ID or only one subscription
          const preselectedId = this.preselectedSubscriptionId();
          if (preselectedId) {
            const preselected = this.subscriptions().find(sub => sub.subscriptionId === preselectedId);
            if (preselected) {
              this.onSubscriptionChange(preselected.subscriptionId);
            }
          } else if (this.subscriptions().length === 1) {
            this.onSubscriptionChange(this.subscriptions()[0].subscriptionId);
          }
        },
        error: (error) => {
          console.error('Failed to load subscriptions:', error);
          this.error.set('Failed to load subscriptions');
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load subscriptions. Please try again.'
          });
        }
      });
  }

  onSubscriptionChange(subscriptionId: string | null): void {
    this.selectedSubscriptionId = subscriptionId;

    const sub = subscriptionId
      ? this.subscriptions().find(s => s.subscriptionId === subscriptionId) || null
      : null;
    this.selectedSub.set(sub);

    this.subscriptionSelected.emit(sub);
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

  getErrorMessage(): string {
    return `Failed to load subscriptions: ${this.error()}. Please try refreshing the page.`;
  }
}
