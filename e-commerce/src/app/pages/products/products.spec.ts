import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Products } from './products';
import { API_URL } from '../../services/api.config';
import { ProductListItem } from '../../services/products.service';

function product(overrides: Partial<ProductListItem>): ProductListItem {
  return {
    id: 'p1',
    name: 'Wool Overcoat',
    slug: 'wool-overcoat',
    shortDesc: null,
    brand: null,
    basePrice: 100,
    isNewArrival: false,
    isFeatured: false,
    avgRating: null,
    soldCount: 0,
    category: { id: 'c1', name: 'Outerwear', slug: 'outerwear' },
    images: [{ id: 'i1', variantId: null, url: '/media/test.svg', altText: null, isCover: true, sortOrder: 0 }],
    variants: [],
    discounts: [],
    ...overrides,
  };
}

describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Products],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Products);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats prices in english (€120.00), not italian (€ 120,00)', () => {
    expect(component.formatPrice(120)).toBe('€120.00');
    expect(component.formatPrice('45.5')).toBe('€45.50');
  });

  it('shows the SALE badge on a discounted product card, and not on a full price one', async () => {
    fixture.detectChanges();

    // AuthService (iniettata dalla pagina per la wishlist) prova sempre `/auth/me`
    // alla costruzione: la si smaltisce da visitatore anonimo, come in home.spec.ts.
    http.expectOne(`${API_URL}/auth/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API_URL}/products/filters`).flush({
      categories: [], colors: [], sizes: [], priceRange: { min: 0, max: 0 },
    });
    http.expectOne((req) => req.url === `${API_URL}/products`).flush({
      data: [
        product({ id: 'sale', slug: 'sale-item', name: 'Discounted Jacket', discounts: [{ type: 'percentage', value: 20, label: null }] }),
        product({ id: 'full', slug: 'full-item', name: 'Full Price Jacket' }),
      ],
      meta: { total: 2, page: 1, limit: 24, totalPages: 1 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.product-card');
    expect(cards.length).toBe(2);

    const saleCard = Array.from(cards).find((c) => c.textContent?.includes('Discounted Jacket'))!;
    const fullCard = Array.from(cards).find((c) => c.textContent?.includes('Full Price Jacket'))!;

    const saleBadge = saleCard.querySelector('.badge-pill.sale');
    expect(saleBadge).toBeTruthy();
    expect(saleBadge!.textContent?.trim()).toBe('Sale');

    expect(fullCard.querySelector('.badge-pill.sale')).toBeNull();
  });
});
