import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Me } from './me';

describe('Me', () => {
  let component: Me;
  let fixture: ComponentFixture<Me>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Me]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Me);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
