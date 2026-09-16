import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Checkout } from './checkout';
import { API_URL } from '../../services/api.config';

/** Chiave del carrello ospite in `localStorage` (vedi `cart-service.ts`). */
const GUEST_CART_KEY = 'commonera.guest-cart';

/**
 * `reserved()` e' il flag che blocca i campi promo/gift card dopo che il
 * server ha prenotato l'ordine e congelato l'importo da incassare (vedi il
 * commento su `reserved` in checkout.ts): senza questa prova nessun test
 * copre il meccanismo che impedisce di mostrare un totale diverso da quello
 * poi davvero addebitato da Stripe.
 *
 * Le prime tre prove restano deliberatamente sotto `fixture.detectChanges()`:
 * `ngOnInit` (che carica indirizzi e punti fedelta' via HTTP) non serve per
 * verificare la transizione del solo `computed`. L'ultima prova sale invece
 * al livello del template, per coprire anche i binding `[disabled]` che
 * usano `reserved()` nel riepilogo (promo/gift card).
 */
describe('Checkout - reserved()', () => {
  let component: Checkout;
  let fixture: ComponentFixture<Checkout>;
  let http: HttpTestingController;

  beforeEach(async () => {
    // Un carrello vuoto farebbe scattare l'effetto di `ngOnInit` che rimanda
    // al catalogo (vedi checkout.ts): irrilevante per `reserved()`, ma
    // romperebbe il test con una navigazione a vuoto. Un carrello ospite non
    // vuoto lo evita, senza dover mockare l'intero CartService.
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([{
      variantId: 'v1', productId: 'p1', productName: 'Test Product', slug: 'test-product',
      variantLabel: 'M', size: 'M', color: null, colorHex: null, imageUrl: '/media/test.svg',
      unitPrice: 50, originalPrice: 50, quantity: 1,
    }]));

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Checkout);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    // AuthService (iniettata da CartService e dal componente) prova sempre
    // `/auth/me` alla costruzione: la si smaltisce da visitatore anonimo,
    // altrimenti resta una richiesta aperta e http.verify() la trova.
    http.expectOne(`${API_URL}/auth/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(GUEST_CART_KEY);
  });

  it('is false before any order has been reserved', () => {
    expect(component.pendingOrderId()).toBeNull();
    expect(component.reserved()).toBe(false);
  });

  it('becomes true once the server reserves an order (pendingOrderId set)', () => {
    component.pendingOrderId.set('order-123');
    expect(component.reserved()).toBe(true);
  });

  it('goes back to false when the reservation is discarded (pendingOrderId cleared)', () => {
    component.pendingOrderId.set('order-123');
    expect(component.reserved()).toBe(true);

    // Questo e' esattamente cio' che fa `discardReservation()` quando si torna
    // indietro dal pagamento: azzera `pendingOrderId`, e i campi promo/gift
    // card devono tornare modificabili.
    component.pendingOrderId.set(null);
    expect(component.reserved()).toBe(false);
  });

  it('disables the promo and gift card controls in the template once reserved, and re-enables them once cleared', async () => {
    fixture.detectChanges();
    // `ngOnInit` carica indirizzi e punti fedelta': si smaltiscono per poter
    // leggere il template gia' stabile, non perche' servano al test.
    http.expectOne(`${API_URL}/addresses`).flush([]);
    http.expectOne(`${API_URL}/loyalty`).flush({ balance: 0, value: 0, minRedeemable: 0, redeemable: false });
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // Il riepilogo condiviso (`#summaryContent`) e' montato due volte nel DOM
    // (versione pieghevole sotto lg, versione fissa da lg in su): entrambe le
    // copie dei campi devono rispettare `reserved()`.
    const promoInputs = () => Array.from(el.querySelectorAll<HTMLInputElement>('input[placeholder="Discount code"]'));
    const giftCardInputs = () => Array.from(el.querySelectorAll<HTMLInputElement>('input[placeholder="Gift card"]'));

    expect(promoInputs().length).toBeGreaterThan(0);
    expect(giftCardInputs().length).toBeGreaterThan(0);
    expect(promoInputs().every(i => !i.disabled)).toBe(true);
    expect(giftCardInputs().every(i => !i.disabled)).toBe(true);

    component.pendingOrderId.set('order-123');
    fixture.detectChanges();
    // Il `DefaultValueAccessor` di `[ngModel]` sincronizza la propria idea
    // dello stato disabled un giro di change detection dopo il binding
    // `[disabled]` del template: senza questo secondo giro l'asserzione legge
    // il DOM a meta' aggiornamento.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(promoInputs().every(i => i.disabled)).toBe(true);
    expect(giftCardInputs().every(i => i.disabled)).toBe(true);

    component.pendingOrderId.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(promoInputs().every(i => !i.disabled)).toBe(true);
    expect(giftCardInputs().every(i => !i.disabled)).toBe(true);
  });
});
