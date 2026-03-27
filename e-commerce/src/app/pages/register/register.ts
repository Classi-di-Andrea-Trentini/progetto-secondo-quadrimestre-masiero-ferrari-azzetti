import { Component, inject, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../services/auth';

function passwordComplexity(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  if (!hasUpper || !hasLower || !hasDigit) {
    return { complexity: true };
  }
  return null;
}

function passwordMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (confirm && password !== confirm) {
    return { mismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, NgClass],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.required, Validators.minLength(8), passwordComplexity]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatch },
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { fullName, email, password } = this.form.getRawValue();
      await this.auth.register({ fullName, email, password });
      this.success.set(true);
      setTimeout(() => this.router.navigate(['/login']), 2000);
    } catch (err) {
      this.error.set(this.auth.extractErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  get fullName() {
    return this.form.controls.fullName;
  }

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }

  get passwordMismatch() {
    return (
      this.form.hasError('mismatch') &&
      this.confirmPassword.touched
    );
  }
}
