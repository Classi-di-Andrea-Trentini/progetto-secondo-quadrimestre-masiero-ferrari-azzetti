import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';

/** Cio' che il backend dichiara di se' senza che nessuno abbia fatto l'accesso. */
export interface PublicConfig {
  /** Vero solo se il server ha davvero le credenziali di Google. */
  googleAuthEnabled: boolean;
  /** Indirizzo assoluto da cui parte il giro OAuth, `null` quando e' spento. */
  googleAuthUrl: string | null;
}

/**
 * La configurazione pubblica del backend.
 *
 * <h2>Perche' il frontend deve chiederlo</h2>
 *
 * Il bottone "Accedi con Google" non puo' essere sempre presente: le credenziali
 * (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) stanno nel `.env` del server, e su
 * un'installazione che non le ha — cioe' quella di chiunque cloni il repo — le rotte
 * OAuth non esistono nemmeno. Un bottone che porta a una pagina d'errore e' peggio
 * di un bottone assente: promette una cosa che non c'e'.
 *
 * Il `googleAuthUrl` arriva dal server insieme al "se": e' il server a sapere dove
 * risponde, e con il solo booleano quel percorso finirebbe scritto a mano anche qui,
 * da tenere allineato a mano.
 *
 * <h2>Perche' e' un `<a href>` e non una chiamata HTTP</h2>
 *
 * Il giro OAuth e' una **navigazione del browser**, non una richiesta in background:
 * il backend risponde con un redirect verso la schermata di consenso di Google, che
 * deve comparire nella finestra. Una `fetch` verso quell'indirizzo la seguirebbe in
 * silenzio e non mostrerebbe niente.
 *
 * <h2>Perche' non si chiede durante il rendering sul server</h2>
 *
 * In SSR non c'e' niente da guadagnare — il bottone compare un istante dopo
 * l'idratazione — e una chiamata di rete in piu' a ogni pagina renderizzata la
 * pagherebbero anche le rotte che con l'accesso non c'entrano niente.
 */
@Injectable({ providedIn: 'root' })
export class PublicConfigService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _config = signal<PublicConfig | null>(null);
  readonly config = this._config.asReadonly();

  /** Una sola richiesta per sessione, condivisa fra login e registrazione. */
  private pending: Promise<PublicConfig | null> | null = null;

  async load(): Promise<PublicConfig | null> {
    if (!isPlatformBrowser(this.platformId)) return null;
    if (this._config()) return this._config();
    if (this.pending) return this.pending;

    this.pending = firstValueFrom(this.http.get<PublicConfig>(`${API_URL}/config`))
      .then((config) => {
        this._config.set(config);
        return config;
      })
      .catch(() => {
        // Backend irraggiungibile o rotta assente: si resta senza bottone. Non e'
        // un errore da mostrare — chi e' su questa pagina vuole entrare, e la via
        // con email e password funziona comunque.
        this._config.set(null);
        return null;
      })
      .finally(() => {
        this.pending = null;
      });

    return this.pending;
  }
}
