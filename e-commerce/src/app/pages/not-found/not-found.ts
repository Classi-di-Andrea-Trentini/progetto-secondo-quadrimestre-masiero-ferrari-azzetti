import { Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo';

/**
 * Pagina 404.
 *
 * Prima il jolly delle rotte faceva `redirectTo: 'home'`: un indirizzo sbagliato
 * finiva in home con stato **200**, cioè il sito dichiarava che la pagina esisteva.
 * Le conseguenze erano due, e nessuna delle due si vedeva a occhio:
 *
 * 1. chi aveva sbagliato a scrivere, o seguito un link vecchio, non aveva modo di
 *    accorgersene: si ritrovava in home convinto di essere dove voleva;
 * 2. per un motore di ricerca ogni URL inventato era una pagina valida con lo
 *    stesso contenuto della home — contenuto duplicato a volontà, e l'indirizzo
 *    rotto restava indicizzato invece di sparire.
 *
 * Adesso il jolly rende **questa** pagina, e `app.routes.server.ts` le assegna lo
 * stato HTTP 404 vero. Il `noindex` copre il caso in cui la pagina venga raggiunta
 * senza passare dal server, cioè navigando dentro l'applicazione già caricata.
 *
 * L'indirizzo richiesto viene mostrato perché senza resta il dubbio su quale fosse
 * il refuso. Passa da `Router.url` e finisce in interpolazione, quindi è testo e
 * non HTML: non c'è modo di far eseguire qualcosa scrivendolo nell'URL.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.html',
})
export class NotFound {
  private readonly seo = inject(SeoService);
  private readonly meta = inject(Meta);

  readonly requestedUrl = inject(Router).url;

  constructor() {
    this.seo.setPage(
      'Page not found — Common Era',
      'The address you opened doesn\'t exist on Common Era.',
    );
    this.meta.updateTag({ name: 'robots', content: 'noindex, follow' });
  }
}
