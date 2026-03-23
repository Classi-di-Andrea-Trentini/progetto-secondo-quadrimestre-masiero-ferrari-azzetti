import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  templateUrl: './verify-email.html',
})
export class VerifyEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  status = signal<'loading' | 'success' | 'error'>('loading');
  message = signal<string | null>(null);

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.status.set('error');
      this.message.set('Link non valido.');
      return;
    }

    try {
      await this.auth.confirmVerification(token);
      this.status.set('success');
    } catch (err) {
      this.status.set('error');
      this.message.set(this.auth.extractErrorMessage(err));
    }
  }
}
