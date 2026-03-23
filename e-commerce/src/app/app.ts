import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { NavBar } from './components/nav-bar/nav-bar';
import { Footer } from './components/footer/footer';
import { Cart } from './components/cart/cart';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavBar, Footer, Cart],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cookieStorageKey = 'common_era_cookie_consent';

  protected readonly cartDrawerOpen = signal(false);
  protected readonly title = signal('e-commerce');
  protected readonly cookiesAccepted = signal(false);

  constructor(public router: Router) {
    if (isPlatformBrowser(this.platformId)) {
      const accepted = localStorage.getItem(this.cookieStorageKey) === 'accepted';
      this.cookiesAccepted.set(accepted);
    }
  }

  acceptCookies(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.cookieStorageKey, 'accepted');
    }
    this.cookiesAccepted.set(true);
  }

  rejectCookies(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.cookieStorageKey);
      window.location.href = 'about:blank';
    }
  }

  isHome(): boolean {
    return this.router.url === '/home';
  }

  openCartDrawer(): void {
    this.cartDrawerOpen.set(true);
  }

  closeCartDrawer(): void {
    this.cartDrawerOpen.set(false);
  }
}
