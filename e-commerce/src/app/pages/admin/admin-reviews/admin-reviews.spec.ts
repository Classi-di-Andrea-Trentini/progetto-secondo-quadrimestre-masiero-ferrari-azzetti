import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminReviews } from './admin-reviews';
import { AdminReview } from '../../../services/admin.service';
import { expectResponsiveCardList } from '../admin-card-list.testing';

// Il file esisteva ma era vuoto: vitest lo contava come suite fallita
// ("No test suite found"), uno dei dieci rossi.
describe('AdminReviews', () => {
  let component: AdminReviews;
  let fixture: ComponentFixture<AdminReviews>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReviews],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReviews);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one card per review on the mobile card branch, and the empty state with none', () => {
    const sample: AdminReview[] = [
      {
        id: 'r1', rating: 4, title: 'Great fit', body: 'Fits true to size.', status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
        user: { fullName: 'Alan Turing', email: 'alan@example.com' },
        product: { name: 'T-Shirt Essential', slug: 't-shirt-essential' },
      },
    ];
    expectResponsiveCardList<AdminReview>({
      fixture,
      setLoading: (v) => component.loading.set(v),
      setItems: (items) => component.reviews.set(items),
      sampleItems: sample,
      expectedTextInFirstCard: 'Alan Turing',
      emptyMessage: 'No reviews found',
    });
  });
});
