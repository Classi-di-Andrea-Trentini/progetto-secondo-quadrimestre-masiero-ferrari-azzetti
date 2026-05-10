import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CartService, AddressData } from '../../services/cart-service';
import { AuthService } from '../../services/auth';

type CheckoutStep = 'address' | 'shipping' | 'review';

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
  private readonly fb = inject(FormBuilder);

  step = signal<CheckoutStep>('address');
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

  ngOnInit() {
    if (this.cart.items().length === 0) {
      this.router.navigate(['/products']);
      return;
    }
    this.loadAddresses();
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

  nextStep() {
    if (this.step() === 'address') {
      if (!this.selectedAddressId()) return;
      this.step.set('shipping');
    } else if (this.step() === 'shipping') {
      this.step.set('review');
    }
  }

  prevStep() {
    if (this.step() === 'shipping') this.step.set('address');
    if (this.step() === 'review') this.step.set('shipping');
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

  async placeOrder() {
    if (this.loading() || !this.selectedAddressId()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.cart.placeOrder({
        items: this.cart.items().map(i => ({ variantId: i.variantId, quantity: i.quantity })),
        addressId: this.selectedAddressId()!,
        shippingMethod: this.shippingMethod(),
        promoCode: this.appliedPromoCode() ?? undefined,
        notes: this.notes() || undefined,
      });
      this.cart.clear();
      this.success.set({ orderId: result.orderId, total: result.total });
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Errore durante l\'ordine. Riprova.');
    } finally {
      this.loading.set(false);
    }
  }

  selectedAddress(): AddressData | undefined {
    return this.addresses().find(a => a.id === this.selectedAddressId());
  }

  formatPrice(v: number): string {
    return '€ ' + v.toFixed(2).replace('.', ',');
  }

  readonly steps: { key: CheckoutStep; label: string }[] = [
    { key: 'address', label: 'Indirizzo' },
    { key: 'shipping', label: 'Spedizione' },
    { key: 'review', label: 'Riepilogo' },
  ];

  stepIndex(): number {
    return this.steps.findIndex(s => s.key === this.step());
  }
}
