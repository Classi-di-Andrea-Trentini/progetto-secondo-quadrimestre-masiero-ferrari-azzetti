import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';

import { CartService } from './cart-service';
import { AuthService } from './auth';

/**
 * Il carrello dell'ospite.
 *
 * `ready` governa lo scheletro nel drawer: finche' e' falso, chi apre la borsa
 * vede tre righe finte invece del proprio carrello. Il costruttore non puo'
 * dichiararlo pronto subito, perche' `/auth/me` e' ancora in volo e un utente
 * che risulta anonimo per un istante si vedrebbe il carrello locale al posto di
 * quello sul server. Ma quando la risposta arriva e dice "nessuno", il carrello
 * dev'essere pronto lo stesso: per un ospite `isAuthenticated()` non cambia mai.
 */
describe('CartService — prontezza per chi non e\' autenticato', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
  });

  it('diventa pronto quando l\'autenticazione finisce senza utente', () => {
    // Stato reale all'avvio: la chiamata a /auth/me non e' ancora tornata.
    (auth as unknown as { _loading: { set(v: boolean): void } })._loading.set(true);

    const cart = TestBed.inject(CartService);
    expect(cart.ready()).toBe(false);

    // /auth/me risponde: nessun utente. Nessun cambio di `isAuthenticated`.
    (auth as unknown as { _loading: { set(v: boolean): void } })._loading.set(false);
    TestBed.tick();

    expect(cart.ready()).toBe(true);
  });

  it('e\' gia\' pronto se l\'autenticazione era gia\' conclusa', () => {
    (auth as unknown as { _loading: { set(v: boolean): void } })._loading.set(false);

    const cart = TestBed.inject(CartService);
    expect(cart.ready()).toBe(true);
  });
});
