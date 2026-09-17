import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PublicConfigService } from './public-config';
import { API_URL } from './api.config';

describe('PublicConfigService', () => {
  let config: PublicConfigService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    config = TestBed.inject(PublicConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the public configuration from the backend', async () => {
    const done = config.load();

    const req = http.expectOne(`${API_URL}/config`);
    expect(req.request.method).toBe('GET');
    req.flush({ googleAuthEnabled: true, googleAuthUrl: 'http://localhost:3000/api/auth/oauth2/authorize/google' });

    await done;
    expect(config.config()?.googleAuthEnabled).toBe(true);
    expect(config.config()?.googleAuthUrl).toBe('http://localhost:3000/api/auth/oauth2/authorize/google');
  });

  it('asks only once even if two pages ask together', async () => {
    // Login e registrazione montano lo stesso bottone: senza questa condivisione,
    // aprire l'una e poi l'altra farebbe due richieste identiche.
    const first = config.load();
    const second = config.load();

    http.expectOne(`${API_URL}/config`).flush({ googleAuthEnabled: false, googleAuthUrl: null });

    await Promise.all([first, second]);
    http.expectNone(`${API_URL}/config`);
  });

  it('does not ask again once it knows the answer', async () => {
    const first = config.load();
    http.expectOne(`${API_URL}/config`).flush({ googleAuthEnabled: false, googleAuthUrl: null });
    await first;

    await config.load();
    http.expectNone(`${API_URL}/config`);
  });

  it('survives a backend that does not answer', async () => {
    // Nessun errore da mostrare: chi e' sulla pagina di accesso vuole entrare, e la
    // strada con email e password funziona comunque.
    const done = config.load();
    http.expectOne(`${API_URL}/config`).error(new ProgressEvent('network error'));

    await expect(done).resolves.toBeNull();
    expect(config.config()).toBeNull();
  });
});
