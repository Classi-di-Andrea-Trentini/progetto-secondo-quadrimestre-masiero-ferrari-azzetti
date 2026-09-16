import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GoogleSignInButton } from './google-sign-in';
import { API_URL } from '../../services/api.config';

/**
 * La regola di esistenza del bottone.
 *
 * Il caso che conta e' quello negativo: su un'installazione senza credenziali Google
 * — cioe' quella di chiunque cloni il repo — il bottone non deve comparire affatto.
 * Un bottone che porta a una pagina d'errore promette una cosa che non c'e'.
 */
describe('GoogleSignInButton', () => {
  let fixture: ComponentFixture<GoogleSignInButton>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleSignInButton],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleSignInButton);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function answerConfig(body: { googleAuthEnabled: boolean; googleAuthUrl: string | null }) {
    fixture.detectChanges();
    http.expectOne(`${API_URL}/config`).flush(body);
    // Il segnale si aggiorna dentro una `then()`: senza aspettare la microtask, la
    // vista viene ridisegnata prima che la risposta sia stata registrata.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows nothing while the backend has not answered yet', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    http.expectOne(`${API_URL}/config`).flush({ googleAuthEnabled: false, googleAuthUrl: null });
  });

  it('shows nothing when Google is not configured on the server', async () => {
    await answerConfig({ googleAuthEnabled: false, googleAuthUrl: null });

    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Google');
  });

  it('shows the button pointing at the URL the backend gave', async () => {
    await answerConfig({
      googleAuthEnabled: true,
      googleAuthUrl: 'http://localhost:3000/api/auth/oauth2/authorize/google',
    });

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('http://localhost:3000/api/auth/oauth2/authorize/google');
    expect(link!.textContent).toContain('Sign in with Google');
  });

  it('uses the design system button, not a hand-built one', async () => {
    await answerConfig({
      googleAuthEnabled: true,
      googleAuthUrl: 'http://localhost:3000/api/auth/oauth2/authorize/google',
    });

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.className).toContain('btn');
    expect(link.className).toContain('btn-outline');
    expect(link.className).toContain('btn-block');
  });

  it('is a real navigation, not an Angular route', async () => {
    // Il giro OAuth deve uscire dalla single-page application: il backend risponde
    // con un redirect verso la schermata di consenso di Google, che deve comparire
    // nella finestra. Un routerLink lo intercetterebbe.
    await answerConfig({
      googleAuthEnabled: true,
      googleAuthUrl: 'http://localhost:3000/api/auth/oauth2/authorize/google',
    });

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('routerLink')).toBeNull();
  });
});
