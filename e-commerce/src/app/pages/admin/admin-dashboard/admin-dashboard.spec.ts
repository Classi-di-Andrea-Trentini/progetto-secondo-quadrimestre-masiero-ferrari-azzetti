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

  it('resolves each order status to its real CSS token colour for the donut chart, not the fallback', () => {
    // ordersByStatus resta vuoto in baseStats e nell'altro test di questo file
    // apposta (vedi il commento sopra): senza questo test, buildChart() non
    // gira mai con dati veri e un refuso nel nome di una custom property in
    // statusChartVars (admin-dashboard.ts) passerebbe la suite in silenzio.
    // Qui si imposta a mano lo stesso valore che styles.css assegna a ogni
    // token — jsdom non processa i fogli di stile dell'app — cosi' un nome
    // sbagliato fa risolvere il fallback ('transparent') invece del colore
    // vero, e il test fallisce per davvero.
    const root = document.documentElement;
    const tokenValues: Record<string, string> = {
      '--color-warning-wash': 'oklch(0.966 0.03 75)',
      '--color-success-wash': 'oklch(0.965 0.022 155)',
      '--color-sunken': 'oklch(0.966 0.0025 285)',
    };
    Object.entries(tokenValues).forEach(([name, value]) => root.style.setProperty(name, value));

    let capturedConfig: { data: { datasets: { backgroundColor: string[] }[] } } | null = null;
    class FakeChart {
      constructor(_el: unknown, config: typeof capturedConfig) { capturedConfig = config; }
      destroy() {}
    }
    (globalThis as unknown as { Chart: unknown }).Chart = FakeChart;

    try {
      component.loading.set(false);
      component.stats.set({
        ...baseStats,
        ordersByStatus: [
          { status: 'pending', count: 2 },       // --color-warning-wash
          { status: 'delivered', count: 5 },     // --color-success-wash
          { status: 'not-a-real-status', count: 1 }, // fallback: --color-sunken
        ],
      });
      fixture.detectChanges();
      component.buildChart();

      expect(capturedConfig).toBeTruthy();
      const colors = capturedConfig!.data.datasets[0].backgroundColor;
      expect(colors).toEqual([
        tokenValues['--color-warning-wash'],
        tokenValues['--color-success-wash'],
        tokenValues['--color-sunken'],
      ]);
      colors.forEach((c) => expect(c).not.toBe('transparent'));
    } finally {
      delete (globalThis as unknown as { Chart?: unknown }).Chart;
      Object.keys(tokenValues).forEach((name) => root.style.removeProperty(name));
    }
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
