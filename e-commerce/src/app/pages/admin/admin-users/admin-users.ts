import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsers implements OnInit {
  private readonly adminSvc = inject(AdminService);
  readonly auth = inject(AuthService);

  users = signal<AdminUser[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  actionLoading = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);

  search = '';
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  limit = 20;

  // Confirm delete
  confirmDeleteId = signal<string | null>(null);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.getUsers({ page: this.currentPage(), limit: this.limit, search: this.search || undefined }).subscribe({
      next: (res) => {
        this.users.set(res.data);
        this.total.set(res.meta.total);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossibile caricare gli utenti');
        this.loading.set(false);
      },
    });
  }

  onSearch() {
    this.currentPage.set(1);
    this.load();
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.load();
  }

  toggleRole(user: AdminUser) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    this.actionLoading.set(user.id);
    this.actionSuccess.set(null);
    this.adminSvc.updateUserRole(user.id, newRole).subscribe({
      next: (updated) => {
        this.users.update(list => list.map(u => u.id === updated.id ? { ...u, role: updated.role } : u));
        this.actionLoading.set(null);
        this.actionSuccess.set(`Ruolo di ${updated.fullName} aggiornato a ${updated.role}`);
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: () => {
        this.actionLoading.set(null);
        this.error.set('Impossibile aggiornare il ruolo');
      },
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
    this.actionLoading.set(id);
    this.adminSvc.deleteUser(id).subscribe({
      next: () => {
        this.users.update(list => list.filter(u => u.id !== id));
        this.total.update(n => n - 1);
        this.confirmDeleteId.set(null);
        this.actionLoading.set(null);
        this.actionSuccess.set('Utente eliminato');
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: () => {
        this.actionLoading.set(null);
        this.error.set('Impossibile eliminare l\'utente');
        this.confirmDeleteId.set(null);
      },
    });
  }

  isCurrentUser(id: string): boolean {
    return this.auth.currentUser()?.id === id;
  }

  pagesArray(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const delta = 2;
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      pages.push(i);
    }
    return pages;
  }
}
