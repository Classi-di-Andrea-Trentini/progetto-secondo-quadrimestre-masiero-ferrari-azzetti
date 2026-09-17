import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminReturns } from './admin-returns';
import { AdminReturn } from '../../../services/admin.service';
import { expectResponsiveCardList } from '../admin-card-list.testing';

// Il file non esisteva: la pagina non aveva nessun test, nemmeno "should
// create". Task 7 le ha anche aggiunto per prima volta uno stylesheet
// (styleUrl in admin-returns.ts) per l'anello di focus teal admin.
describe('AdminReturns', () => {
  let component: AdminReturns;
  let fixture: ComponentFixture<AdminReturns>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReturns],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReturns);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one card per return on the mobile card branch, and the empty state with none', () => {
    const sample: AdminReturn[] = [
      {
        id: 'ret1', status: 'requested', reason: 'Wrong size', adminNote: null,
        refundAmount: null, createdAt: '2026-01-01T00:00:00Z', resolvedAt: null,
        order: { id: 'order-0001-abcdef', total: '145.50' },
        user: { fullName: 'Margaret Hamilton', email: 'margaret@example.com' },
        items: [{ id: 'ri1', quantity: 1, orderItem: { productName: 'T-Shirt Essential', unitPrice: '45.00' } }],
      },
    ];
    expectResponsiveCardList<AdminReturn>({
      fixture,
      setLoading: (v) => component.loading.set(v),
      setItems: (items) => component.returns.set(items),
      sampleItems: sample,
      expectedTextInFirstCard: 'Margaret Hamilton',
      emptyMessage: 'No returns found',
    });
  });
});
