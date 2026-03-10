import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-permission-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="permission-details">
      <section class="detail-section">
        <h4 class="section-title">Principal Information</h4>
        <div class="detail-grid">
          <div><strong>Name:</strong> {{ permission?.properties?.principalDisplayName || 'Unknown' }}</div>
          <div><strong>Email:</strong> {{ permission?.properties?.principalEmail || 'Not available' }}</div>
          <div><strong>ID:</strong> {{ permission?.properties?.principalId }}</div>
          <div><strong>Type:</strong> {{ permission?.properties?.principalType }}</div>
        </div>
      </section>

      <section class="detail-section">
        <h4 class="section-title">Role Assignment</h4>
        <div class="detail-grid">
          <div><strong>Role:</strong> {{ permission?.properties?.roleDefinitionName }}</div>
          <div><strong>Scope:</strong> {{ permission?.properties?.scope }}</div>
          <div><strong>Created:</strong> {{ formatDate(permission?.properties?.createdOn) }}</div>
          <div><strong>Updated:</strong> {{ formatDate(permission?.properties?.updatedOn) }}</div>
        </div>
      </section>

      <div class="detail-actions">
        <button class="btn btn-secondary" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .permission-details {
      min-width: 400px;
      padding: var(--space-4);
    }

    .detail-section {
      margin-bottom: var(--space-4);
    }

    .section-title {
      font-size: var(--font-size-lg);
      font-weight: 600;
      margin-bottom: var(--space-3);
      color: var(--color-text);
    }

    .detail-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-2);
      color: var(--color-text-secondary);
    }

    .detail-grid strong {
      color: var(--color-text);
    }

    .detail-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-4);
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

    .btn-secondary {
      background: var(--color-surface);
      color: var(--color-text);
      border-color: var(--color-border);
    }

    .btn-secondary:hover {
      background: var(--color-surface-hover);
      border-color: var(--color-border-strong);
    }
  `]
})
export class PermissionDetailsComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);

  readonly permission: any;

  constructor() {
    this.permission = this.config.data?.permission;
  }

  close(): void {
    this.ref.close();
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleString();
  }
}
