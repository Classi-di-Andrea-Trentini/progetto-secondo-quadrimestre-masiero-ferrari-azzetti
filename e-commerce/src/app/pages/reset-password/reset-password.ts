import { Component, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../services/api.config';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  token = '';
  password = '';
  confirm = '';
  loading = signal(false);
  done = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.error.set('Missing token. Use the link you received by email.');
  }

  async submit() {
    if (this.loading() || !this.token) return;
    if (this.password.length < 8) { this.error.set('Password must be at least 8 characters.'); return; }
    if (this.password !== this.confirm) { this.error.set('Passwords do not match.'); return; }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.http.post(`${API_URL}/auth/reset-password`, { token: this.token, password: this.password }, { withCredentials: true }).toPromise();
      this.done.set(true);
      setTimeout(() => this.router.navigate(['/login']), 3000);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Invalid or expired token.');
    } finally {
      this.loading.set(false);
    }
  }
}
