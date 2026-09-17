import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the shell: nav bar, cart drawer, router outlet and footer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    // Il test controllava `h1` contenesse "Hello, e-commerce": l'asserzione
    // dell'app di esempio di `ng new`, rimasta qui e mai adattata. Non ha mai
    // descritto questa applicazione — App non ha nessun h1.
    expect(el.querySelector('app-nav-bar')).toBeTruthy();
    expect(el.querySelector('app-cart')).toBeTruthy();
    expect(el.querySelector('app-footer')).toBeTruthy();
    expect(el.querySelector('main router-outlet')).toBeTruthy();
  });
});
