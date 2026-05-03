import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { NavBar } from './components/nav-bar/nav-bar';
import { Footer } from './components/footer/footer';
import { Cart } from './components/cart/cart';

export interface CookieConsent {
  essential: true;   // always true — cannot be disabled
  timestamp: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, NavBar, Footer, Cart],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'common_era_cookie_consent';

  protected readonly title = signal('e-commerce');
  protected readonly bannerVisible = signal(false);
  protected readonly customizing = signal(false);

  constructor(public router: Router) {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        this.bannerVisible.set(true);
      }
    }
  }

  acceptAll(): void {
    this.saveConsent();
    this.bannerVisible.set(false);
    this.customizing.set(false);
  }

  saveCustom(): void {
    // Essential only (only option available)
    this.saveConsent();
    this.bannerVisible.set(false);
    this.customizing.set(false);
  }

  decline(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.storageKey, JSON.stringify({ essential: true, declined: true, timestamp: new Date().toISOString() }));
    }
    this.bannerVisible.set(false);
    this.customizing.set(false);
  }

  openCustomize(): void {
    this.customizing.set(true);
  }

  backToBanner(): void {
    this.customizing.set(false);
  }

  // Keep backward-compat getter used in app.html
  get cookiesAccepted(): boolean {
    return !this.bannerVisible();
  }

  private saveConsent(): void {
    if (isPlatformBrowser(this.platformId)) {
      const consent: CookieConsent = { essential: true, timestamp: new Date().toISOString() };
      localStorage.setItem(this.storageKey, JSON.stringify(consent));
    }
  }

  isHome(): boolean {
    return this.router.url === '/home';
  }
}
