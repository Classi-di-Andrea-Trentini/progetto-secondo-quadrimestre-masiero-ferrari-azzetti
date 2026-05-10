import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';

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

  // ─── Cart state ────────────────────────────────────────────
  readonly items = signal<CartItem[]>([]);
  readonly isOpen = signal(false);

  readonly itemCount = computed(() => this.items().reduce((s, i) => s + i.quantity, 0));
  readonly subtotal = computed(() => this.items().reduce((s, i) => s + i.unitPrice * i.quantity, 0));

  open() { this.isOpen.set(true); }
  close() { this.isOpen.set(false); }
  toggle() { this.isOpen.update(v => !v); }

  addItem(item: CartItem) {
    this.items.update(list => {
      const existing = list.find(i => i.variantId === item.variantId);
      if (existing) {
        return list.map(i => i.variantId === item.variantId
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
        );
      }
      return [...list, item];
    });
  }

  removeItem(variantId: string) {
    this.items.update(list => list.filter(i => i.variantId !== variantId));
  }

  updateQuantity(variantId: string, qty: number) {
    if (qty <= 0) {
      this.removeItem(variantId);
      return;
    }
    this.items.update(list => list.map(i => i.variantId === variantId ? { ...i, quantity: qty } : i));
  }

  clear() {
    this.items.set([]);
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

  placeOrder(payload: {
    items: { variantId: string; quantity: number }[];
    addressId: string;
    shippingMethod?: 'standard' | 'express';
    promoCode?: string;
    notes?: string;
  }): Promise<{ orderId: string; total: number; status: string }> {
    return firstValueFrom(
      this.http.post<any>(`${API_URL}/checkout`, payload, { withCredentials: true })
    );
  }
}
