import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { MeComponent } from './me';
import { AuthService } from '../../services/auth';

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
});
