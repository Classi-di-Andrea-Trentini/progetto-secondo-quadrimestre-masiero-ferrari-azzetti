import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  newsletterOptIn: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  newsletterOptIn?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _loading = signal(true);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
  readonly isLoading = this._loading.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkAuth();
    } else {
      this._loading.set(false);
    }
  }

  private async checkAuth() {
    this._loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<AuthUser>(`${API_URL}/auth/me`, { withCredentials: true }),
      );
      this._currentUser.set(res);
    } catch {
      this._currentUser.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  async login(payload: LoginPayload): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ message: string; user: AuthUser }>(`${API_URL}/auth/login`, payload, {
        withCredentials: true,
      }),
    );
    this._currentUser.set(res.user);
  }

  async register(payload: RegisterPayload): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API_URL}/auth/register`, payload, { withCredentials: true }),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${API_URL}/auth/logout`, {}, { withCredentials: true }),
      );
    } finally {
      this._currentUser.set(null);
      this.router.navigate(['/home']);
    }
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<void> {
    const res = await firstValueFrom(
      this.http.patch<AuthUser>(`${API_URL}/users/me`, payload, { withCredentials: true }),
    );
    this._currentUser.set(res);
  }

  async confirmVerification(token: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<{ message: string }>(`${API_URL}/users/verify-email/${token}`),
    );
    return res.message;
  }

  async sendVerificationEmail(): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ message: string }>(
        `${API_URL}/users/me/send-verification`,
        {},
        { withCredentials: true },
      ),
    );
    return res.message;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ message: string }>(
        `${API_URL}/users/me/change-password`,
        { currentPassword, newPassword },
        { withCredentials: true },
      ),
    );
    return res.message;
  }

  async requestEmailChange(newEmail: string, currentPassword: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ message: string }>(
        `${API_URL}/users/me/change-email`,
        { newEmail, currentPassword },
        { withCredentials: true },
      ),
    );
    return res.message;
  }

  extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const msg = err.error?.message;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg) && msg.length > 0) return msg.join('. ');

      switch (err.status) {
        case 0:
          // Stato 0 = richiesta bloccata prima della risposta: DNS, rete,
          // CORS, mixed content HTTPS→HTTP. Su Codespaces è il sintomo
          // tipico quando il backend non è raggiungibile all'URL derivato.
          // eslint-disable-next-line no-console
          console.error('[Auth] Richiesta fallita verso', err.url, err);
          return 'Impossibile contattare il server. Verifica la connessione o che il backend sia raggiungibile.';
        case 400:
          return 'Richiesta non valida';
        case 401:
          return 'Credenziali non valide o sessione scaduta';
        case 403:
          return 'Operazione non consentita';
        case 404:
          return 'Risorsa non trovata';
        case 409:
          return 'Conflitto: la risorsa esiste già o è in uso';
        case 422:
          return 'Dati non validi';
        case 429:
          return 'Troppi tentativi, riprova tra qualche minuto';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Servizio temporaneamente non disponibile, riprova più tardi';
      }

      if (err.status >= 500) {
        return 'Errore del server, riprova più tardi';
      }
    }

    if (err instanceof Error) {
      // eslint-disable-next-line no-console
      console.error('[Auth] Errore generico:', err);
    }
    return 'Si è verificato un errore, riprova';
  }
}
