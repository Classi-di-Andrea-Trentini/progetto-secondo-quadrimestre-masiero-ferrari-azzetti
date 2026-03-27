import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductsService, ProductListItem, ProductFilters, GetProductsParams } from '../../services/products.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class Products implements OnInit {
  private svc = inject(ProductsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly wishlist = inject(WishlistService);
  readonly auth = inject(AuthService);

  products = signal<ProductListItem[]>([]);
  filters = signal<ProductFilters | null>(null);
  loading = signal(true);
  totalProducts = signal(0);
  totalPages = signal(1);
  hoveredId = signal<string | null>(null);
  filtersOpen = signal(false);
  // Colore selezionato per card (productId → colorHex)
  selectedCardColor = signal<Map<string, string>>(new Map());

  // Filter state
  selectedCategory = signal('');
  selectedColors = signal<string[]>([]);
  selectedSizes = signal<string[]>([]);
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  sortBy = signal('newest');
  currentPage = signal(1);
  searchQuery = signal('');

  readonly sortOptions = [
    { value: 'newest',     label: 'Newest' },
    { value: 'popular',    label: 'Best Sellers' },
    { value: 'rating',     label: 'Top Rated' },
    { value: 'price_asc',  label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
  ];

  ngOnInit() {
    this.svc.getFilters().subscribe(f => this.filters.set(f));
    if (this.auth.isAuthenticated()) this.wishlist.loadIds();

    // Read query params
    this.route.queryParams.subscribe(params => {
      if (params['category']) this.selectedCategory.set(params['category']);
      this.loadProducts();
    });
  }

  loadProducts() {
    this.loading.set(true);
    const params: GetProductsParams = {
      page: this.currentPage(),
      limit: 24,
      sortBy: this.sortBy(),
    };
    if (this.selectedCategory()) params.categoryId = this.selectedCategory();
    if (this.selectedColors().length) params.colors = this.selectedColors();
    if (this.selectedSizes().length)  params.sizes  = this.selectedSizes();
    if (this.minPrice() !== null)     params.minPrice = this.minPrice()!;
    if (this.maxPrice() !== null)     params.maxPrice = this.maxPrice()!;
    if (this.searchQuery())           params.search = this.searchQuery();

    this.svc.getProducts(params).subscribe({
      next: res => {
        this.products.set(res.data);
        this.totalProducts.set(res.meta.total);
        this.totalPages.set(res.meta.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ─── Computed ────────────────────────────────────────────
  readonly rootCategories = computed(() =>
    this.filters()?.categories.filter(c => !c.parentId) ?? []
  );

  readonly subCategories = computed(() => {
    const all = this.filters()?.categories ?? [];
    const sel = this.selectedCategory();
    if (!sel) return [];
    return all.filter(c => c.parentId === sel);
  });

  readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (this.selectedCategory()) n++;
    if (this.selectedColors().length) n++;
    if (this.selectedSizes().length) n++;
    if (this.minPrice() !== null || this.maxPrice() !== null) n++;
    return n;
  });

  // ─── Product helpers ─────────────────────────────────────
  coverImage(p: ProductListItem) {
    return p.images.find(i => i.isCover)?.url ?? p.images[0]?.url ?? '';
  }

  hoverImage(p: ProductListItem) {
    const nonCover = p.images.find(i => !i.isCover);
    return nonCover?.url ?? this.coverImage(p);
  }

  hasHoverImage(p: ProductListItem) {
    return p.images.length >= 2;
  }

  discountedPrice(p: ProductListItem): number | null {
    const d = p.discounts[0];
    if (!d) return null;
    const base = parseFloat(String(p.basePrice));
    const val  = parseFloat(String(d.value));
    if (d.type === 'percentage') return base * (1 - val / 100);
    if (d.type === 'fixed_amount') return base - val;
    return null;
  }

  discountLabel(p: ProductListItem): string | null {
    const d = p.discounts[0];
    if (!d) return null;
    return d.label ?? (d.type === 'percentage' ? `-${d.value}%` : 'SALE');
  }

  formatPrice(v: number | string) {
    return '€ ' + parseFloat(String(v)).toFixed(2).replace('.', ',');
  }

  uniqueColors(p: ProductListItem) {
    const seen = new Set<string>();
    return p.variants.filter(v => v.colorHex && !seen.has(v.colorHex) && seen.add(v.colorHex));
  }

  // ─── Filter actions ──────────────────────────────────────
  setCategory(id: string) {
    this.selectedCategory.set(this.selectedCategory() === id ? '' : id);
    this.currentPage.set(1);
    this.loadProducts();
  }

  toggleColor(hex: string) {
    const cur = this.selectedColors();
    this.selectedColors.set(cur.includes(hex) ? cur.filter(c => c !== hex) : [...cur, hex]);
    this.currentPage.set(1);
    this.loadProducts();
  }

  toggleSize(size: string) {
    const cur = this.selectedSizes();
    this.selectedSizes.set(cur.includes(size) ? cur.filter(s => s !== size) : [...cur, size]);
    this.currentPage.set(1);
    this.loadProducts();
  }

  applyPriceFilter() {
    this.currentPage.set(1);
    this.loadProducts();
  }

  setSortBy(val: string) {
    this.sortBy.set(val);
    this.currentPage.set(1);
    this.loadProducts();
  }

  clearFilters() {
    this.selectedCategory.set('');
    this.selectedColors.set([]);
    this.selectedSizes.set([]);
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.currentPage.set(1);
    this.loadProducts();
  }

  goToPage(p: number) {
    this.currentPage.set(p);
    this.loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pages() {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  selectCardColor(event: Event, productId: string, hex: string) {
    event.preventDefault();
    event.stopPropagation();
    const map = new Map(this.selectedCardColor());
    if (map.get(productId) === hex) {
      map.delete(productId); // deselect
    } else {
      map.set(productId, hex);
    }
    this.selectedCardColor.set(map);
  }

  cardColor(productId: string): string {
    return this.selectedCardColor().get(productId) ?? '';
  }

  isColorSelected(productId: string, hex: string): boolean {
    return this.selectedCardColor().get(productId) === hex;
  }

  async toggleWishlist(event: Event, productId: string) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    await this.wishlist.toggle(productId);
  }
}
