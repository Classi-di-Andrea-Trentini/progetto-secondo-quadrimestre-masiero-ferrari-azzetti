import { Injectable, inject, signal, computed, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CartItem {
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  image: string;
  price: number;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly STORAGE_KEY = 'common_era_cart';
  private readonly platformId = inject(PLATFORM_ID);

  readonly isOpen = signal(false);
  private readonly _items = signal<CartItem[]>([]);

  readonly items = this._items.asReadonly();
  readonly itemCount = computed(() =>
    this._items().reduce((sum, i) => sum + i.quantity, 0),
  );
  readonly subtotal = computed(() =>
    this._items().reduce((sum, i) => sum + i.price * i.quantity, 0),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) this._items.set(JSON.parse(raw));
      } catch {}
    }

    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._items()));
      }
    });
  }

  open() { this.isOpen.set(true); }
  close() { this.isOpen.set(false); }
  toggle() { this.isOpen.update(v => !v); }

  addItem(item: Omit<CartItem, 'quantity'>) {
    this._items.update(list => {
      const idx = list.findIndex(
        i => i.productId === item.productId && i.variantId === item.variantId,
      );
      if (idx !== -1) {
        const updated = [...list];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...list, { ...item, quantity: 1 }];
    });
  }

  removeItem(productId: string, variantId: string | null) {
    this._items.update(list =>
      list.filter(i => !(i.productId === productId && i.variantId === variantId)),
    );
  }

  updateQuantity(productId: string, variantId: string | null, qty: number) {
    if (qty <= 0) {
      this.removeItem(productId, variantId);
      return;
    }
    this._items.update(list =>
      list.map(i =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity: qty }
          : i,
      ),
    );
  }

  clear() {
    this._items.set([]);
  }
}
