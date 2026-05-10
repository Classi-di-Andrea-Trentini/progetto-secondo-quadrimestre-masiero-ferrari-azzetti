import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);

  private add(type: Toast['type'], message: string, duration = 3500): void {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type, message };
    this.toasts.update(list => {
      const next = [...list, toast];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
    setTimeout(() => this.remove(id), duration);
  }

  success(message: string, duration?: number): void {
    this.add('success', message, duration);
  }

  error(message: string, duration?: number): void {
    this.add('error', message, duration);
  }

  info(message: string, duration?: number): void {
    this.add('info', message, duration);
  }

  remove(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
