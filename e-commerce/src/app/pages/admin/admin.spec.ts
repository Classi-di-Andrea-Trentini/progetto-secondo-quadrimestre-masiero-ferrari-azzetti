import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Admin } from './admin';

describe('Admin', () => {
  let component: Admin;
  let fixture: ComponentFixture<Admin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Admin],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Admin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Sotto `lg` la sidebar e' un drawer fuori schermo: questo e' il toggle che
  // lo apre/chiude, l'unico comportamento nuovo introdotto per il telefono.
  it('should toggle the mobile drawer open and closed', () => {
    expect(component.mobileOpen()).toBe(false);
    component.toggleMobileNav();
    expect(component.mobileOpen()).toBe(true);
    component.closeMobileNav();
    expect(component.mobileOpen()).toBe(false);
  });

  it('should list the seven panel sections in the design order, Returns and Reviews included', () => {
    expect(component.navItems.map(i => i.label)).toEqual([
      'Dashboard', 'Users', 'Orders', 'Products', 'Promotions', 'Returns', 'Reviews',
    ]);
  });
});
