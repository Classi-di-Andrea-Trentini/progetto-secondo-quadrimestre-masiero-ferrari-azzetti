import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, map } from 'rxjs';
import { convertToParamMap } from '@angular/router';

import { Legal, LEGAL_KEYS, asLegalKey } from './legal';

/** Un `paramMap` pilotabile dal test, per cambiare pagina senza un router vero. */
function routeWith(pagina: string | null) {
  const subject = new BehaviorSubject<string | null>(pagina);
  return {
    provider: {
      provide: ActivatedRoute,
      useValue: {
        paramMap: subject.pipe(map((p) => convertToParamMap(p === null ? {} : { pagina: p }))),
      },
    },
    go: (next: string | null) => subject.next(next),
  };
}

describe('Legal', () => {
  async function render(pagina: string | null) {
    const route = routeWith(pagina);
    await TestBed.configureTestingModule({
      imports: [Legal],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        route.provider,
      ],
    }).compileComponents();

    const fixture: ComponentFixture<Legal> = TestBed.createComponent(Legal);
    await fixture.whenStable();
    return { fixture, route, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => TestBed.resetTestingModule());

  // ─── La chiave sconosciuta ──────────────────────────────────────────────

  it('refuses an unknown key instead of quietly serving the privacy page', () => {
    // Il comportamento vecchio: `asLegalKey` restituiva 'privacy' per qualunque
    // stringa. `/legal/qualsiasi-cosa` mostrava l'informativa privacy con uno
    // stato 200 — contenuto duplicato per i motori di ricerca, e una persona
    // davanti a un documento che non aveva chiesto.
    expect(asLegalKey('non-esiste')).toBeNull();
    expect(asLegalKey('')).toBeNull();
    expect(asLegalKey(null)).toBeNull();
    expect(asLegalKey('PRIVACY')).toBeNull();
  });

  it('accepts every key the application actually publishes', () => {
    for (const key of LEGAL_KEYS) {
      expect(asLegalKey(key)).toBe(key);
    }
  });

  it('shows the not-found view for an unknown page', async () => {
    const { el } = await render('pagina-inventata');

    expect(el.querySelector('.legal-missing')).toBeTruthy();
    expect(el.textContent).toContain('404');
    // E soprattutto: nessuna traccia del documento su cui si ricadeva prima.
    expect(el.textContent).not.toContain('Informativa sulla privacy');
  });

  it('goes back to a real document when the key becomes valid again', async () => {
    const { fixture, route, el } = await render('non-esiste');
    expect(el.querySelector('.legal-missing')).toBeTruthy();

    route.go('privacy');
    await fixture.whenStable();

    expect(el.querySelector('.legal-missing')).toBeNull();
    expect(el.textContent).toContain('Informativa sulla privacy');
  });

  // ─── Il contenuto ───────────────────────────────────────────────────────

  it('publishes all five documents, the two new ones included', async () => {
    const { fixture } = await render('privacy');
    const docs = fixture.componentInstance.docs;

    // `recesso` e `spedizioni-e-resi` sono obbligatorie per vendere online in UE
    // e semplicemente non esistevano.
    expect(Object.keys(docs).sort()).toEqual([...LEGAL_KEYS].sort());
    for (const key of LEGAL_KEYS) {
      expect(docs[key].sections.length).toBeGreaterThan(0);
      expect(docs[key].title.length).toBeGreaterThan(0);
    }
  });

  it('never claims to be a school demo and never invents company details', async () => {
    const { fixture } = await render('privacy');
    const everything = JSON.stringify(fixture.componentInstance.docs);

    // Il testo vecchio diceva "this website is a school demo project" e
    // "non-commercial school demo": in un negozio che incassa davvero, dichiarare
    // di non vendere e' una dichiarazione falsa verso il cliente.
    expect(everything.toLowerCase()).not.toContain('school demo');
    expect(everything.toLowerCase()).not.toContain('progetto scolastico');

    // I dati aziendali restano segnaposto finche' non c'e' un'azienda vera: una
    // partita IVA inventata sarebbe peggio di un buco evidente.
    for (const placeholder of ['[RAGIONE SOCIALE]', '[P.IVA]', '[SEDE LEGALE]', '[PEC]', '[REA]']) {
      expect(everything).toContain(placeholder);
    }
  });

  it('covers the points a privacy notice is required to cover', async () => {
    const { fixture } = await render('privacy');
    const privacy = JSON.stringify(fixture.componentInstance.docs.privacy).toLowerCase();

    // Gli elementi degli artt. 13-14 GDPR, piu' il reclamo all'autorita'.
    for (const required of [
      'titolare del trattamento',
      'base giuridica',
      'destinatari',
      'conserviamo',
      'portabilità',
      'garante per la protezione dei dati personali',
    ]) {
      expect(privacy).toContain(required);
    }
  });

  it('lists the Stripe cookies alongside the first-party ones', async () => {
    const { el, fixture } = await render('cookies');
    const rows = fixture.componentInstance.docs.cookies.sections.flatMap((s) => s.cookies ?? []);
    const names = rows.map((c) => c.name);

    expect(names).toContain('__stripe_mid');
    expect(names).toContain('__stripe_sid');
    expect(names).toContain('access_token');
    // Ogni riga della tabella dice quanto dura: senza, la tabella non informa.
    for (const row of rows) expect(row.duration.length).toBeGreaterThan(0);

    expect(el.querySelector('.cookie-table')).toBeTruthy();
  });

  it('states the shipping prices the checkout actually charges', async () => {
    const { fixture } = await render('spedizioni-e-resi');
    const page = JSON.stringify(fixture.componentInstance.docs['spedizioni-e-resi']);

    // Le cifre vengono da CheckoutService: una pagina che dichiara un prezzo di
    // spedizione diverso da quello addebitato e' pubblicita' ingannevole.
    expect(page).toContain('4,90');
    expect(page).toContain('9,90');
    expect(page).toContain('100');
  });

  it('gives the withdrawal page its 14 days and the model form', async () => {
    const { fixture } = await render('recesso');
    const recesso = JSON.stringify(fixture.componentInstance.docs.recesso).toLowerCase();

    expect(recesso).toContain('quattordici giorni');
    // Il modulo tipo dell'allegato I parte B del Codice del consumo.
    expect(recesso).toContain('modulo tipo');
    expect(recesso).toContain('cancellare la dicitura inutile');
  });
});
