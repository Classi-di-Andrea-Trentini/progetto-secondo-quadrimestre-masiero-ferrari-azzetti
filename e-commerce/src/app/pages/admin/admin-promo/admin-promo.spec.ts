import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminPromo } from './admin-promo';

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
});
