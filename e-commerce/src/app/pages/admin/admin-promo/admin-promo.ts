import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminService, AdminPromoCode, CreatePromoCodePayload } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-promo',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-promo.html',
  styleUrl: './admin-promo.css',
})
export class AdminPromo implements OnInit {
  private readonly adminSvc = inject(AdminService);
  private readonly fb = inject(FormBuilder);

  promoCodes = signal<AdminPromoCode[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);
  formError = signal<string | null>(null);
  formLoading = signal(false);
  deleteLoading = signal<string | null>(null);

  search = '';
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  limit = 20;

  showModal = signal(false);
  confirmDeleteId = signal<string | null>(null);

  readonly promoForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    discountType: ['percentage', Validators.required],
    discountValue: [10, [Validators.required, Validators.min(0.01)]],
    minOrderAmount: [null as number | null],
    maxUses: [null as number | null],
    expiresAt: [''],
    isActive: [true],
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.getPromoCodes({ page: this.currentPage(), limit: this.limit, search: this.search || undefined }).subscribe({
      next: (res) => {
        this.promoCodes.set(res.data);
        this.total.set(res.meta.total);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossibile caricare i codici promo');
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

  openCreate() {
    this.formError.set(null);
    this.promoForm.reset({
      code: '', discountType: 'percentage', discountValue: 10,
      minOrderAmount: null, maxUses: null, expiresAt: '', isActive: true,
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.formError.set(null);
  }

  submitForm() {
    if (this.promoForm.invalid || this.formLoading()) return;
    this.formLoading.set(true);
    this.formError.set(null);

    const v = this.promoForm.getRawValue();
    const payload: CreatePromoCodePayload = {
      code: v.code.toUpperCase(),
      discountType: v.discountType,
      discountValue: v.discountValue,
      minOrderAmount: v.minOrderAmount ?? undefined,
      maxUses: v.maxUses ?? undefined,
      expiresAt: v.expiresAt || undefined,
      isActive: v.isActive,
    };

    this.adminSvc.createPromoCode(payload).subscribe({
      next: () => {
        this.formLoading.set(false);
        this.closeModal();
        this.load();
        this.actionSuccess.set('Codice promo creato');
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: (err) => {
        this.formError.set(err?.error?.message ?? 'Errore durante la creazione');
        this.formLoading.set(false);
      },
    });
  }

  toggleActive(promo: AdminPromoCode) {
    this.adminSvc.updatePromoCode(promo.id, { isActive: !promo.isActive }).subscribe({
      next: (updated) => {
        this.promoCodes.update(list => list.map(p => p.id === updated.id ? { ...p, isActive: updated.isActive } : p));
        this.actionSuccess.set(`Codice ${updated.code} ${updated.isActive ? 'attivato' : 'disattivato'}`);
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: () => this.error.set('Impossibile aggiornare il codice'),
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
    this.deleteLoading.set(id);
    this.adminSvc.deletePromoCode(id).subscribe({
      next: () => {
        this.promoCodes.update(list => list.filter(p => p.id !== id));
        this.total.update(n => n - 1);
        this.confirmDeleteId.set(null);
        this.deleteLoading.set(null);
        this.actionSuccess.set('Codice promo eliminato');
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: () => {
        this.deleteLoading.set(null);
        this.error.set('Impossibile eliminare il codice');
        this.confirmDeleteId.set(null);
      },
    });
  }

  formatDiscount(promo: AdminPromoCode): string {
    const v = parseFloat(String(promo.discountValue));
    return promo.discountType === 'percentage' ? `${v}%` : `€ ${v.toFixed(2)}`;
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

  get isPercentage() { return this.promoForm.controls.discountType.value === 'percentage'; }
}
