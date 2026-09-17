import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminProducts } from './admin-products';
import { AdminProduct } from '../../../services/admin.service';
import { expectResponsiveCardList } from '../admin-card-list.testing';

describe('AdminProducts', () => {
  let component: AdminProducts;
  let fixture: ComponentFixture<AdminProducts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProducts],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminProducts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // I tre stati del magazzino nel design: Available / Running Out / Out of
  // Stock, in questo ordine di soglia sulla quantita' in stock.
  it('should map stock quantity to the three design stock states', () => {
    expect(component.stockState(0)).toBe('Out of Stock');
    expect(component.stockState(5)).toBe('Running Out');
    expect(component.stockState(6)).toBe('Available');
  });

  it('should render one card per product on the mobile card branch, and the empty state with none', () => {
    const sample: AdminProduct[] = [
      {
        id: 'p1', name: 'T-Shirt Essential', slug: 't-shirt-essential', description: null,
        shortDesc: null, brand: null, basePrice: '45.00', isActive: true, isFeatured: false,
        isNewArrival: false, soldCount: 12, rating: '4.5', createdAt: '2026-01-01T00:00:00Z',
        category: { name: 'Clothing' }, images: [], discounts: [], _count: { variants: 2 },
      },
    ];
    expectResponsiveCardList<AdminProduct>({
      fixture,
      setLoading: (v) => component.loading.set(v),
      setItems: (items) => component.products.set(items),
      sampleItems: sample,
      expectedTextInFirstCard: 'T-Shirt Essential',
      emptyMessage: 'No products found',
    });
  });
});
