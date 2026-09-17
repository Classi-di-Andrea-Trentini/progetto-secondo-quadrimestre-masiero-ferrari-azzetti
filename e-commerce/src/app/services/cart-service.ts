import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';
import { AuthService } from './auth';

/** Chiave del carrello dell'ospite: prima non esisteva e un refresh lo svuotava. */
const GUEST_CART_KEY = 'commonera.guest-cart';

/** Forma della risposta di `/api/cart`. */
interface ServerCart {
  items: (CartItem & { inStock: boolean; stockQty: number })[];
  itemCount: number;
  subtotal: number;
  savings: number;
  hasIssues: boolean;
}

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  slug: string;
  variantLabel: string; // es. "Nero / M"
  size: string | null;
  color: string | null;
  colorHex: string | null;
  imageUrl: string;
  unitPrice: number;        // prezzo scontato
  originalPrice: number;    // prezzo base
  quantity: number;
}

export interface AddressData {
  id: string;
  fullName: string;
  phone: string | null;
  street: string;
  street2: string | null;
  city: string;
  province: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
  label?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  // ─── Cart state ────────────────────────────────────────────
  readonly items = signal<CartItem[]>([]);
  readonly isOpen = signal(false);
  /** Righe che il magazzino non copre piu': il checkout va bloccato finche' ci sono. */
  readonly hasIssues = signal(false);
  readonly isSyncing = signal(false);
  /**
   * Falso finche' il carrello non e' stato caricato almeno una volta.
   *
   * Serve a chi deve decidere qualcosa in base al contenuto: da quando il carrello
   * vive sul server arriva **dopo** il primo render, e il checkout che controllava
   * subito `items().length === 0` rimbalzava sul catalogo anche con il carrello
   * pieno.
   */
  readonly ready = signal(false);

  readonly itemCount = computed(() => this.items().reduce((s, i) => s + i.quantity, 0));
  readonly subtotal = computed(() => this.items().reduce((s, i) => s + i.unitPrice * i.quantity, 0));

  /**
   * Dove vive il carrello.
   *
   * Loggato: sul server, cosi' segue l'utente fra telefono e computer e resta
   * recuperabile se lo abbandona. Sloggato: in `localStorage`, perche' prima
   * stava **solo in memoria** e bastava un refresh per perderlo. Al login i due
   * vengono fusi, altrimenti chi riempie il carrello e poi accede se lo ritrova
   * vuoto — il modo piu' diretto per perdere una vendita.
   */
  private get isServerCart(): boolean {
    return this.auth.isAuthenticated();
  }

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.restoreLocal();
    // Se l'autenticazione e' ancora in corso il carrello non e' definitivo: lo
    // diventa quando l'effetto qui sotto ha fatto il suo giro.
    if (!this.auth.isLoading()) this.ready.set(true);

    // `isAuthenticated` diventa vero solo dopo la chiamata a /auth/me, quindi la
    // fusione non puo' avvenire nel costruttore: serve reagire al cambiamento.
    let wasAuthenticated = false;
    effect(() => {
      const loading = this.auth.isLoading();
      const authenticated = this.auth.isAuthenticated();

      // Finche' /auth/me e' in volo non c'e' niente da decidere: dichiarare
      // pronto adesso mostrerebbe il carrello locale a chi ha quello sul server.
      if (loading) return;

      if (authenticated === wasAuthenticated) {
        // L'identita' non e' cambiata, ma l'autenticazione si e' conclusa. Per un
        // ospite questo e' l'**unico** momento in cui il carrello puo' dirsi
        // pronto: `isAuthenticated` resta falso dall'inizio alla fine, e senza
        // questo ramo il drawer resterebbe sullo scheletro per sempre.
        this.ready.set(true);
        return;
      }

      wasAuthenticated = authenticated;
      if (authenticated) void this.adoptLocalCart().finally(() => this.ready.set(true));
      else {
        this.restoreLocal();
        this.ready.set(true);
      }
    });
  }

  open() { this.isOpen.set(true); }
  close() { this.isOpen.set(false); }
  toggle() { this.isOpen.update(v => !v); }

  async addItem(item: CartItem): Promise<void> {
    if (!this.isServerCart) {
      this.items.update(list => {
        const existing = list.find(i => i.variantId === item.variantId);
        return existing
          ? list.map(i => i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i)
          : [...list, item];
      });
      this.persistLocal();
      return;
    }

    await this.call(() =>
      this.http.post<ServerCart>(`${API_URL}/cart/items`,
        { variantId: item.variantId, quantity: item.quantity },
        { withCredentials: true }),
    );
  }

  async removeItem(variantId: string): Promise<void> {
    if (!this.isServerCart) {
      this.items.update(list => list.filter(i => i.variantId !== variantId));
      this.persistLocal();
      return;
    }

    await this.call(() =>
      this.http.delete<ServerCart>(`${API_URL}/cart/items/${variantId}`, { withCredentials: true }),
    );
  }

  async updateQuantity(variantId: string, qty: number): Promise<void> {
    if (qty <= 0) return this.removeItem(variantId);

    if (!this.isServerCart) {
      this.items.update(list => list.map(i => i.variantId === variantId ? { ...i, quantity: qty } : i));
      this.persistLocal();
      return;
    }

    await this.call(() =>
      this.http.patch<ServerCart>(`${API_URL}/cart/items/${variantId}`,
        { quantity: qty }, { withCredentials: true }),
    );
  }

  async clear(): Promise<void> {
    if (!this.isServerCart) {
      this.items.set([]);
      this.persistLocal();
      return;
    }

    await this.call(() => this.http.delete<ServerCart>(`${API_URL}/cart`, { withCredentials: true }));
  }

  /** Rilegge il carrello dal server: i prezzi e le scorte possono essere cambiati. */
  async reload(): Promise<void> {
    if (!this.isServerCart) return;
    await this.call(() => this.http.get<ServerCart>(`${API_URL}/cart`, { withCredentials: true }));
  }

  // ─── Sincronizzazione ──────────────────────────────────────

  /** Porta sul server il carrello riempito da sloggato, poi svuota quello locale. */
  private async adoptLocalCart(): Promise<void> {
    const local = this.items();
    try {
      if (local.length > 0) {
        await this.call(() =>
          this.http.post<ServerCart>(`${API_URL}/cart/merge`,
            { items: local.map(i => ({ variantId: i.variantId, quantity: i.quantity })) },
            { withCredentials: true }),
        );
        this.clearLocalStorage();
      } else {
        await this.reload();
      }
    } catch {
      // Se il server non risponde si tiene quello locale: meglio un carrello
      // vecchio che un carrello vuoto davanti all'utente.
    }
  }

  private async call(request: () => Observable<ServerCart>): Promise<void> {
    this.isSyncing.set(true);
    try {
      this.applyServerCart(await firstValueFrom(request()));
    } finally {
      this.isSyncing.set(false);
    }
  }

  private applyServerCart(cart: ServerCart): void {
    this.items.set(
      (cart.items ?? []).map(item => ({
        variantId: item.variantId,
        productId: item.productId,
        productName: item.productName,
        slug: item.slug,
        variantLabel: item.variantLabel ?? '',
        size: item.size,
        color: item.color,
        colorHex: item.colorHex,
        imageUrl: item.imageUrl ?? '',
        unitPrice: item.unitPrice,
        originalPrice: item.originalPrice,
        quantity: item.quantity,
      })),
    );
    this.hasIssues.set(Boolean(cart.hasIssues));
  }

  // ─── Carrello dell'ospite ──────────────────────────────────

  private restoreLocal(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem(GUEST_CART_KEY);
      this.items.set(raw ? JSON.parse(raw) : []);
    } catch {
      this.items.set([]);
    }
    this.hasIssues.set(false);
  }

  private persistLocal(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(this.items()));
    } catch {
      // Storage pieno o navigazione in incognito: il carrello vale per la sessione.
    }
  }

  private clearLocalStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.removeItem(GUEST_CART_KEY);
    } catch {
      // Niente da fare, e non e' un errore che riguardi l'utente.
    }
  }

  // ─── Addresses (API) ───────────────────────────────────────

  getAddresses(): Promise<AddressData[]> {
    return firstValueFrom(
      this.http.get<AddressData[]>(`${API_URL}/addresses`, { withCredentials: true })
    );
  }

  createAddress(data: Omit<AddressData, 'id' | 'isDefault' | 'label'>): Promise<AddressData> {
    return firstValueFrom(
      this.http.post<AddressData>(`${API_URL}/addresses`, data, { withCredentials: true })
    );
  }

  // ─── Promo code validation ──────────────────────────────────

  validatePromo(code: string, orderAmount: number): Promise<{ discountValue: number; promoCodeId: string; message: string }> {
    return firstValueFrom(
      this.http.post<any>(
        `${API_URL}/promo-codes/validate`,
        { code, orderAmount },
        { withCredentials: true }
      )
    );
  }

  // ─── Checkout ──────────────────────────────────────────────

  /** Saldo e validita' di un buono, prima di confermare l'ordine. */
  checkGiftCard(code: string): Promise<{ code: string; balance: number; expiresAt: string | null }> {
    return firstValueFrom(
      this.http.get<any>(`${API_URL}/gift-cards/${encodeURIComponent(code)}`, { withCredentials: true }),
    );
  }

  loyaltySummary(): Promise<{ balance: number; value: number; minRedeemable: number; redeemable: boolean }> {
    return firstValueFrom(
      this.http.get<any>(`${API_URL}/loyalty`, { withCredentials: true }),
    );
  }

  placeOrder(payload: {
    items: { variantId: string; quantity: number }[];
    addressId: string;
    shippingMethod?: 'standard' | 'express';
    promoCode?: string;
    giftCardCode?: string;
    loyaltyPoints?: number;
    notes?: string;
  }): Promise<{
    orderId: string;
    total: number;
    /** `pending` finche' il fornitore non conferma, `paid` se non c'era nulla da incassare. */
    status: string;
    amountToPay: number;
    /** Presente solo quando c'e' davvero qualcosa da incassare. */
    clientSecret?: string;
  }> {
    return firstValueFrom(
      this.http.post<any>(`${API_URL}/checkout`, payload, { withCredentials: true })
    );
  }

  /**
   * Annulla una prenotazione non ancora pagata. Serve a chi torna indietro nel
   * checkout per cambiare qualcosa: senza, resterebbe in giro un ordine
   * `pending` che tiene riservata la merce fino al passaggio del raccoglitore.
   */
  cancelPendingOrder(orderId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.patch(`${API_URL}/orders/${orderId}/cancel`, {}, { withCredentials: true }),
    );
  }
}
