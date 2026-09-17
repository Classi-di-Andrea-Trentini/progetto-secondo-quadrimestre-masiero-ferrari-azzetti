import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminDashboard } from './admin-dashboard';
import { AdminOrderSummary, AdminStats } from '../../../services/admin.service';
import { expectResponsiveCardList } from '../admin-card-list.testing';

// Stats "vuote" salvo recentOrders: gli altri riquadri (fatturato, prodotti
// piu' venduti, ordini per stato) non sono quello che questo test copre, e un
// array vuoto li tiene innocui — @for su topProducts/ordersByStatus non itera.
const baseStats: AdminStats = {
  totalUsers: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalRevenue: 0,
  pendingOrders: 0,
  recentOrders: [],
  topProducts: [],
  ordersByStatus: [],
};

describe('AdminDashboard', () => {
  let component: AdminDashboard;
  let fixture: ComponentFixture<AdminDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one card per recent order on the mobile card branch, and the empty state with none', () => {
    const sample: AdminOrderSummary[] = [
      {
        id: 'order-0002-abcdef', status: 'paid', total: '89.90', createdAt: '2026-02-01T00:00:00Z',
        user: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
        items: [{ productName: 'Wool Coat', quantity: 1, lineTotal: '89.90' }],
      },
    ];
    expectResponsiveCardList<AdminOrderSummary>({
      fixture,
      setLoading: (v) => component.loading.set(v),
      setItems: (items) => component.stats.set({ ...baseStats, recentOrders: items }),
      sampleItems: sample,
      expectedTextInFirstCard: 'Ada Lovelace',
      emptyMessage: 'No recent orders',
    });
  });
});
