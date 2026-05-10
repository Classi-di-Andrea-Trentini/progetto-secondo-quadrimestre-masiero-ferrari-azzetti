import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminReturn } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-returns.html',
})
export class AdminReturns implements OnInit {
  private readonly adminSvc = inject(AdminService);

  returns = signal<AdminReturn[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);
  actionLoading = signal<string | null>(null);

  search = '';
  statusFilter = '';
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  limit = 20;

  selectedReturn = signal<AdminReturn | null>(null);
  noteInput = '';
  refundInput: number | null = null;
  updateLoading = signal(false);

  readonly allStatuses = [
    { value: '', label: 'Tutti gli stati' },
    { value: 'requested', label: 'Richiesto' },
    { value: 'approved', label: 'Approvato' },
    { value: 'rejected', label: 'Rifiutato' },
    { value: 'received', label: 'Ricevuto' },
    { value: 'refunded', label: 'Rimborsato' },
  ];

  readonly statusColors: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    received: 'bg-purple-100 text-purple-800',
    refunded: 'bg-green-100 text-green-800',
  };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.getReturns({
      page: this.currentPage(), limit: this.limit,
      search: this.search || undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res) => {
        this.returns.set(res.data);
        this.total.set(res.meta.total);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => { this.error.set('Impossibile caricare i resi'); this.loading.set(false); },
    });
  }

  onSearch() { this.currentPage.set(1); this.load(); }
  onFilter() { this.currentPage.set(1); this.load(); }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.load();
  }

  statusLabel(s: string): string { return this.allStatuses.find(x => x.value === s)?.label ?? s; }
  statusColor(s: string): string { return this.statusColors[s] ?? 'bg-gray-100 text-gray-700'; }

  openDetail(r: AdminReturn) {
    this.selectedReturn.set(r);
    this.noteInput = r.adminNote ?? '';
    this.refundInput = r.refundAmount ? parseFloat(r.refundAmount) : null;
  }

  closeDetail() { this.selectedReturn.set(null); }

  updateStatus(status: string) {
    const r = this.selectedReturn();
    if (!r || this.updateLoading()) return;
    this.updateLoading.set(true);
    this.adminSvc.updateReturnStatus(r.id, {
      status,
      adminNote: this.noteInput || undefined,
      refundAmount: this.refundInput ?? undefined,
    }).subscribe({
      next: (updated) => {
        this.returns.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.selectedReturn.set(updated);
        this.updateLoading.set(false);
        this.actionSuccess.set('Stato reso aggiornato');
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: () => {
        this.updateLoading.set(false);
        this.error.set('Errore aggiornamento stato');
      },
    });
  }

  formatPrice(v: string | number | null): string {
    if (!v) return '—';
    return '€ ' + parseFloat(String(v)).toFixed(2).replace('.', ',');
  }

  pagesArray(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
    return pages;
  }
}
