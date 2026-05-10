import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../services/api.config';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly http = inject(HttpClient);

  email = '';
  loading = signal(false);
  sent = signal(false);
  error = signal<string | null>(null);

  async submit() {
    if (!this.email || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.http.post(`${API_URL}/auth/forgot-password`, { email: this.email }, { withCredentials: true }).toPromise();
      this.sent.set(true);
    } catch {
      this.error.set('Errore nell\'invio. Riprova tra qualche minuto.');
    } finally {
      this.loading.set(false);
    }
  }
}
