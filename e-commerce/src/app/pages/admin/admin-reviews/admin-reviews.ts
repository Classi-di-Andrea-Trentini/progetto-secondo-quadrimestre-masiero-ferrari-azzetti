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
        this.showSuccess(`${ids.length} reviews approved`);
      },
      error: () => { this.bulkLoading.set(false); this.error.set('Error in the bulk operation'); },
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
        this.showSuccess(`${ids.length} reviews rejected`);
      },
      error: () => { this.bulkLoading.set(false); this.error.set('Error in the bulk operation'); },
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
        this.showSuccess(`${ids.length} reviews deleted`);
      },
      error: () => { this.bulkLoading.set(false); this.error.set('Error in the bulk operation'); },
    });
  }

  readonly allStatuses = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  readonly statusColors: Record<string, string> = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
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
        this.error.set('Unable to load reviews');
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
        this.showSuccess('Review approved');
      },
      error: () => this.error.set('Unable to update the review'),
    });
  }

  reject(id: string) {
    this.adminSvc.updateReviewStatus(id, 'rejected').subscribe({
      next: (updated) => {
        this.reviews.update(list => list.map(r => r.id === id ? updated : r));
        this.showSuccess('Review rejected');
      },
      error: () => this.error.set('Unable to update the review'),
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
        this.showSuccess('Review deleted');
      },
      error: () => {
        this.deleteLoading.set(false);
        this.error.set('Unable to delete the review');
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
    return this.statusColors[s] ?? 'badge-neutral';
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
