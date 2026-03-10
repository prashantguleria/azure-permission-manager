import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonModule],
  template: `
    <div class="skeleton-container" [class.skeleton-inline]="type() === 'inline'">
      @if (type() === 'table') {
        <div class="skeleton-table">
          <!-- Header row -->
          <div class="skeleton-thead">
            <div class="skeleton-cell" style="width: 40px"><p-skeleton width="20px" height="20px" /></div>
            <div class="skeleton-cell" style="width: 40px"><p-skeleton width="20px" height="20px" /></div>
            <div class="skeleton-cell" style="flex: 2"><p-skeleton width="80%" height="14px" /></div>
            <div class="skeleton-cell" style="flex: 1"><p-skeleton width="70%" height="14px" /></div>
            <div class="skeleton-cell" style="flex: 1"><p-skeleton width="60%" height="14px" /></div>
            <div class="skeleton-cell" style="width: 80px"><p-skeleton width="50px" height="14px" /></div>
            <div class="skeleton-cell" style="width: 80px"><p-skeleton width="40px" height="14px" /></div>
            <div class="skeleton-cell" style="width: 100px"><p-skeleton width="60px" height="14px" /></div>
          </div>
          <!-- Body rows -->
          @for (item of skeletonRows(); track $index) {
            <div class="skeleton-trow">
              <div class="skeleton-cell" style="width: 40px"><p-skeleton width="18px" height="18px" borderRadius="4px" /></div>
              <div class="skeleton-cell" style="width: 40px"><p-skeleton width="14px" height="14px" /></div>
              <div class="skeleton-cell" style="flex: 2">
                <p-skeleton width="75%" height="14px" styleClass="mb-1" />
                <p-skeleton width="50%" height="10px" />
              </div>
              <div class="skeleton-cell" style="flex: 1"><p-skeleton width="65%" height="14px" /></div>
              <div class="skeleton-cell" style="flex: 1"><p-skeleton width="55%" height="14px" /></div>
              <div class="skeleton-cell" style="width: 80px"><p-skeleton width="60px" height="22px" borderRadius="12px" /></div>
              <div class="skeleton-cell" style="width: 80px"><p-skeleton width="30px" height="22px" borderRadius="12px" /></div>
              <div class="skeleton-cell" style="width: 100px">
                <div style="display:flex;gap:4px">
                  <p-skeleton width="28px" height="28px" borderRadius="6px" />
                  <p-skeleton width="28px" height="28px" borderRadius="6px" />
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (type() === 'card') {
        <div class="skeleton-cards">
          @for (item of skeletonRows(); track $index) {
            <div class="skeleton-card-item">
              <p-skeleton width="40%" height="12px" styleClass="mb-2" />
              <p-skeleton width="60%" height="24px" />
            </div>
          }
        </div>
      }

      @if (type() === 'list') {
        <div class="skeleton-list">
          @for (item of skeletonRows(); track $index) {
            <div class="skeleton-list-item">
              <p-skeleton shape="circle" size="2.5rem" />
              <div style="flex:1">
                <p-skeleton width="60%" height="14px" styleClass="mb-1" />
                <p-skeleton width="40%" height="10px" />
              </div>
            </div>
          }
        </div>
      }

      @if (type() === 'inline') {
        <p-skeleton width="100%" height="14px" />
      }
    </div>
  `,
  styles: [`
    .skeleton-container {
      width: 100%;
    }

    .skeleton-inline {
      display: inline-block;
    }

    .skeleton-table {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .skeleton-thead {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
    }

    .skeleton-trow {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);

      &:last-child {
        border-bottom: none;
      }
    }

    .skeleton-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .skeleton-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--space-3);
    }

    .skeleton-card-item {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-4) var(--space-5);
    }

    .skeleton-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .skeleton-list-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }

    :host ::ng-deep .mb-1 { margin-bottom: 4px; }
    :host ::ng-deep .mb-2 { margin-bottom: 8px; }
  `]
})
export class SkeletonLoaderComponent {
  readonly type = input<'table' | 'card' | 'list' | 'inline'>('table');
  readonly rows = input(5);

  readonly skeletonRows = computed(() => Array(this.rows()).fill(0).map((_, i) => i));
}
