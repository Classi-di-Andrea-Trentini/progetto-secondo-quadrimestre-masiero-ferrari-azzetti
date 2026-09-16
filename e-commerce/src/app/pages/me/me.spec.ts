import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { MeComponent } from './me';
import { AuthService, AuthUser } from '../../services/auth';

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

describe('Me', () => {
  let component: MeComponent;
  let fixture: ComponentFixture<MeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ─── Cancellazione account ──────────────────────────────────────────────

  it('opens the confirmation with an empty password field every time', () => {
    component.deleteAccountPassword.set('rimasta-da-prima');
    component.deleteAccountError.set('un errore vecchio');

    component.openDeleteAccount();

    expect(component.deleteAccountOpen()).toBe(true);
    // Riaprire la finestra non deve ritrovare la password digitata al tentativo
    // precedente ancora nel campo.
    expect(component.deleteAccountPassword()).toBe('');
    expect(component.deleteAccountError()).toBeNull();
  });

  it('refuses to send an irreversible request with an empty password', async () => {
    const auth = TestBed.inject(AuthService);
    const erase = vi.spyOn(auth, 'eraseAccount');

    component.openDeleteAccount();
    await component.confirmDeleteAccount();

    // La conferma esiste proprio per non cancellare un account con un click
    // distratto: senza password non parte niente.
    expect(erase).not.toHaveBeenCalled();
    expect(component.deleteAccountError()).toContain('password');
    expect(component.deleteAccountOpen()).toBe(true);
  });

  it('closes the confirmation once the account is gone', async () => {
    const auth = TestBed.inject(AuthService);
    vi.spyOn(auth, 'eraseAccount').mockResolvedValue('Account cancellato.');

    component.openDeleteAccount();
    component.deleteAccountPassword.set('Password123');
    await component.confirmDeleteAccount();

    expect(component.deleteAccountOpen()).toBe(false);
    expect(component.deleteAccountLoading()).toBe(false);
    expect(component.deleteAccountError()).toBeNull();
  });

  it('keeps the confirmation open and explains why when the server refuses', async () => {
    const auth = TestBed.inject(AuthService);
    vi.spyOn(auth, 'eraseAccount').mockRejectedValue(new Error('rifiutata'));
    vi.spyOn(auth, 'extractErrorMessage').mockReturnValue('Password non corretta');

    component.openDeleteAccount();
    component.deleteAccountPassword.set('sbagliata');
    await component.confirmDeleteAccount();

    // Chiudere la finestra su un errore lascerebbe credere che l'account sia
    // stato cancellato quando invece c'e' ancora.
    expect(component.deleteAccountOpen()).toBe(true);
    expect(component.deleteAccountError()).toBe('Password non corretta');
    expect(component.deleteAccountLoading()).toBe(false);
  });

  it('will not let the confirmation be dismissed while the request is in flight', () => {
    component.openDeleteAccount();
    component.deleteAccountLoading.set(true);

    component.closeDeleteAccount();

    // Chiudere a meta' non annulla la richiesta: darebbe solo l'impressione che
    // non sia successo niente.
    expect(component.deleteAccountOpen()).toBe(true);
  });

  // ─── Account entrati con Google ─────────────────────────────────────────

  it('assumes there is a password while the user is still loading', () => {
    // Finche' non si sa, si sta sulla versione con password: altrimenti la pagina
    // sfarfallerebbe fra le due a ogni ricaricamento.
    expect(component.hasPassword()).toBe(true);
  });

  it('knows a Google-only account has no password to change', () => {
    const auth = TestBed.inject(AuthService);
    vi.spyOn(auth, 'currentUser').mockReturnValue({ ...someone, hasPassword: false });

    // Da qui la pagina smette di offrire "cambia password" e "cambia email", e il
    // dialogo di cancellazione chiede l'indirizzo email invece della password.
    expect(component.hasPassword()).toBe(false);
  });

  it('keeps the password sections for an account that has one', () => {
    const auth = TestBed.inject(AuthService);
    vi.spyOn(auth, 'currentUser').mockReturnValue({ ...someone, hasPassword: true });

    expect(component.hasPassword()).toBe(true);
  });
});
