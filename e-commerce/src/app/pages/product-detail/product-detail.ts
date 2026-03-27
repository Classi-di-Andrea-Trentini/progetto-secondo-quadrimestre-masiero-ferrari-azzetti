import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ProductsService, ProductFull, ProductListItem, ProductImage } from '../../services/products.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth';
import { CartService } from '../../services/cart-service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail implements OnInit {
  private svc = inject(ProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly wishlist = inject(WishlistService);
  readonly auth = inject(AuthService);
  readonly cartService = inject(CartService);

  product = signal<ProductFull | null>(null);
  related = signal<ProductListItem[]>([]);
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

    this.svc.getProductBySlug(slug).subscribe({
      next: res => {
        this.product.set(res.product);
        this.related.set(res.related);
        const firstColor = this.uniqueColors()[0];
        if (firstColor) this.selectedColor.set(firstColor.colorHex!);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Product not found.');
        this.loading.set(false);
      },
    });
  }

  // ─── Computed ────────────────────────────────────────────
  readonly activeImage = computed<ProductImage | null>(() => {
    const imgs = this.product()?.images ?? [];
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
    const p = this.product();
    if (!p || !this.selectedSize()) return;

    const variant = this.selectedVariant();
    const colorName = this.selectedColorName();
    const coverImg = p.images.find(i => i.isCover)?.url ?? p.images[0]?.url ?? '';

    this.cartService.addItem({
      productId: p.id,
      variantId: variant?.id ?? null,
      name: p.name,
      slug: p.slug,
      image: coverImg,
      price: this.displayPrice(),
      color: colorName || null,
      colorHex: this.selectedColor() || null,
      size: this.selectedSize(),
    });

    this.addedToCart.set(true);
    setTimeout(() => this.addedToCart.set(false), 2000);
  }
}
