import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, AdminStats } from '../../../services/admin.service';
import { SkeletonComponent } from '../../../components/skeleton/skeleton';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterModule, SkeletonComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
declare var Chart: any;

export class AdminDashboard implements OnInit, OnDestroy {
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;
  private donutChart: any = null;
  private readonly adminSvc = inject(AdminService);

  stats = signal<AdminStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly orderStatusLabels: Record<string, string> = {
    pending: 'In attesa',
    paid: 'Pagato',
    processing: 'In lavorazione',
    shipped: 'Spedito',
    delivered: 'Consegnato',
    completed: 'Completato',
    cancelled: 'Annullato',
    refunded: 'Rimborsato',
  };

  readonly statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-blue-100 text-blue-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-green-200 text-green-900',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-700',
  };

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.getStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
        setTimeout(() => this.buildChart(), 0);
      },
      error: () => {
        this.error.set('Impossibile caricare le statistiche');
        this.loading.set(false);
      },
    });
  }

  buildChart(): void {
    const el = this.donutCanvas?.nativeElement;
    if (!el || typeof Chart === 'undefined') return;
    const data = this.stats()?.ordersByStatus ?? [];
    if (this.donutChart) { this.donutChart.destroy(); }
    this.donutChart = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: data.map(s => this.statusLabel(s.status)),
        datasets: [{
          data: data.map(s => s.count),
          backgroundColor: ['#fef08a','#bfdbfe','#e0e7ff','#e9d5ff','#bbf7d0','#a7f3d0','#fecaca','#e5e7eb'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  ngOnDestroy(): void {
    if (this.donutChart) { this.donutChart.destroy(); }
  }

  formatPrice(v: string | number): string {
    return '€ ' + parseFloat(String(v)).toFixed(2).replace('.', ',');
  }

  statusLabel(s: string): string {
    return this.orderStatusLabels[s] ?? s;
  }

  statusColor(s: string): string {
    return this.statusColors[s] ?? 'bg-gray-100 text-gray-700';
  }
}
