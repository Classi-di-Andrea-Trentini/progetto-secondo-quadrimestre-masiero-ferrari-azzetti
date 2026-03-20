import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-footer',
  imports: [FormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  email = signal('');
  subscribeMessage = signal('');

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
}
