import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Home } from './home';
import { API_URL } from '../../services/api.config';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    // AuthService (iniettato dalla home per il bottone "Sign In"/account) prova
    // sempre `/auth/me` alla costruzione: la si smaltisce subito da visitatore
    // anonimo, altrimenti resta una richiesta aperta e http.verify() la trova.
    http.expectOne(`${API_URL}/auth/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the hero copy in english', async () => {
    fixture.detectChanges();
    http.expectOne((req) => req.url === `${API_URL}/products`).flush({
      data: [],
      meta: { total: 0, page: 1, limit: 8, totalPages: 0 },
    });
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Everyday elegance');
    expect(text).toContain('Shop the Collection');
  });

  it('shows the design banners (new collection and sale) in english', async () => {
    fixture.detectChanges();
    http.expectOne((req) => req.url === `${API_URL}/products`).flush({
      data: [],
      meta: { total: 0, page: 1, limit: 8, totalPages: 0 },
    });
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Copy letterale dei blocchi CollectionBanner e SaleBanner del design (design-code.txt).
    expect(text).toContain('A modern vision of everyday style.');
    expect(text).toContain('Discover More');
    expect(text).toContain('For a limited time only.');
    expect(text).toContain('Shop the Sale');
  });

  it('shows the featured products, in english, once the backend answers', async () => {
    fixture.detectChanges();

    http.expectOne((req) => req.url === `${API_URL}/products`).flush({
      data: [
        {
          id: 'p1',
          name: 'Wool Overcoat',
          slug: 'wool-overcoat',
          shortDesc: null,
          brand: null,
          basePrice: 120,
          isNewArrival: true,
          isFeatured: true,
          avgRating: null,
          soldCount: 0,
          category: { id: 'c1', name: 'Outerwear', slug: 'outerwear' },
          images: [
            { id: 'i1', variantId: null, url: '/media/test.svg', altText: null, isCover: true, sortOrder: 0 },
          ],
          variants: [],
          discounts: [],
        },
      ],
      meta: { total: 1, page: 1, limit: 8, totalPages: 1 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Featured Products');
    expect(text).toContain('Wool Overcoat');
  });

  it('moves the fan carousel with the Previous/Next buttons, in english and reachable from real buttons', async () => {
    fixture.detectChanges();
    http.expectOne((req) => req.url === `${API_URL}/products`).flush({
      data: [],
      meta: { total: 0, page: 1, limit: 8, totalPages: 0 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Outerwear');

    const buttons = Array.from(el.querySelectorAll('button.fan-nav-btn')) as HTMLButtonElement[];
    const next = buttons.find((b) => b.getAttribute('aria-label') === 'Next slide');
    const prev = buttons.find((b) => b.getAttribute('aria-label') === 'Previous slide');
    expect(next).toBeTruthy();
    expect(prev).toBeTruthy();

    expect(component.activeSlide()).toBe(0);
    next!.click();
    fixture.detectChanges();
    expect(component.activeSlide()).toBe(1);
    expect(el.textContent).toContain('Minimal Wardrobe');

    prev!.click();
    fixture.detectChanges();
    expect(component.activeSlide()).toBe(0);
  });
});
