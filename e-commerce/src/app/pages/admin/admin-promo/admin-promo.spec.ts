import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPromo } from './admin-promo';

describe('AdminPromo', () => {
  let component: AdminPromo;
  let fixture: ComponentFixture<AdminPromo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPromo]
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
