import { Component, computed, inject } from '@angular/core';
import { PublicConfigService } from '../../services/public-config';

/**
 * Il bottone "Accedi con Google", con la sua regola di esistenza.
 *
 * Sta in un componente e non copiato in due pagine perche' la regola e' una sola —
 * "solo se il backend dichiara di avere le credenziali" — e due copie della stessa
 * regola divergono alla prima modifica.
 *
 * Non si disegna niente a mano: e' un `.btn .btn-outline` del design system, cioe'
 * lo stesso vocabolario del bottone "Accedi" che gli sta sopra. `btn-outline` e non
 * `btn-primary` di proposito: in questa pagina l'azione principale resta una sola, e
 * due bottoni pieni non direbbero quale.
 */
@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  templateUrl: './google-sign-in.html',
})
export class GoogleSignInButton {
  private readonly config = inject(PublicConfigService);

  /** `null` finche' il backend non ha risposto, o se ha detto che Google e' spento. */
  readonly url = computed(() => {
    const config = this.config.config();
    return config?.googleAuthEnabled ? config.googleAuthUrl : null;
  });

  constructor() {
    void this.config.load();
  }
}
