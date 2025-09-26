import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule, SkeletonModule, CardModule],
  template: `
    <div class="skeleton-container">
      <!-- Table skeleton -->
      <div *ngIf="type === 'table'" class="table-skeleton">
        <p-card>
          <div class="skeleton-header">
            <p-skeleton width="100px" height="2rem" class="skeleton-button"></p-skeleton>
            <p-skeleton width="300px" height="2rem" class="skeleton-input"></p-skeleton>
          </div>
          <div class="skeleton-table-rows">
            <div *ngFor="let item of skeletonRows" class="skeleton-row">
              <p-skeleton width="100%" height="1rem"></p-skeleton>
            </div>
          </div>
        </p-card>
      </div>

      <!-- Card skeleton -->
      <div *ngIf="type === 'card'" class="card-skeleton">
        <p-card *ngFor="let item of skeletonRows">
          <div class="skeleton-card-content">
            <p-skeleton shape="circle" size="3rem" class="skeleton-avatar"></p-skeleton>
            <div class="skeleton-text">
              <p-skeleton width="100%" height="1rem" class="mb-2"></p-skeleton>
              <p-skeleton width="80%" height="1rem"></p-skeleton>
            </div>
          </div>
        </p-card>
      </div>

      <!-- List skeleton -->
      <div *ngIf="type === 'list'" class="list-skeleton">
        <div *ngFor="let item of skeletonRows" class="skeleton-list-item">
          <div class="skeleton-list-content">
            <p-skeleton shape="circle" size="2.5rem" class="skeleton-avatar"></p-skeleton>
            <p-skeleton width="100%" height="1rem" class="skeleton-text"></p-skeleton>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .skeleton-container {
      padding: 16px;
    }

    .skeleton-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 16px;
    }

    .skeleton-button {
      width: 100px;
    }

    .skeleton-input {
      flex: 1;
      max-width: 300px;
    }

    .skeleton-table-rows {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-row {
      padding: 12px;
      border: 1px solid #f0f0f0;
      border-radius: 6px;
    }

    .card-skeleton {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .list-skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-list-item {
      padding: 16px;
      border: 1px solid #f0f0f0;
      border-radius: 6px;
    }

    .skeleton-card-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .skeleton-text {
      flex: 1;
    }

    .skeleton-list-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .skeleton-list-content .skeleton-text {
      flex: 1;
    }

    .mb-2 {
      margin-bottom: 8px;
    }
  `]
})
export class SkeletonLoaderComponent {
  @Input() type: 'table' | 'card' | 'list' = 'table';
  @Input() rows: number = 5;

  get skeletonRows(): number[] {
    return Array(this.rows).fill(0).map((_, i) => i);
  }
}