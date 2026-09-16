import { Component, OnDestroy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductsService, ProductFull, ProductListItem, ProductImage } from '../../services/products.service';
import { BreadcrumbComponent, BreadcrumbItem } from '../../components/breadcrumb/breadcrumb';
import { WishlistService } from '../../services/wishlist.service';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../services/api.config';
import { DOCUMENT } from '@angular/core';
import { SeoService } from '../../services/seo';
import { ToastService } from '../../services/toast.service';
import { RecentlyViewedService } from '../../services/recently-viewed';
import { AuthService } from '../../services/auth';
import { CartService } from '../../services/cart-service';
import { ReviewsService, Review } from '../../services/reviews.service';
import { ProductImageComponent } from '../../components/product-image/product-image';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BreadcrumbComponent, ProductImageComponent],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail implements OnInit, OnDestroy {
  private svc = inject(ProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly wishlist = inject(WishlistService);
  readonly auth = inject(AuthService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  private seo = inject(SeoService);
  private document = inject(DOCUMENT);
  readonly recent = inject(RecentlyViewedService);
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
  addedToCart = signal(false);

  readonly Math = Math;

  // Copy in inglese come il resto del sito. Le etichette sono quelle del design
  // (f33fcdda.jpg): DETAILS / SIZE GUIDE / FABRIC / WASHING INSTRUCTIONS /
  // SHIPPING & RETURNS \u2014 il testo transforma in maiuscolo via CSS
  // (.accordion-head { text-transform: uppercase }), qui restano in "title case".
  // Gli accordion sono <details>/<summary> nativi (vedi product-detail.html): lo
  // stato aperto/chiuso lo tiene il browser, non serve piu' un signal qui.
  readonly accordionSections = [
    { id: 'details',   label: 'Details' },
    { id: 'sizeguide', label: 'Size Guide' },
    { id: 'fabric',    label: 'Fabric' },
    { id: 'washing',   label: 'Washing Instructions' },
    { id: 'shipping',  label: 'Shipping & Returns' },
  ];

  // Testo dei corpi degli accordion: non e' nel file Figma (design-strings.txt
  // non contiene questo paragrafo, solo le etichette dei titoli), quindi e'
  // copy scritto per coerenza col resto del sito, non tradotto da un originale.
  readonly accordionContent: Record<string, string> = {
    sizeguide: 'XS / S / M / L / XL / XXL \u2014 true to standard EU sizing.\n\nIf you are between sizes, we recommend sizing up. Measurements refer to the body, not the garment.',
    fabric: 'Composition and country of origin are printed on the inside label. Materials are chosen for durability, comfort and responsible sourcing.',
    washing: 'Machine or hand wash cold (max 30\u00b0C) on a gentle cycle. Do not bleach. Iron on low heat. Do not tumble dry. Dry flat to keep the garment\u2019s shape.',
    shipping: 'Standard shipping (3\u20135 business days): free over \u20ac100, otherwise \u20ac4.90.\nExpress shipping (1\u20132 business days): \u20ac9.90.\nFree returns within 30 days of delivery \u2014 the item must be unworn and still have its tag.',
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
        // Prima si carica la lista dei visti (escludendo questo), poi si registra la
        // visita: al contrario il prodotto aperto comparirebbe fra i "visti prima".
        void this.recent.load(res.product.id).then(() => this.recent.remember(res.product.id));
        this.publishSeo(res.product);
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
        this.reviewSuccess.set('Review submitted! It is pending approval.');
        this.showReviewForm.set(false);
        this.reviewTitle = '';
        this.reviewBody = '';
        this.reviewRating.set(5);
        setTimeout(() => this.reviewSuccess.set(null), 4000);
      },
      error: (err) => {
        this.reviewLoading.set(false);
        this.reviewError.set(err?.error?.message ?? 'Unable to submit the review');
      },
    });
  }

  starsArray(n: number): number[] {
    return Array.from({ length: Math.min(5, Math.max(0, Math.round(n))) }, (_, i) => i);
  }

  // ─── Computed ────────────────────────────────────────────
  readonly breadcrumbItems = (): BreadcrumbItem[] => {
    const p = this.product();
    return [
      { label: 'Home', link: '/home' },
      { label: 'Products', link: '/products' },
      { label: p ? p.name : '' },
    ];
  };

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

  /**
   * Titolo, meta e dati strutturati della scheda. Si chiama a prodotto caricato:
   * col rendering lato server finiscono nell'HTML che ricevono i motori di ricerca
   * e le anteprime dei link.
   */
  private publishSeo(product: any): void {
    const variants = product.variants ?? [];
    const cheapest = variants.reduce(
      (min: number, v: any) =>
        Math.min(min, parseFloat(String(v.priceOverride ?? product.basePrice))),
      parseFloat(String(product.basePrice)),
    );

    this.seo.setProduct({
      name: product.name,
      description: product.shortDesc ?? product.description ?? null,
      image: product.images?.[0]?.url ?? null,
      brand: product.brand ?? null,
      sku: variants[0]?.sku ?? null,
      price: cheapest,
      currency: 'EUR',
      inStock: variants.some((v: any) => v.stockQty > 0),
      url: `${this.document.location?.origin ?? ''}/product/${product.slug}`,
      rating: product.avgRating
        ? { value: parseFloat(String(product.avgRating)), count: this.reviewsTotal() }
        : null,
    });
  }

  ngOnDestroy(): void {
    // Senza, il blocco resterebbe attaccato anche navigando su pagine che non sono
    // schede prodotto.
    this.seo.clearJsonLd();
  }

  // ─── Avviso "torna disponibile" ──────────────────────────

  readonly alertSubscribed = signal(false);
  readonly alertBusy = signal(false);

  /**
   * Si puo' chiedere l'avviso solo su una variante scelta ed esaurita: senza taglia
   * selezionata non si saprebbe di cosa avvisare, e su una disponibile non serve.
   */
  readonly canRequestAlert = computed(
    () => Boolean(this.selectedVariant()) && !this.inStock() && this.auth.isAuthenticated(),
  );

  async toggleStockAlert(): Promise<void> {
    const variant = this.selectedVariant();
    if (!variant) return;

    this.alertBusy.set(true);
    try {
      const subscribed = this.alertSubscribed();
      await firstValueFrom(
        subscribed
          ? this.http.request('delete', `${API_URL}/stock-alerts`, {
              body: { variantId: variant.id },
              withCredentials: true,
            })
          : this.http.post(`${API_URL}/stock-alerts`, { variantId: variant.id }, { withCredentials: true }),
      );
      this.alertSubscribed.set(!subscribed);
      this.toast.success(
        subscribed ? 'Alert cancelled.' : 'We will notify you when it is back in stock.',
      );
    } catch (err: any) {
      this.toast.error(err?.error?.message ?? 'We could not save your alert.');
    } finally {
      this.alertBusy.set(false);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────
  // Formato inglese (€120.00, niente spazio dopo il simbolo): la pagina e'
  // tutta in inglese, la virgola decimale italiana stonava. Non e' l'unica
  // formatPrice del progetto — vedi la nota nel report del task 4.
  formatPrice(v: number | string) {
    return new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(parseFloat(String(v)));
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

    // `addItem` ora puo' fallire: con il carrello sul server la disponibilita' la
    // decide il magazzino, non il browser. Prima era sincrono e non poteva
    // sbagliare, quindi senza questo `catch` un "esaurito" sarebbe finito in una
    // promise rifiutata e l'utente avrebbe visto la conferma di aggiunta.
    this.cartSvc
      .addItem({
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
      })
      .then(() => {
        this.addedToCart.set(true);
        this.cartSvc.open();
        setTimeout(() => this.addedToCart.set(false), 2000);
      })
      .catch((err) => {
        this.toast.error(err?.error?.message ?? 'Unable to add the product to the cart.');
      });
  }
}
