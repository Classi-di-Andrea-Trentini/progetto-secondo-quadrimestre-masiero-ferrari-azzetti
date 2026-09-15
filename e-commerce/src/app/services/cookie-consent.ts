import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Stessa chiave di prima: chi aveva gia' chiuso il banner non se lo rivede. */
export const COOKIE_NOTICE_STORAGE_KEY = 'common_era_cookie_consent';

/** Quello che finisce in `localStorage`: una data di lettura, non una preferenza. */
export interface CookieNoticeRecord {
  /** Il negozio usa solo cookie tecnici, quindi non c'e' niente da attivare o spegnere. */
  technicalOnly: true;
  acknowledgedAt: string;
}

/**
 * L'informativa cookie.
 *
 * <h2>Perche' non e' un banner di consenso</h2>
 *
 * Common Era usa **solo cookie tecnici**: il cookie di sessione che tiene collegato
 * chi ha fatto il login, la riga che ricorda che questo avviso e' stato letto, e i
 * cookie di Stripe che servono a far funzionare il pagamento e a riconoscere le
 * frodi. Nessun cookie analitico, nessun cookie di profilazione, nessuna terza parte
 * pubblicitaria.
 *
 * Per i cookie tecnici la direttiva ePrivacy (art. 5 § 3, e l'art. 122 del Codice
 * privacy italiano) **non chiede il consenso**: chiede di informare. Quindi qui non
 * si chiede un permesso, si da' una notizia — e per questo non c'e' nessun pulsante
 * "Rifiuta".
 *
 * Il "Rifiuta" che c'era prima era peggio della sua assenza: {@code decline()} e
 * {@code acceptAll()} scrivevano **la stessa identica cosa** in `localStorage`
 * ({@code essential: true}), cambiava solo un flag che nessuno leggeva. Un rifiuto
 * che non rifiuta niente e' una bugia scritta in un'interfaccia.
 *
 * Il giorno in cui entrasse un cookie non tecnico — analytics, un pixel — questo
 * servizio va rifatto come vero consenso: due pulsanti che fanno due cose diverse,
 * granularita' per categoria, e il banner che ricompare per raccogliere una scelta
 * nuova.
 *
 * <h2>Perche' un servizio e non un campo del componente</h2>
 *
 * L'avviso lo disegna {@code App}, ma a riaprirlo e' il link "Gestisci cookie" nel
 * footer, che e' un altro componente: lo stato deve stare in un posto che vedono
 * entrambi.
 */
@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _visible = signal(false);

  /** Se l'informativa e' a schermo adesso. */
  readonly visible = this._visible.asReadonly();

  constructor() {
    // Sul server non c'e' nessun `localStorage` e nessuno da informare: l'avviso
    // compare dopo l'idratazione, non nell'HTML reso dal server.
    if (isPlatformBrowser(this.platformId)) {
      this._visible.set(this.read() === null);
    }
  }

  /** "Ho capito": si segna la data di lettura e l'avviso si chiude. */
  acknowledge(): void {
    this.write({ technicalOnly: true, acknowledgedAt: new Date().toISOString() });
    this._visible.set(false);
  }

  /** "Gestisci cookie" nel footer: l'informativa torna a schermo. */
  reopen(): void {
    this._visible.set(true);
  }

  /** Quando l'avviso e' stato letto, o `null` se non lo e' mai stato. */
  acknowledgedAt(): string | null {
    return this.read()?.acknowledgedAt ?? null;
  }

  // ─── localStorage, che puo' sempre non esserci ────────────────────────────
  //
  // In incognito, con i dati del sito bloccati, o durante la cattura di
  // un'anteprima, `localStorage` esiste ma ogni accesso lancia: senza try/catch
  // un'informativa cookie farebbe saltare l'avvio dell'intera applicazione.

  private read(): CookieNoticeRecord | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CookieNoticeRecord) : null;
    } catch {
      return null;
    }
  }

  private write(record: CookieNoticeRecord): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Niente da fare: l'avviso si richiudera' comunque per questa visita, e
      // tornera' alla prossima. Meglio di una pagina bianca.
    }
  }
}
