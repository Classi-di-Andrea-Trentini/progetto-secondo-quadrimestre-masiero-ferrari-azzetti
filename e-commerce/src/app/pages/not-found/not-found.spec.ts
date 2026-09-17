import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';

import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';
import { NotFound } from './not-found';

describe('NotFound', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders the 404 page instead of silently redirecting to home', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/indirizzo-che-non-esiste', NotFound);

    expect(component).toBeInstanceOf(NotFound);

    // Il punto della modifica: l'indirizzo sbagliato **resta** sbarrato. Prima il
    // jolly faceva `redirectTo: 'home'` e l'URL diventava /home, quindi chi aveva
    // sbagliato a scrivere non aveva modo di accorgersene.
    expect(TestBed.inject(Router).url).toBe('/indirizzo-che-non-esiste');

    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('404');
    expect(el.textContent).toContain("This page doesn't exist");
    // L'indirizzo richiesto va mostrato: senza, resta il dubbio su dove sia il refuso.
    expect(el.textContent).toContain('/indirizzo-che-non-esiste');
  });

  it('uses the design system buttons and points back at real pages', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/niente', NotFound);
    const el = harness.routeNativeElement as HTMLElement;

    // `.btn` e non bottoni ricostruiti a mano: e' la regola del design system.
    expect(el.querySelector('a.btn.btn-primary')).toBeTruthy();
    expect(el.querySelector('a.btn.btn-outline')).toBeTruthy();

    const targets = [...el.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(targets).toContain('/products');
    expect(targets).toContain('/home');
  });

  it('asks search engines not to index it', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/niente-del-tutto', NotFound);

    // Una 404 indicizzata e' un risultato di ricerca che porta su un errore.
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toContain('noindex');
    expect(TestBed.inject(Title).getTitle()).toContain('Page not found');
  });

  it('does not escape the page as HTML when the URL carries markup', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/%3Cimg%20src=x%20onerror=alert(1)%3E', NotFound);
    const el = harness.routeNativeElement as HTMLElement;

    // L'indirizzo finisce in interpolazione, quindi e' testo: nessun elemento
    // nuovo entra nella pagina perche' qualcuno lo ha scritto nell'URL.
    expect(el.querySelector('img')).toBeNull();
  });

  it('serves the wildcard with a real HTTP 404 status', () => {
    // Senza questo, la pagina d'errore uscirebbe con un 200 e un motore di
    // ricerca terrebbe indicizzato un indirizzo che non esiste. Lo stato si puo'
    // scegliere solo qui: dal componente non si arriva alla risposta.
    const wildcard = serverRoutes.find((route) => route.path === '**');

    expect(wildcard).toBeDefined();
    expect(wildcard?.renderMode).toBe(RenderMode.Server);
    // `status` esiste solo sulle rotte rese dal server: una prerenderizzata non
    // ha una risposta HTTP da marcare, quindi il tipo lo esclude.
    expect(wildcard && 'status' in wildcard ? wildcard.status : undefined).toBe(404);
  });

  it('keeps the wildcard out of the redirect business', () => {
    const wildcard = routes.find((route) => route.path === '**');

    expect(wildcard?.redirectTo).toBeUndefined();
    expect(wildcard?.component).toBe(NotFound);
  });
});
