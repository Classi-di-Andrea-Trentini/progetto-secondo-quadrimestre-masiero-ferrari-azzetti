import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  AdminService,
  AdminProduct,
  AdminProductDetail,
  ProductVariant,
  ProductImage,
  CreateProductPayload,
} from '../../../services/admin.service';
import { firstValueFrom } from 'rxjs';

type ModalTab = 'info' | 'variants' | 'images';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
  editingProduct = signal<AdminProductDetail | null>(null);
  activeTab = signal<ModalTab>('info');
  modalLoading = signal(false);

  confirmDeleteId = signal<string | null>(null);
  deleteLoading = signal(false);

  // ─── Info form ────────────────────────────────────────────────────────────
  readonly productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    description: [''],
    basePrice: [0, [Validators.required, Validators.min(0.01)]],
    isActive: [true],
  });

  // ─── Variant form ─────────────────────────────────────────────────────────
  showVariantForm = signal(false);
  editingVariant = signal<ProductVariant | null>(null);
  variantFormLoading = signal(false);
  variantFormError = signal<string | null>(null);

  readonly variantForm = this.fb.nonNullable.group({
    sku: ['', Validators.required],
    size: [''],
    color: [''],
    colorHex: [''],
    material: [''],
    priceOverride: [null as number | null],
    stockQty: [0, [Validators.min(0)]],
    isActive: [true],
  });

  // ─── Image form ───────────────────────────────────────────────────────────
  showImageForm = signal(false);
  imageMode: 'upload' | 'url' = 'upload';
  imageUrl = '';
  imageAlt = '';
  imageFile: File | null = null;
  imagePreview = signal<string | null>(null);
  imageFormLoading = signal(false);
  imageFormError = signal<string | null>(null);

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

  onSearch() { this.currentPage.set(1); this.load(); }
  onFilter() { this.currentPage.set(1); this.load(); }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.load();
  }

  // ─── Modal open/close ─────────────────────────────────────────────────────

  openCreate() {
    this.editingProduct.set(null);
    this.formError.set(null);
    this.activeTab.set('info');
    this.productForm.reset({ name: '', slug: '', description: '', basePrice: 0, isActive: true });
    this.showModal.set(true);
  }

  async openEdit(product: AdminProduct) {
    this.formError.set(null);
    this.activeTab.set('info');
    this.modalLoading.set(true);
    this.showModal.set(true);

    try {
      const detail = await firstValueFrom(this.adminSvc.getProductDetail(product.id));
      this.editingProduct.set(detail);
      this.productForm.patchValue({
        name: detail.name,
        slug: detail.slug,
        description: detail.description ?? '',
        basePrice: parseFloat(String(detail.basePrice)),
        isActive: detail.isActive,
      });
    } catch {
      this.formError.set('Impossibile caricare il prodotto');
    } finally {
      this.modalLoading.set(false);
    }
  }

  closeModal() {
    this.showModal.set(false);
    this.editingProduct.set(null);
    this.formError.set(null);
    this.showVariantForm.set(false);
    this.showImageForm.set(false);
  }

  setTab(tab: ModalTab) {
    this.activeTab.set(tab);
    this.showVariantForm.set(false);
    this.showImageForm.set(false);
  }

  autoSlug() {
    if (!this.editingProduct()) {
      const name = this.productForm.controls.name.value;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      this.productForm.controls.slug.setValue(slug);
    }
  }

  // ─── Info tab: save basic info ─────────────────────────────────────────────

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
      next: async (saved) => {
        if (editing) {
          // Refresh detail for variants/images tabs
          const detail = await firstValueFrom(this.adminSvc.getProductDetail(saved.id));
          this.editingProduct.set(detail);
          this.products.update(list => list.map(p => p.id === saved.id ? { ...p, ...saved } : p));
          this.actionSuccess.set('Prodotto aggiornato');
        } else {
          // After create, switch to edit mode so user can add variants/images
          const detail = await firstValueFrom(this.adminSvc.getProductDetail(saved.id));
          this.editingProduct.set(detail);
          this.load();
          this.actionSuccess.set('Prodotto creato — ora puoi aggiungere varianti e immagini');
        }
        this.formLoading.set(false);
        setTimeout(() => this.actionSuccess.set(null), 4000);
      },
      error: (err) => {
        this.formError.set(err?.error?.message ?? 'Errore durante il salvataggio');
        this.formLoading.set(false);
      },
    });
  }

  // ─── Variants ─────────────────────────────────────────────────────────────

  openAddVariant() {
    this.editingVariant.set(null);
    this.variantFormError.set(null);
    this.variantForm.reset({ sku: '', size: '', color: '', colorHex: '', material: '', priceOverride: null, stockQty: 0, isActive: true });
    this.showVariantForm.set(true);
  }

  openEditVariant(v: ProductVariant) {
    this.editingVariant.set(v);
    this.variantFormError.set(null);
    this.variantForm.patchValue({
      sku: v.sku,
      size: v.size ?? '',
      color: v.color ?? '',
      colorHex: v.colorHex ?? '',
      material: v.material ?? '',
      priceOverride: v.priceOverride ? parseFloat(String(v.priceOverride)) : null,
      stockQty: v.stockQty,
      isActive: v.isActive,
    });
    this.showVariantForm.set(true);
  }

  cancelVariantForm() {
    this.showVariantForm.set(false);
    this.editingVariant.set(null);
  }

  async saveVariant() {
    if (this.variantForm.invalid || this.variantFormLoading()) return;
    const productId = this.editingProduct()?.id;
    if (!productId) return;

    this.variantFormLoading.set(true);
    this.variantFormError.set(null);

    const v = this.variantForm.getRawValue();
    const payload: any = {
      sku: v.sku,
      size: v.size || undefined,
      color: v.color || undefined,
      colorHex: v.colorHex || undefined,
      material: v.material || undefined,
      priceOverride: v.priceOverride ?? undefined,
      stockQty: v.stockQty,
      isActive: v.isActive,
    };

    try {
      const editing = this.editingVariant();
      if (editing) {
        const updated = await firstValueFrom(this.adminSvc.updateVariant(productId, editing.id, payload));
        this.editingProduct.update(p => p ? {
          ...p,
          variants: p.variants.map(vr => vr.id === updated.id ? updated : vr),
        } : p);
      } else {
        const created = await firstValueFrom(this.adminSvc.createVariant(productId, payload));
        this.editingProduct.update(p => p ? { ...p, variants: [...p.variants, created] } : p);
        this.products.update(list => list.map(p => p.id === productId
          ? { ...p, _count: { variants: p._count.variants + 1 } } : p));
      }
      this.showVariantForm.set(false);
      this.editingVariant.set(null);
    } catch (err: any) {
      this.variantFormError.set(err?.error?.message ?? 'Errore durante il salvataggio');
    } finally {
      this.variantFormLoading.set(false);
    }
  }

  async deleteVariant(variantId: string) {
    const productId = this.editingProduct()?.id;
    if (!productId) return;
    try {
      await firstValueFrom(this.adminSvc.deleteVariant(productId, variantId));
      this.editingProduct.update(p => p ? { ...p, variants: p.variants.filter(v => v.id !== variantId) } : p);
      this.products.update(list => list.map(p => p.id === productId
        ? { ...p, _count: { variants: Math.max(0, p._count.variants - 1) } } : p));
    } catch {
      this.variantFormError.set('Impossibile eliminare la variante');
    }
  }

  // ─── Images ───────────────────────────────────────────────────────────────

  openAddImage() {
    this.imageUrl = '';
    this.imageAlt = '';
    this.imageFile = null;
    this.imageMode = 'upload';
    this.imagePreview.set(null);
    this.imageFormError.set(null);
    this.showImageForm.set(true);
  }

  cancelImageForm() {
    this.showImageForm.set(false);
    this.imagePreview.set(null);
    this.imageFile = null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.imageFormError.set('Solo file immagine sono consentiti (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imageFormError.set('Il file non può superare 5 MB');
      return;
    }
    this.imageFile = file;
    this.imageFormError.set(null);
    const reader = new FileReader();
    reader.onload = (e) => this.imagePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async saveImage() {
    const productId = this.editingProduct()?.id;
    if (!productId || this.imageFormLoading()) return;
    this.imageFormLoading.set(true);
    this.imageFormError.set(null);

    try {
      let created: any;
      if (this.imageMode === 'upload') {
        if (!this.imageFile) { this.imageFormError.set('Seleziona un file'); this.imageFormLoading.set(false); return; }
        created = await firstValueFrom(this.adminSvc.uploadImage(productId, this.imageFile));
      } else {
        if (!this.imageUrl.trim()) { this.imageFormError.set('Inserisci un URL'); this.imageFormLoading.set(false); return; }
        const isFirst = (this.editingProduct()?.images.length ?? 0) === 0;
        created = await firstValueFrom(this.adminSvc.addImage(productId, {
          url: this.imageUrl.trim(),
          altText: this.imageAlt.trim() || undefined,
          isCover: isFirst,
        }));
      }
      this.editingProduct.update(p => p ? { ...p, images: [...p.images, created] } : p);
      this.showImageForm.set(false);
      this.imagePreview.set(null);
      this.imageFile = null;
    } catch (err: any) {
      this.imageFormError.set(err?.error?.message ?? 'Errore durante il salvataggio');
    } finally {
      this.imageFormLoading.set(false);
    }
  }

  async deleteImage(imageId: string) {
    const productId = this.editingProduct()?.id;
    if (!productId) return;
    try {
      await firstValueFrom(this.adminSvc.deleteImage(productId, imageId));
      this.editingProduct.update(p => {
        if (!p) return p;
        const images = p.images.filter(i => i.id !== imageId);
        // If first image exists and none is cover, set it
        if (images.length > 0 && !images.some(i => i.isCover)) {
          images[0] = { ...images[0], isCover: true };
        }
        return { ...p, images };
      });
    } catch {
      this.imageFormError.set('Impossibile eliminare l\'immagine');
    }
  }

  async setCover(imageId: string) {
    const productId = this.editingProduct()?.id;
    if (!productId) return;
    try {
      await firstValueFrom(this.adminSvc.setCoverImage(productId, imageId));
      this.editingProduct.update(p => p ? {
        ...p,
        images: p.images.map(i => ({ ...i, isCover: i.id === imageId })),
      } : p);
    } catch {
      this.imageFormError.set('Impossibile impostare la cover');
    }
  }

  // ─── Delete product ────────────────────────────────────────────────────────

  requestDelete(id: string) { this.confirmDeleteId.set(id); }
  cancelDelete() { this.confirmDeleteId.set(null); }

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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  formatPrice(v: string | number): string {
    return '€ ' + parseFloat(String(v)).toFixed(2).replace('.', ',');
  }

  variantLabel(v: ProductVariant): string {
    const parts = [v.size, v.color, v.material].filter(Boolean);
    return parts.length ? parts.join(' / ') : v.sku;
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
