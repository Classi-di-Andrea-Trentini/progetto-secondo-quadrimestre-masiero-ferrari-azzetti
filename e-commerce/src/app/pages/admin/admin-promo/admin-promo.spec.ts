import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminPromo } from './admin-promo';
import { AdminPromoCode } from '../../../services/admin.service';
import { expectResponsiveCardList } from '../admin-card-list.testing';

describe('AdminPromo', () => {
  let component: AdminPromo;
  let fixture: ComponentFixture<AdminPromo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPromo],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPromo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one card per promo code on the mobile card branch, and the empty state with none', () => {
    const sample: AdminPromoCode[] = [
      {
        id: 'pc1', code: 'WELCOME10', discountType: 'percentage', discountValue: '10',
        minOrderAmount: null, maxUses: null, currentUses: 0, expiresAt: null,
        isActive: true, createdAt: '2026-01-01T00:00:00Z', _count: { uses: 0 },
      },
    ];
    expectResponsiveCardList<AdminPromoCode>({
      fixture,
      setLoading: (v) => component.loading.set(v),
      setItems: (items) => component.promoCodes.set(items),
      sampleItems: sample,
      expectedTextInFirstCard: 'WELCOME10',
      emptyMessage: 'No promo codes found',
    });
  });
});
