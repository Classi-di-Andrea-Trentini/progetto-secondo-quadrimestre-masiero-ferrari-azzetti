import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminOrderSummary, AdminOrderDetail } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
})
export class AdminOrders implements OnInit {
  private readonly adminSvc = inject(AdminService);

  orders = signal<AdminOrderSummary[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);

  search = '';
  statusFilter = '';
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  limit = 20;

  // Detail modal
  selectedOrder = signal<AdminOrderDetail | null>(null);
  detailLoading = signal(false);
  showDetail = signal(false);

  // Status update
  newStatus = signal('');
  statusNote = '';
  statusLoading = signal(false);

  readonly allStatuses = [
    { value: '', label: 'Tutti gli stati' },
    { value: 'pending', label: 'In attesa' },
    { value: 'paid', label: 'Pagato' },
    { value: 'processing', label: 'In lavorazione' },
    { value: 'shipped', label: 'Spedito' },
    { value: 'delivered', label: 'Consegnato' },
    { value: 'completed', label: 'Completato' },
    { value: 'cancelled', label: 'Annullato' },
    { value: 'refunded', label: 'Rimborsato' },
  ];

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
    this.adminSvc.getOrders({
      page: this.currentPage(),
      limit: this.limit,
      search: this.search || undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res) => {
        this.orders.set(res.data);
        this.total.set(res.meta.total);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossibile caricare gli ordini');
        this.loading.set(false);
      },
    });
  }

  onSearch() {
    this.currentPage.set(1);
    this.load();
  }

  onStatusFilter() {
    this.currentPage.set(1);
    this.load();
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.load();
  }

  openDetail(id: string) {
    this.showDetail.set(true);
    this.detailLoading.set(true);
    this.selectedOrder.set(null);
    this.statusNote = '';
    this.adminSvc.getOrderDetail(id).subscribe({
      next: (order) => {
        this.selectedOrder.set(order);
        this.newStatus.set(order.status);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.showDetail.set(false);
        this.error.set('Impossibile caricare i dettagli');
      },
    });
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedOrder.set(null);
  }

  updateStatus() {
    const order = this.selectedOrder();
    if (!order || this.statusLoading()) return;
    this.statusLoading.set(true);
    this.adminSvc.updateOrderStatus(order.id, this.newStatus(), this.statusNote || undefined).subscribe({
      next: (updated) => {
        this.orders.update(list => list.map(o => o.id === updated.id ? { ...o, status: updated.status } : o));
        this.selectedOrder.update(o => o ? { ...o, status: updated.status } : o);
        this.statusLoading.set(false);
        this.actionSuccess.set(`Stato ordine aggiornato a "${this.statusLabel(updated.status)}"`);
        this.statusNote = '';
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: () => {
        this.statusLoading.set(false);
        this.error.set('Impossibile aggiornare lo stato');
      },
    });
  }

  statusLabel(s: string): string {
    return this.allStatuses.find(st => st.value === s)?.label ?? s;
  }

  statusColor(s: string): string {
    return this.statusColors[s] ?? 'bg-gray-100 text-gray-700';
  }

  formatPrice(v: string | number): string {
    return '€ ' + parseFloat(String(v)).toFixed(2).replace('.', ',');
  }

  pagesArray(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      pages.push(i);
    }
    return pages;
  }
}
