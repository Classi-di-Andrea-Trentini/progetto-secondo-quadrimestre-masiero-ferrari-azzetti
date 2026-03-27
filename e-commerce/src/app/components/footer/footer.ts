import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

const API_URL = 'http://localhost:3000';

@Component({
  selector: 'app-footer',
  imports: [FormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  email = signal('');
  subscribeMessage = signal('');
  subscribeError = signal('');
  subscribing = signal(false);
  isHomePage = signal(this.isHomeRoute(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isHomePage.set(this.isHomeRoute(this.router.url));
      });
  }

  onSubscribe(): void {
    const emailValue = this.email();
    if (!emailValue || !this.isValidEmail(emailValue)) return;

    this.subscribing.set(true);
    this.subscribeError.set('');
    this.subscribeMessage.set('');

    this.http.post<{ message: string }>(`${API_URL}/newsletter/subscribe`, { email: emailValue })
      .subscribe({
        next: (res) => {
          this.email.set('');
          this.subscribeMessage.set(res.message);
          this.subscribing.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Something went wrong. Please try again.';
          this.subscribeError.set(msg);
          this.subscribing.set(false);
        },
      });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isHomeRoute(url: string): boolean {
    return url === '/' || url === '/home' || url.startsWith('/home?') || url.startsWith('/home#');
  }
}
