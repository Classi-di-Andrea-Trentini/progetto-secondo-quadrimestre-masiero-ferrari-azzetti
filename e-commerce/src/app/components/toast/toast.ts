import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
})
export class ToastComponent {
  readonly toastSvc = inject(ToastService);

  remove(id: string): void {
    this.toastSvc.remove(id);
  }

  trackById(_: number, t: Toast): string {
    return t.id;
  }

  iconFor(type: Toast['type']): string {
    if (type === 'success') return 'M5 13l4 4L19 7';
    if (type === 'error') return 'M6 18L18 6M6 6l12 12';
    return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  containerClass(type: Toast['type']): string {
    if (type === 'success') return 'bg-success-wash text-success';
    if (type === 'error') return 'bg-danger-wash text-danger';
    return 'bg-info-wash text-info';
  }

  iconClass(type: Toast['type']): string {
    if (type === 'success') return 'text-success';
    if (type === 'error') return 'text-danger';
    return 'text-info';
  }
}
