import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzCardModule } from 'ng-zorro-antd/card';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule, NzSkeletonModule, NzCardModule],
  template: `
    <div class="skeleton-container">
      <!-- Table skeleton -->
      <div *ngIf="type === 'table'" class="table-skeleton">
        <nz-card>
          <div class="skeleton-header">
            <nz-skeleton-element nzType="button" [nzSize]="'default'" class="skeleton-button"></nz-skeleton-element>
            <nz-skeleton-element nzType="input" [nzSize]="'default'" class="skeleton-input"></nz-skeleton-element>
          </div>
          <div class="skeleton-table-rows">
            <div *ngFor="let item of skeletonRows" class="skeleton-row">
              <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 1 }" [nzTitle]="false"></nz-skeleton>
            </div>
          </div>
        </nz-card>
      </div>

      <!-- Card skeleton -->
      <div *ngIf="type === 'card'" class="card-skeleton">
        <nz-card *ngFor="let item of skeletonRows">
          <nz-skeleton [nzActive]="true" [nzAvatar]="true" [nzParagraph]="{ rows: 2 }"></nz-skeleton>
        </nz-card>
      </div>

      <!-- List skeleton -->
      <div *ngIf="type === 'list'" class="list-skeleton">
        <div *ngFor="let item of skeletonRows" class="skeleton-list-item">
          <nz-skeleton [nzActive]="true" [nzAvatar]="true" [nzParagraph]="{ rows: 1 }"></nz-skeleton>
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
  `]
})
export class SkeletonLoaderComponent {
  @Input() type: 'table' | 'card' | 'list' = 'table';
  @Input() rows: number = 5;

  get skeletonRows(): number[] {
    return Array(this.rows).fill(0).map((_, i) => i);
  }
}