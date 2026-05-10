import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminService, AdminReview } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-reviews.html',
  styleUrl: './admin-reviews.css',
})
export class AdminReviews implements OnInit {
  private readonly adminSvc = inject(AdminService);

  reviews = signal<AdminReview[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);

  search = '';
  statusFilter = '';
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  limit = 20;

  confirmDeleteId = signal<string | null>(null);
  deleteLoading = signal(false);

  // Bulk
  selectedIds = signal<Set<string>>(new Set());
  bulkLoading = signal(false);
  readonly hasSelection = computed(() => this.selectedIds().size > 0);

  toggleSelect(id: string) {
    const s = new Set(this.selectedIds());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selectedIds.set(s);
  }

  isSelected(id: string): boolean { return this.selectedIds().has(id); }

  selectAll() {
    this.selectedIds.set(new Set(this.reviews().map(r => r.id)));
  }

  clearSelection() { this.selectedIds.set(new Set()); }

  bulkApprove() {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.bulkLoading.set(true);
    forkJoin(ids.map(id => this.adminSvc.updateReviewStatus(id, 'approved'))).subscribe({
      next: (updated) => {
        this.reviews.update(list => list.map(r => { const u = updated.find(x => x.id === r.id); return u ?? r; }));
        this.clearSelection();
        this.bulkLoading.set(false);
        this.showSuccess(`${ids.length} recensioni approvate`);
      },
      error: () => { this.bulkLoading.set(false); this.error.set('Errore nell\'operazione bulk'); },
    });
  }

  bulkReject() {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.bulkLoading.set(true);
    forkJoin(ids.map(id => this.adminSvc.updateReviewStatus(id, 'rejected'))).subscribe({
      next: (updated) => {
        this.reviews.update(list => list.map(r => { const u = updated.find(x => x.id === r.id); return u ?? r; }));
        this.clearSelection();
        this.bulkLoading.set(false);
        this.showSuccess(`${ids.length} recensioni rifiutate`);
      },
      error: () => { this.bulkLoading.set(false); this.error.set('Errore nell\'operazione bulk'); },
    });
  }

  bulkDelete() {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.bulkLoading.set(true);
    forkJoin(ids.map(id => this.adminSvc.deleteReview(id))).subscribe({
      next: () => {
        this.reviews.update(list => list.filter(r => !ids.includes(r.id)));
        this.total.update(n => n - ids.length);
        this.clearSelection();
        this.bulkLoading.set(false);
        this.showSuccess(`${ids.length} recensioni eliminate`);
      },
      error: () => { this.bulkLoading.set(false); this.error.set('Errore nell\'operazione bulk'); },
    });
  }

  readonly allStatuses = [
    { value: '', label: 'Tutti' },
    { value: 'pending', label: 'In attesa' },
    { value: 'approved', label: 'Approvata' },
    { value: 'rejected', label: 'Rifiutata' },
  ];

  readonly statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.getReviews({
      page: this.currentPage(),
      limit: this.limit,
      search: this.search || undefined,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res) => {
        this.reviews.set(res.data);
        this.total.set(res.meta.total);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossibile caricare le recensioni');
        this.loading.set(false);
      },
    });
  }

  onSearch() {
    this.currentPage.set(1);
    this.load();
  }

  onFilter() {
    this.currentPage.set(1);
    this.load();
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.load();
  }

  approve(id: string) {
    this.adminSvc.updateReviewStatus(id, 'approved').subscribe({
      next: (updated) => {
        this.reviews.update(list => list.map(r => r.id === id ? updated : r));
        this.showSuccess('Recensione approvata');
      },
      error: () => this.error.set('Impossibile aggiornare la recensione'),
    });
  }

  reject(id: string) {
    this.adminSvc.updateReviewStatus(id, 'rejected').subscribe({
      next: (updated) => {
        this.reviews.update(list => list.map(r => r.id === id ? updated : r));
        this.showSuccess('Recensione rifiutata');
      },
      error: () => this.error.set('Impossibile aggiornare la recensione'),
    });
  }

  requestDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  cancelDelete() {
    this.confirmDeleteId.set(null);
  }

  confirmDelete() {
    const id = this.confirmDeleteId();
    if (!id) return;
    this.deleteLoading.set(true);
    this.adminSvc.deleteReview(id).subscribe({
      next: () => {
        this.reviews.update(list => list.filter(r => r.id !== id));
        this.total.update(n => n - 1);
        this.confirmDeleteId.set(null);
        this.deleteLoading.set(false);
        this.showSuccess('Recensione eliminata');
      },
      error: () => {
        this.deleteLoading.set(false);
        this.error.set('Impossibile eliminare la recensione');
      },
    });
  }

  private showSuccess(msg: string) {
    this.actionSuccess.set(msg);
    setTimeout(() => this.actionSuccess.set(null), 3000);
  }

  statusLabel(s: string): string {
    return this.allStatuses.find(st => st.value === s)?.label ?? s;
  }

  statusColor(s: string): string {
    return this.statusColors[s] ?? 'bg-gray-100 text-gray-700';
  }

  stars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
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
