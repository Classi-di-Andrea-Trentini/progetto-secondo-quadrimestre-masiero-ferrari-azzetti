import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeComponent } from './me';

describe('Me', () => {
  let component: MeComponent;
  let fixture: ComponentFixture<MeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
