import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminService, AdminProduct, CreateProductPayload } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.css',
})
export class AdminProducts implements OnInit {
  private readonly adminSvc = inject(AdminService);
  private readonly fb = inject(FormBuilder);

  products = signal<AdminProduct[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);
  formError = signal<string | null>(null);
  formLoading = signal(false);

  search = '';
  isActiveFilter = '';
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);
  limit = 20;

  // Modal state
  showModal = signal(false);
  editingProduct = signal<AdminProduct | null>(null);
  confirmDeleteId = signal<string | null>(null);
  deleteLoading = signal(false);

  readonly productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    description: [''],
    basePrice: [0, [Validators.required, Validators.min(0.01)]],
    isActive: [true],
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    const isActive = this.isActiveFilter === 'true' ? true : this.isActiveFilter === 'false' ? false : undefined;
    this.adminSvc.getProducts({ page: this.currentPage(), limit: this.limit, search: this.search || undefined, isActive }).subscribe({
      next: (res) => {
        this.products.set(res.data);
        this.total.set(res.meta.total);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossibile caricare i prodotti');
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

  openCreate() {
    this.editingProduct.set(null);
    this.formError.set(null);
    this.productForm.reset({ name: '', slug: '', description: '', basePrice: 0, isActive: true });
    this.showModal.set(true);
  }

  openEdit(product: AdminProduct) {
    this.editingProduct.set(product);
    this.formError.set(null);
    this.productForm.patchValue({
      name: product.name,
      slug: product.slug,
      description: product.description ?? '',
      basePrice: parseFloat(String(product.basePrice)),
      isActive: product.isActive,
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingProduct.set(null);
    this.formError.set(null);
  }

  autoSlug() {
    if (!this.editingProduct()) {
      const name = this.productForm.controls.name.value;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      this.productForm.controls.slug.setValue(slug);
    }
  }

  submitForm() {
    if (this.productForm.invalid || this.formLoading()) return;
    this.formLoading.set(true);
    this.formError.set(null);

    const { name, slug, description, basePrice, isActive } = this.productForm.getRawValue();
    const payload: CreateProductPayload = { name, slug, description: description || undefined, basePrice, isActive };

    const editing = this.editingProduct();
    const obs = editing
      ? this.adminSvc.updateProduct(editing.id, payload)
      : this.adminSvc.createProduct(payload);

    obs.subscribe({
      next: (saved) => {
        if (editing) {
          this.products.update(list => list.map(p => p.id === saved.id ? { ...p, ...saved } : p));
          this.actionSuccess.set('Prodotto aggiornato');
        } else {
          this.load();
          this.actionSuccess.set('Prodotto creato');
        }
        this.formLoading.set(false);
        this.closeModal();
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: (err) => {
        this.formError.set(err?.error?.message ?? 'Errore durante il salvataggio');
        this.formLoading.set(false);
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
    this.deleteLoading.set(true);
    this.adminSvc.deleteProduct(id).subscribe({
      next: () => {
        this.products.update(list => list.filter(p => p.id !== id));
        this.total.update(n => n - 1);
        this.confirmDeleteId.set(null);
        this.deleteLoading.set(false);
        this.actionSuccess.set('Prodotto eliminato');
        setTimeout(() => this.actionSuccess.set(null), 3000);
      },
      error: () => {
        this.deleteLoading.set(false);
        this.error.set('Impossibile eliminare il prodotto');
        this.confirmDeleteId.set(null);
      },
    });
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
