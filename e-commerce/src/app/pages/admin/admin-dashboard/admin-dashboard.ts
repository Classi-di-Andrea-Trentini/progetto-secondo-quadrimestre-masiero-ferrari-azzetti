import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, AdminStats } from '../../../services/admin.service';
import { SkeletonComponent } from '../../../components/skeleton/skeleton';
import { formatPrice as formatPriceShared } from '../../../services/format-price';

declare var Chart: any;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule, SkeletonComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard implements OnInit, OnDestroy {
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;
  private donutChart: any = null;
  private readonly adminSvc = inject(AdminService);

  stats = signal<AdminStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly orderStatusLabels: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };

  readonly statusColors: Record<string, string> = {
    pending: 'badge-warning',
    paid: 'badge-info',
    processing: 'badge-info',
    shipped: 'badge-accent',
    delivered: 'badge-success',
    completed: 'badge-success',
    cancelled: 'badge-danger',
    refunded: 'badge-neutral',
  };

  // Stessa semantica di statusColors qui sopra (le "wash", le versioni
  // chiare dei colori di stato), cosi' la fetta della ciambella e il badge
  // dello stesso stato d'ordine si leggono con lo stesso colore. Chart.js
  // vuole una stringa colore letterale, non puo' leggere una custom
  // property da solo: i valori veri si leggono da :root a runtime in
  // resolveChartColor, qui restano solo i nomi dei token.
  private readonly statusChartVars: Record<string, string> = {
    pending: '--color-warning-wash',
    paid: '--color-info-wash',
    processing: '--color-info-wash',
    shipped: '--color-accent-wash',
    delivered: '--color-success-wash',
    completed: '--color-success-wash',
    cancelled: '--color-danger-wash',
    refunded: '--color-sunken',
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
        this.error.set('Unable to load statistics');
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
          backgroundColor: data.map(s => this.resolveChartColor(this.statusChartVars[s.status] ?? '--color-sunken')),
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

  // Legge il valore vero del token direttamente da :root: niente hex ne'
  // oklch scritti qui, cosi' la ciambella segue la stessa rampa colori di
  // tutto il resto del sito se un giorno i token cambiano. Chart.js gira
  // solo nel browser (vedi la guardia "typeof Chart === 'undefined'" in
  // buildChart), quindi getComputedStyle e' sempre disponibile qui.
  private resolveChartColor(cssVar: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    return value || 'transparent';
  }

  // Formato inglese (€120.00), centralizzato in services/format-price.ts.
  formatPrice(v: string | number): string {
    return formatPriceShared(v);
  }

  statusLabel(s: string): string {
    return this.orderStatusLabels[s] ?? s;
  }

  statusColor(s: string): string {
    return this.statusColors[s] ?? 'badge-neutral';
  }
}
