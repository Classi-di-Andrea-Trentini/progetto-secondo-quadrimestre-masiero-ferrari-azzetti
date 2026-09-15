import { TestBed } from '@angular/core/testing';
import { CookieConsentService, COOKIE_NOTICE_STORAGE_KEY } from './cookie-consent';

/**
 * L'informativa cookie e' una cosa sola: un avviso che si legge una volta e che si
 * deve poter riaprire. Prima non era ne' l'una ne' l'altra — la scelta era
 * definitiva, e non c'era nessun modo di tornarci.
 */
describe('CookieConsentService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  it('shows the notice to someone who has never seen it', () => {
    const service = TestBed.inject(CookieConsentService);
    expect(service.visible()).toBe(true);
  });

  it('stays quiet once the notice has been acknowledged', () => {
    const service = TestBed.inject(CookieConsentService);
    service.acknowledge();

    expect(service.visible()).toBe(false);
    expect(localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY)).toBeTruthy();

    // Una visita successiva parte da zero: il servizio si ricrea e deve leggere
    // quanto e' stato scritto, altrimenti l'avviso ricompare a ogni pagina.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(CookieConsentService).visible()).toBe(false);
  });

  it('can be reopened from the footer after it was dismissed', () => {
    const service = TestBed.inject(CookieConsentService);
    service.acknowledge();
    expect(service.visible()).toBe(false);

    // "Gestisci cookie" nel footer: senza questo l'informativa era irraggiungibile
    // per sempre, e l'unico modo di rileggerla era svuotare i dati del browser.
    service.reopen();
    expect(service.visible()).toBe(true);
  });

  it('records when the notice was read, not a consent that was never asked', () => {
    const service = TestBed.inject(CookieConsentService);
    service.acknowledge();

    const stored = JSON.parse(localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) ?? '{}');
    // Il negozio usa solo cookie tecnici: non c'e' nessuna preferenza da salvare,
    // solo la data in cui l'avviso e' stato letto. Fingere un consenso che non e'
    // mai stato chiesto sarebbe peggio che non chiederlo.
    expect(stored.acknowledgedAt).toBeTruthy();
    expect(stored.technicalOnly).toBe(true);
  });

  it('survives a browser that refuses storage instead of breaking the page', () => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('storage disabled');
    };
    Storage.prototype.setItem = () => {
      throw new Error('storage disabled');
    };

    try {
      // Navigazione in incognito o cookie di sito bloccati: `localStorage` esiste ma
      // ogni accesso lancia. Senza protezione salta l'intero bootstrap dell'app.
      const service = TestBed.inject(CookieConsentService);
      expect(service.visible()).toBe(true);
      expect(() => service.acknowledge()).not.toThrow();
      expect(service.visible()).toBe(false);
    } finally {
      Storage.prototype.getItem = getItem;
      Storage.prototype.setItem = setItem;
    }
  });
});
