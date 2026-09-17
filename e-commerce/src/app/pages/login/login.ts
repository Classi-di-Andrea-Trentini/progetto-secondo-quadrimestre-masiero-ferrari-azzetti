import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { GoogleSignInButton } from '../../components/google-sign-in/google-sign-in';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, GoogleSignInButton],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  constructor() {
    // Il giro con Google finisce con un redirect del browser, non con una risposta
    // che questo componente possa leggere: quando va storto (indirizzo non
    // verificato, account gia' collegato altrove) il backend rimanda qui con il
    // motivo in `?error=`. Senza questa riga la persona tornerebbe alla pagina di
    // accesso senza sapere perche'.
    const fromGoogle = this.route.snapshot.queryParamMap.get('error');
    if (fromGoogle) this.error.set(fromGoogle);
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.login(this.form.getRawValue());
      this.router.navigate(['/me']);
    } catch (err) {
      this.error.set(this.auth.extractErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  togglePasswordVisibility() {
    this.showPassword.update((value) => !value);
  }
}
