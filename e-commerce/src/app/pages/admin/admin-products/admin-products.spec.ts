import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminProducts } from './admin-products';

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
});
