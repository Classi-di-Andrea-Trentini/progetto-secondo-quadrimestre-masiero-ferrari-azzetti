import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-footer',
  imports: [FormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private readonly router = inject(Router);

  email = signal('');
  subscribeMessage = signal('');
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
    if (emailValue && this.isValidEmail(emailValue)) {
      // In a real app, you'd send this to a backend service
      console.log('Newsletter subscription:', emailValue);
      
      // Reset form
      this.email.set('');

      // Show inline success feedback without intrusive popups
      this.subscribeMessage.set('Thank you for subscribing! Stay tuned for updates.');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isHomeRoute(url: string): boolean {
    return url === '/' || url === '/home' || url.startsWith('/home?') || url.startsWith('/home#');
  }
}
