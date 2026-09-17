import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminOrders } from './admin-orders';
import { AdminOrderSummary } from '../../../services/admin.service';
import { expectResponsiveCardList } from '../admin-card-list.testing';

describe('AdminOrders', () => {
  let component: AdminOrders;
  let fixture: ComponentFixture<AdminOrders>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrders],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOrders);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one card per order on the mobile card branch, and the empty state with none', () => {
    const sample: AdminOrderSummary[] = [
      {
        id: 'order-0001-abcdef', status: 'pending', total: '145.50', createdAt: '2026-01-01T00:00:00Z',
        user: { fullName: 'Grace Hopper', email: 'grace@example.com' },
        items: [{ productName: 'T-Shirt Essential', quantity: 1, lineTotal: '45.00' }],
      },
    ];
    expectResponsiveCardList<AdminOrderSummary>({
      fixture,
      setLoading: (v) => component.loading.set(v),
      setItems: (items) => component.orders.set(items),
      sampleItems: sample,
      expectedTextInFirstCard: 'Grace Hopper',
      emptyMessage: 'No orders found',
    });
  });
});
