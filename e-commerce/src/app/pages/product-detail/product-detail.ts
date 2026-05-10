import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductsService, ProductFull, ProductListItem, ProductImage } from '../../services/products.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth';
import { CartService } from '../../services/cart-service';
import { ReviewsService, Review } from '../../services/reviews.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail implements OnInit {
  private svc = inject(ProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly wishlist = inject(WishlistService);
  readonly auth = inject(AuthService);
  readonly cartSvc = inject(CartService);
  private readonly reviewsSvc = inject(ReviewsService);

  product = signal<ProductFull | null>(null);
  related = signal<ProductListItem[]>([]);

  // ─── Reviews ─────────────────────────────────────────────
  reviews = signal<Review[]>([]);
  reviewsLoading = signal(false);
  reviewsTotal = signal(0);
  reviewsPage = signal(1);
  reviewsTotalPages = signal(1);

  // Write review
  showReviewForm = signal(false);
  reviewRating = signal(5);
  reviewTitle = '';
  reviewBody = '';
  reviewLoading = signal(false);
  reviewError = signal<string | null>(null);
  reviewSuccess = signal<string | null>(null);
  loading = signal(true);
  error = signal('');

  activeImageIndex = signal(0);
  selectedColor = signal('');
  selectedSize = signal('');
  openAccordion = signal<string | null>('details');
  addedToCart = signal(false);

  readonly Math = Math;

  readonly accordionSections = [
    { id: 'details',   label: 'DETAILS' },
    { id: 'sizeguide', label: 'SIZE GUIDE' },
    { id: 'fabric',    label: 'MATERIALS & FABRIC' },
    { id: 'washing',   label: 'CARE INSTRUCTIONS' },
    { id: 'shipping',  label: 'SHIPPING & RETURNS' },
  ];

  readonly accordionContent: Record<string, string> = {
    sizeguide: 'XS: EU 44 / S: EU 46 / M: EU 48 / L: EU 50 / XL: EU 52 / XXL: EU 54\n\nFor in-between sizes, we recommend sizing up. All measurements refer to body size, not garment size.',
    fabric: 'Fabric composition and country of origin are indicated on the inner label. All materials are carefully selected for durability, comfort, and responsible sourcing.',
    washing: 'Hand wash or machine wash at 30°C on a delicate cycle. Do not bleach. Iron on low heat. Do not tumble dry. Dry flat to preserve shape.',
    shipping: 'Standard Shipping (3–5 business days): free on orders over €100, otherwise €4.90.\nExpress Shipping (1–2 business days): €9.90.\nFree returns within 30 days of receipt — item must be unworn with original tags attached.',
  };

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) this.load(slug);
    });
  }

  private load(slug: string) {
    this.loading.set(true);
    this.error.set('');
    this.activeImageIndex.set(0);
    this.selectedColor.set('');
    this.selectedSize.set('');
    this.openAccordion.set('details');
    this.reviews.set([]);
    this.reviewsPage.set(1);

    this.svc.getProductBySlug(slug).subscribe({
      next: res => {
        this.product.set(res.product);
        this.related.set(res.related);
        const firstColor = this.uniqueColors()[0];
        if (firstColor) this.selectedColor.set(firstColor.colorHex!);
        this.loading.set(false);
        this.loadReviews(res.product.id, 1);
      },
      error: () => {
        this.error.set('Product not found.');
        this.loading.set(false);
      },
    });
  }

  loadReviews(productId: string, page: number) {
    this.reviewsLoading.set(true);
    this.reviewsSvc.getByProduct(productId, page).subscribe({
      next: (res) => {
        this.reviews.set(res.data);
        this.reviewsTotal.set(res.meta.total);
        this.reviewsPage.set(res.meta.page);
        this.reviewsTotalPages.set(res.meta.totalPages);
        this.reviewsLoading.set(false);
      },
      error: () => this.reviewsLoading.set(false),
    });
  }

  goToReviewPage(p: number) {
    const product = this.product();
    if (!product) return;
    this.loadReviews(product.id, p);
  }

  toggleReviewForm() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.showReviewForm.update(v => !v);
    this.reviewError.set(null);
  }

  submitReview() {
    const product = this.product();
    if (!product || this.reviewLoading()) return;
    this.reviewLoading.set(true);
    this.reviewError.set(null);
    this.reviewsSvc.create({
      productId: product.id,
      rating: this.reviewRating(),
      title: this.reviewTitle || undefined,
      body: this.reviewBody || undefined,
    }).subscribe({
      next: () => {
        this.reviewLoading.set(false);
        this.reviewSuccess.set('Recensione inviata! È in attesa di approvazione.');
        this.showReviewForm.set(false);
        this.reviewTitle = '';
        this.reviewBody = '';
        this.reviewRating.set(5);
        setTimeout(() => this.reviewSuccess.set(null), 4000);
      },
      error: (err) => {
        this.reviewLoading.set(false);
        this.reviewError.set(err?.error?.message ?? 'Impossibile inviare la recensione');
      },
    });
  }

  starsArray(n: number): number[] {
    return Array.from({ length: Math.min(5, Math.max(0, Math.round(n))) }, (_, i) => i);
  }

  // ─── Computed ────────────────────────────────────────────
  readonly galleryImages = computed<ProductImage[]>(() => {
    const p = this.product();
    if (!p) return [];

    const color = this.selectedColor();
    if (!color) return p.images;

    const variantIds = new Set(
      p.variants
        .filter(v => v.colorHex === color)
        .map(v => v.id)
    );

    const variantImages = p.images.filter(i => i.variantId && variantIds.has(i.variantId));
    if (variantImages.length) return variantImages;

    // Fallback for products with only generic images.
    const genericImages = p.images.filter(i => !i.variantId);
    return genericImages.length ? genericImages : p.images;
  });

  readonly activeImage = computed<ProductImage | null>(() => {
    const imgs = this.galleryImages();
    return imgs[this.activeImageIndex()] ?? imgs[0] ?? null;
  });

  readonly uniqueColors = computed(() => {
    const seen = new Set<string>();
    return (this.product()?.variants ?? [])
      .filter(v => v.colorHex && !seen.has(v.colorHex) && seen.add(v.colorHex));
  });

  readonly availableSizes = computed(() => {
    const color = this.selectedColor();
    const variants = this.product()?.variants ?? [];
    if (!color) {
      const seen = new Set<string>();
      return variants.filter(v => v.size && !seen.has(v.size!) && seen.add(v.size!));
    }
    return variants.filter(v => v.colorHex === color && v.size);
  });

  readonly displayPrice = computed(() => {
    const p = this.product();
    if (!p) return 0;
    const base = parseFloat(String(p.basePrice));
    const d = p.discounts[0];
    if (!d) return base;
    const val = parseFloat(String(d.value));
    if (d.type === 'percentage') return base * (1 - val / 100);
    return base - val;
  });

  readonly selectedVariant = computed(() =>
    this.product()?.variants.find(
      v => v.colorHex === this.selectedColor() && v.size === this.selectedSize()
    ) ?? null
  );

  readonly selectedColorName = computed(() => {
    if (!this.selectedColor()) return 'Select';
    return this.uniqueColors().find(v => v.colorHex === this.selectedColor())?.color ?? '';
  });

  readonly inStock = computed(() => {
    const v = this.selectedVariant();
    return v ? v.stockQty > 0 : true;
  });

  // ─── Helpers ─────────────────────────────────────────────
  formatPrice(v: number | string) {
    return '€ ' + parseFloat(String(v)).toFixed(2).replace('.', ',');
  }

  coverImageOf(p: ProductListItem) {
    return p.images.find(i => i.isCover)?.url ?? p.images[0]?.url ?? '';
  }

  discountedPrice(p: ProductListItem): number | null {
    const d = p.discounts[0];
    if (!d) return null;
    const base = parseFloat(String(p.basePrice));
    const val  = parseFloat(String(d.value));
    if (d.type === 'percentage') return base * (1 - val / 100);
    return base - val;
  }

  discountLabel(p: ProductListItem): string | null {
    const d = p.discounts[0];
    if (!d) return null;
    return d.label ?? (d.type === 'percentage' ? `-${d.value}%` : 'SALE');
  }

  // ─── Actions ─────────────────────────────────────────────
  selectColor(hex: string) {
    this.selectedColor.set(hex);
    this.selectedSize.set('');
    this.activeImageIndex.set(0);
  }

  selectSize(size: string) {
    this.selectedSize.set(this.selectedSize() === size ? '' : size);
  }

  setActiveImage(index: number) {
    this.activeImageIndex.set(index);
  }

  toggleAccordion(id: string) {
    this.openAccordion.set(this.openAccordion() === id ? null : id);
  }

  accordionText(id: string): string {
    if (id === 'details') return this.product()?.description ?? '';
    return this.accordionContent[id] ?? '';
  }

  async toggleWishlist() {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    const pid = this.product()?.id;
    if (pid) await this.wishlist.toggle(pid);
  }

  addToCart() {
    const product = this.product();
    const variant = this.selectedVariant();
    if (!variant || !product) return;

    const basePrice = parseFloat(String(product.basePrice));
    const d = product.discounts[0];
    let unitPrice = basePrice;
    if (d) {
      const val = parseFloat(String(d.value));
      unitPrice = d.type === 'percentage' ? basePrice * (1 - val / 100) : basePrice - val;
    }

    const coverImg = this.galleryImages()[0]?.url ?? product.images[0]?.url ?? '';
    const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ');

    this.cartSvc.addItem({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      slug: product.slug,
      variantLabel,
      size: variant.size ?? null,
      color: variant.color ?? null,
      colorHex: variant.colorHex ?? null,
      imageUrl: coverImg,
      unitPrice: Math.round(unitPrice * 100) / 100,
      originalPrice: basePrice,
      quantity: 1,
    });

    this.addedToCart.set(true);
    this.cartSvc.open();
    setTimeout(() => this.addedToCart.set(false), 2000);
  }
}
