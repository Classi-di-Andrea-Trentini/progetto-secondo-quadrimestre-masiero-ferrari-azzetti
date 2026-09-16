import { Component, ElementRef, Injector, effect, inject, signal, computed, viewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CartService, AddressData } from '../../services/cart-service';
import { AuthService } from '../../services/auth';
import { StripeService } from '../../services/stripe.service';
import { CheckoutStep, nextStepFrom, stepsFor } from './checkout-steps';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout implements OnInit {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly fb = inject(FormBuilder);
  private readonly stripe = inject(StripeService);

  step = signal<CheckoutStep>('address');

  /**
   * Quanto resta da incassare **secondo il server**, noto solo dopo che
   * l'ordine e' stato prenotato. Finche' e' `null` vale la stima calcolata nel
   * browser (`amountToPay`), che serve a mostrare o nascondere il passo di
   * pagamento prima ancora di prenotare; ma a decidere e' sempre il server,
   * perche' e' lui a rileggere prezzi e saldi dal database.
   */
  serverAmountToPay = signal<number | null>(null);
  /** L'ordine prenotato, in attesa di incasso. */
  pendingOrderId = signal<string | null>(null);
  private clientSecret: string | null = null;
  paymentReady = signal(false);
  /** Vero quando il negozio gira senza chiavi: niente modulo della carta. */
  simulatedPayment = signal(false);

  private readonly paymentHost = viewChild<ElementRef<HTMLElement>>('paymentElement');

  /**
   * Monta il modulo appena il contenitore esiste. Non nel `nextStep`, perche'
   * al momento del cambio di passo Angular non ha ancora reso il nodo.
   */
  private readonly mountWhenVisible = effect(() => {
    const host = this.paymentHost();
    if (host && this.step() === 'payment') {
      void this.preparePayment(host.nativeElement);
    }
  });
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<{ orderId: string; total: number } | null>(null);

  // ─── Addresses ────────────────────────────────────────────
  addresses = signal<AddressData[]>([]);
  addressLoading = signal(true);
  selectedAddressId = signal<string | null>(null);
  showNewAddressForm = signal(false);
  addressFormLoading = signal(false);
  addressFormError = signal<string | null>(null);

  readonly addressForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    street: ['', [Validators.required]],
    street2: [''],
    city: ['', [Validators.required]],
    province: [''],
    postalCode: ['', [Validators.required]],
    country: ['IT', [Validators.required]],
    isDefault: [false],
  });

  // ─── Shipping ─────────────────────────────────────────────
  shippingMethod = signal<'standard' | 'express'>('standard');

  readonly FREE_SHIPPING_THRESHOLD = 100;
  readonly SHIPPING_COSTS = { standard: 4.90, express: 9.90 };

  // ─── Promo ────────────────────────────────────────────────
  promoCode = signal('');
  promoLoading = signal(false);
  promoError = signal<string | null>(null);
  promoSuccess = signal<string | null>(null);
  promoDiscount = signal(0);
  appliedPromoCode = signal<string | null>(null);

  // ─── Gift card ────────────────────────────────────────────
  giftCardCode = signal('');
  giftCardLoading = signal(false);
  giftCardError = signal<string | null>(null);
  /** Saldo verificato del buono: non e' ancora quanto verra' scalato. */
  giftCardBalance = signal(0);
  appliedGiftCard = signal<string | null>(null);

  // ─── Punti fedelta' ───────────────────────────────────────
  loyalty = signal<{ balance: number; value: number; minRedeemable: number; redeemable: boolean } | null>(null);
  useLoyalty = signal(false);

  // ─── Notes ────────────────────────────────────────────────
  notes = signal('');

  // ─── Computed totals ──────────────────────────────────────
  readonly shippingCost = computed(() => {
    const sub = this.cart.subtotal() - this.promoDiscount();
    return sub >= this.FREE_SHIPPING_THRESHOLD ? 0 : this.SHIPPING_COSTS[this.shippingMethod()];
  });

  readonly total = computed(() => {
    return Math.max(0, this.cart.subtotal() - this.promoDiscount() + this.shippingCost());
  });

  /**
   * Punti che verranno effettivamente spesi.
   *
   * Non si spende piu' di quanto valga l'ordine e si arrotonda per difetto al
   * centinaio: e' la stessa regola del backend, e mostrarne una diversa qui
   * significherebbe promettere uno sconto che poi non arriva.
   */
  readonly loyaltyPointsToUse = computed(() => {
    const info = this.loyalty();
    if (!this.useLoyalty() || !info?.redeemable) return 0;
    const cap = Math.floor(this.total() * 100);
    return Math.floor(Math.min(info.balance, cap) / 100) * 100;
  });

  readonly loyaltyDiscount = computed(() => this.loyaltyPointsToUse() / 100);

  /** Quanto copre il buono: al massimo il dovuto dopo i punti. */
  readonly giftCardApplied = computed(() =>
    this.appliedGiftCard()
      ? Math.min(this.giftCardBalance(), Math.max(0, this.total() - this.loyaltyDiscount()))
      : 0,
  );

  readonly amountToPay = computed(() =>
    Math.max(0, this.total() - this.loyaltyDiscount() - this.giftCardApplied()),
  );

  /** La cifra che comanda: quella del server se c'e', altrimenti la stima. */
  readonly payable = computed(() => this.serverAmountToPay() ?? this.amountToPay());

  ngOnInit() {
    // Si aspetta che il carrello sia stato caricato prima di decidere: da quando
    // vive sul server arriva dopo il primo render, e controllarlo subito mandava
    // sul catalogo anche chi aveva il carrello pieno.
    effect(
      () => {
        if (!this.cart.ready()) return;
        if (this.cart.items().length === 0 && !this.success()) {
          this.router.navigate(['/products']);
        }
      },
      { injector: this.injector },
    );

    this.loadAddresses();
    void this.cart.loyaltySummary().then((info) => this.loyalty.set(info)).catch(() => {});
  }

  async loadAddresses() {
    this.addressLoading.set(true);
    try {
      const addrs = await this.cart.getAddresses();
      this.addresses.set(addrs);
      const def = addrs.find(a => a.isDefault) ?? addrs[0];
      if (def) this.selectedAddressId.set(def.id);
    } catch {
      this.error.set('Impossibile caricare gli indirizzi');
    } finally {
      this.addressLoading.set(false);
    }
  }

  selectAddress(id: string) {
    this.selectedAddressId.set(id);
  }

  toggleNewAddressForm() {
    this.showNewAddressForm.update(v => !v);
    this.addressFormError.set(null);
    if (this.showNewAddressForm()) {
      const user = this.auth.currentUser();
      this.addressForm.patchValue({ fullName: user?.fullName ?? '', country: 'IT' });
    }
  }

  async saveNewAddress() {
    if (this.addressForm.invalid || this.addressFormLoading()) return;
    this.addressFormLoading.set(true);
    this.addressFormError.set(null);
    try {
      const v = this.addressForm.getRawValue();
      const addr = await this.cart.createAddress({
        fullName: v.fullName,
        phone: v.phone || null,
        street: v.street,
        street2: v.street2 || null,
        city: v.city,
        province: v.province || null,
        postalCode: v.postalCode,
        country: v.country,
      });
      this.addresses.update(list => [addr, ...list]);
      this.selectedAddressId.set(addr.id);
      this.showNewAddressForm.set(false);
      this.addressForm.reset({ country: 'IT', isDefault: false });
    } catch {
      this.addressFormError.set('Impossibile salvare l\'indirizzo');
    } finally {
      this.addressFormLoading.set(false);
    }
  }

  async nextStep() {
    if (this.step() === 'address' && !this.selectedAddressId()) return;

    // Passando da spedizione a pagamento l'ordine si **prenota**: la merce
    // viene riservata e nasce l'intento di incasso. Prima di questo momento non
    // si sa nemmeno quanto ci sia da pagare.
    if (this.step() === 'shipping' && !this.pendingOrderId()) {
      const reserved = await this.reserveOrder();
      if (!reserved) return;
      if (this.payable() === 0) {
        // Buono che copre tutto: l'ordine e' gia' pagato, non c'e' nessun passo
        // di pagamento da attraversare.
        this.step.set('review');
        return;
      }
    }

    this.step.set(nextStepFrom(this.step(), this.payable()));
  }

  async prevStep() {
    const target = nextStepFrom(this.step(), this.payable(), 'back');

    // Tornando **prima** del pagamento si cambiano dati che la prenotazione ha
    // gia' congelato (indirizzo, spedizione, buono). L'ordine vecchio va
    // annullato, altrimenti si pagherebbe qualcosa di diverso da quello che si
    // vede a schermo, e la merce resterebbe riservata due volte.
    if (this.pendingOrderId() && (target === 'shipping' || target === 'address')) {
      await this.discardReservation();
    }
    this.step.set(target);
  }

  private async discardReservation(): Promise<void> {
    const orderId = this.pendingOrderId();
    if (!orderId) return;
    try {
      await this.cart.cancelPendingOrder(orderId);
    } catch {
      // Se l'annullo non riesce non si blocca il cliente: l'ordine resta
      // `pending` e lo raccoglie il reaper dopo mezz'ora.
    }
    this.pendingOrderId.set(null);
    this.serverAmountToPay.set(null);
    this.clientSecret = null;
    this.paymentReady.set(false);
    this.stripe.reset();
  }

  async applyPromo() {
    const code = this.promoCode().trim();
    if (!code || this.promoLoading()) return;
    this.promoLoading.set(true);
    this.promoError.set(null);
    this.promoSuccess.set(null);
    try {
      const res = await this.cart.validatePromo(code, this.cart.subtotal());
      this.promoDiscount.set(res.discountValue);
      this.appliedPromoCode.set(code.toUpperCase());
      this.promoSuccess.set(`Sconto di €${res.discountValue.toFixed(2)} applicato!`);
    } catch (err: any) {
      this.promoError.set(err?.error?.message ?? 'Codice non valido');
      this.promoDiscount.set(0);
      this.appliedPromoCode.set(null);
    } finally {
      this.promoLoading.set(false);
    }
  }

  removePromo() {
    this.promoDiscount.set(0);
    this.appliedPromoCode.set(null);
    this.promoCode.set('');
    this.promoSuccess.set(null);
    this.promoError.set(null);
  }

  /**
   * Fase A: prenota l'ordine. La merce resta riservata mentre il cliente paga,
   * e se non paga la libera il raccoglitore lato server.
   */
  private async reserveOrder(): Promise<boolean> {
    if (!this.selectedAddressId()) return false;
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.cart.placeOrder({
        items: this.cart.items().map(i => ({ variantId: i.variantId, quantity: i.quantity })),
        addressId: this.selectedAddressId()!,
        shippingMethod: this.shippingMethod(),
        promoCode: this.appliedPromoCode() ?? undefined,
        giftCardCode: this.appliedGiftCard() ?? undefined,
        notes: this.notes() || undefined,
        loyaltyPoints: this.loyaltyPointsToUse() || undefined,
      });
      this.pendingOrderId.set(result.orderId);
      this.serverAmountToPay.set(Number(result.amountToPay ?? 0));
      this.clientSecret = result.clientSecret ?? null;

      if (result.status === 'paid') {
        // Coperto interamente dal buono: non c'e' niente da incassare.
        this.completeOrder(result.total);
      }
      return true;
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Errore durante l\'ordine. Riprova.');
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  /** Monta il modulo della carta quando si entra nel passo di pagamento. */
  async preparePayment(container: HTMLElement): Promise<void> {
    if (this.paymentReady() || !this.clientSecret) return;
    const mounted = await this.stripe.mountPaymentElement(container, this.clientSecret);
    this.simulatedPayment.set(!mounted);
    this.paymentReady.set(true);
  }

  /**
   * Fase B: si paga. L'ordine diventa `paid` solo quando il fornitore conferma
   * al server, mai perche' il browser lo dice.
   */
  async payAndFinish(): Promise<void> {
    const orderId = this.pendingOrderId();
    if (this.loading() || !orderId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.simulatedPayment()) {
        await this.stripe.confirmSimulated(orderId);
      } else {
        const result = await this.stripe.confirmPayment();
        if (!result.ok) {
          this.error.set(result.error ?? 'Pagamento non riuscito');
          return;
        }
      }
      this.completeOrder(this.total());
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Pagamento non riuscito. Riprova.');
    } finally {
      this.loading.set(false);
    }
  }

  private completeOrder(total: number): void {
    this.cart.clear();
    this.stripe.reset();
    this.success.set({ orderId: this.pendingOrderId()!, total });
  }

  /** Verifica il buono e ne mostra il saldo, senza ancora scalarlo. */
  async applyGiftCard(): Promise<void> {
    const code = this.giftCardCode().trim();
    if (!code || this.giftCardLoading()) return;

    this.giftCardLoading.set(true);
    this.giftCardError.set(null);
    try {
      const res = await this.cart.checkGiftCard(code);
      this.giftCardBalance.set(res.balance);
      this.appliedGiftCard.set(res.code);
    } catch (err: any) {
      this.appliedGiftCard.set(null);
      this.giftCardBalance.set(0);
      this.giftCardError.set(err?.error?.message ?? 'Buono non valido.');
    } finally {
      this.giftCardLoading.set(false);
    }
  }

  removeGiftCard(): void {
    this.appliedGiftCard.set(null);
    this.giftCardBalance.set(0);
    this.giftCardCode.set('');
    this.giftCardError.set(null);
  }

  selectedAddress(): AddressData | undefined {
    return this.addresses().find(a => a.id === this.selectedAddressId());
  }

  formatPrice(v: number): string {
    return '€ ' + v.toFixed(2).replace('.', ',');
  }

  steps(): { key: CheckoutStep; label: string }[] {
    return stepsFor(this.payable());
  }

  stepIndex(): number {
    return this.steps().findIndex(s => s.key === this.step());
  }
}
