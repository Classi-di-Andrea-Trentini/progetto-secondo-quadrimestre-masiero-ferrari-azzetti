import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.html',
})
export class SkeletonComponent {
  @Input() type: 'product-card' | 'table-row' | 'text' | 'circle' = 'text';
  @Input() count: number = 1;

  items(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
