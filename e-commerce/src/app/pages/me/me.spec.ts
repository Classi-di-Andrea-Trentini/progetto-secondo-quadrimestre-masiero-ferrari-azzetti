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

  // ─── Spedizione gratuita e sconto in fattura ────────────────────────────
  //
  // Prima questi due punti si decidevano confrontando l'esito gia' formattato
  // (`formatOrderPrice(v) === '€ 0,00'`): quando la formattazione e' passata
  // all'inglese ("€0.00") quel confronto ha smesso silenziosamente di incontrare
  // qualsiasi valore, e il difetto non l'ha preso nessun test. Qui si fissa il
  // comportamento reso a schermo — non la stringa formattata — cosi' un domani
  // `formatPrice` cambiasse ancora formato (spazio, separatore delle migliaia) un
  // test rosso lo direbbe subito, invece di un badge "Free" che smette di comparire
  // in silenzio.

  function orderSummary(overrides: { shippingCost?: string; discountTotal?: string } = {}) {
    return {
      id: 'order-1',
      status: 'delivered',
      total: '45.00',
      subtotal: '45.00',
      shippingCost: '0.00',
      discountTotal: '0.00',
      createdAt: '2026-01-01T00:00:00Z',
      items: [{ id: 'item-1', productName: 'Tee', quantity: 1, lineTotal: '45.00' }],
      payments: [{ status: 'succeeded' }],
      ...overrides,
    };
  }

  describe('order totals — shipping and discount, rendered', () => {
    beforeEach(() => {
      // Si salta `setTab('orders')` apposta: chiamerebbe `loadOrders()`, cioe' una
      // richiesta HTTP che qui non serve e che nessuno intercetterebbe.
      component.activeTab.set('orders');
    });

    it('shows shipping as Free when the cost is zero', () => {
      component.orders.set([orderSummary({ shippingCost: '0.00' })]);
      component.expandedOrderId.set('order-1');
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Free');
      expect(text).not.toContain('€0.00');
    });

    it('shows the formatted shipping cost when it is not free', () => {
      component.orders.set([orderSummary({ shippingCost: '4.90' })]);
      component.expandedOrderId.set('order-1');
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('€4.90');
      expect(text).not.toContain('Free');
    });

    it('hides the discount line when no discount was applied', () => {
      component.orders.set([orderSummary({ discountTotal: '0.00' })]);
      component.expandedOrderId.set('order-1');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('Discount');
    });

    it('shows the discount line and amount when a discount was applied', () => {
      component.orders.set([orderSummary({ discountTotal: '5.00' })]);
      component.expandedOrderId.set('order-1');
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Discount');
      expect(text).toContain('€5.00');
    });
  });

  describe('isZeroAmount', () => {
    it('treats a numeric or string zero as zero, whatever formatPrice would print', () => {
      expect(component.isZeroAmount(0)).toBe(true);
      expect(component.isZeroAmount('0.00')).toBe(true);
      expect(component.isZeroAmount('0')).toBe(true);
    });

    it('treats anything else as not zero', () => {
      expect(component.isZeroAmount(4.9)).toBe(false);
      expect(component.isZeroAmount('4.90')).toBe(false);
    });
  });
});
