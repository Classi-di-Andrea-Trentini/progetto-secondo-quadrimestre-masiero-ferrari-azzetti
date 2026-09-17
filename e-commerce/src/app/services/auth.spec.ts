import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService, AuthUser } from './auth';
import { API_URL } from './api.config';

const someone: AuthUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'giulia@example.com',
  fullName: 'Giulia Bianchi',
  role: 'user',
  avatarUrl: null,
  phone: null,
  birthDate: null,
  gender: null,
  newsletterOptIn: false,
  emailVerifiedAt: null,
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00Z',
};

/**
 * La cancellazione dell'account (art. 17 GDPR), lato client.
 *
 * Il punto che conta: dopo la cancellazione non deve restare a schermo un utente che
 * sul server non esiste piu'.
 */
describe('AuthService — cancellazione account', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    // Il costruttore prova sempre `/auth/me`: la si smaltisce e si parte da un
    // utente collegato, che e' il solo caso in cui questa rotta ha senso.
    http.expectOne(`${API_URL}/auth/me`).flush(someone);
  });

  afterEach(() => http.verify());

  it('asks the server to erase the account, sending the password in the body', async () => {
    const done = auth.eraseAccount('Password123');

    const req = http.expectOne(`${API_URL}/users/me`);
    expect(req.request.method).toBe('DELETE');
    // Nel corpo e non nella query string: un segreto in un URL finisce nei log del
    // server e nella cronologia del browser.
    expect(req.request.body).toEqual({ password: 'Password123' });
    expect(req.request.withCredentials).toBe(true);

    req.flush({ message: 'Account cancellato.' });
    await expect(done).resolves.toBe('Account cancellato.');
  });

  it('clears the signed-in user and leaves the private area', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(auth.isAuthenticated()).toBe(true);

    const done = auth.eraseAccount('Password123');
    http.expectOne(`${API_URL}/users/me`).flush({ message: 'Account cancellato.' });
    await done;

    expect(auth.currentUser()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });

  it('keeps the user signed in when the password was wrong', async () => {
    const done = auth.eraseAccount('sbagliata');
    http.expectOne(`${API_URL}/users/me`).flush(
      { message: 'Password non corretta', error: 'Unauthorized', statusCode: 401 },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(done).rejects.toBeTruthy();
    // Se la richiesta fallisce, l'account c'e' ancora: azzerare il segnale
    // comunque butterebbe fuori qualcuno che ha solo sbagliato a digitare.
    expect(auth.currentUser()).toEqual(someone);
  });
});
