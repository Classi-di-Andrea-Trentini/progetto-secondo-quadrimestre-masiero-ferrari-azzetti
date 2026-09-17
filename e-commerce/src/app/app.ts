import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { NavBar } from './components/nav-bar/nav-bar';
import { Footer } from './components/footer/footer';
import { Cart } from './components/cart/cart';
import { ToastComponent } from './components/toast/toast';
import { CookieConsentService } from './services/cookie-consent';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, NavBar, Footer, Cart, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /**
   * L'informativa cookie sta in un servizio e non qui dentro: a riaprirla e' il link
   * "Gestisci cookie" del footer, che e' un altro componente. Vedi
   * {@link CookieConsentService} per il motivo per cui e' un avviso e non un banner
   * di consenso con due pulsanti.
   */
  readonly cookies = inject(CookieConsentService);

  protected readonly title = signal('e-commerce');
  /** Il pannello con l'elenco per categoria, chiuso finche' non lo si apre. */
  protected readonly showingDetails = signal(false);

  constructor(public router: Router) {}

  acknowledgeCookies(): void {
    this.cookies.acknowledge();
    this.showingDetails.set(false);
  }

  showCookieDetails(): void {
    this.showingDetails.set(true);
  }

  hideCookieDetails(): void {
    this.showingDetails.set(false);
  }

  isHome(): boolean {
    return this.router.url === '/home';
  }
}
