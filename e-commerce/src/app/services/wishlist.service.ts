import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductListItem } from './products.service';

const API_URL = 'http://localhost:3000';

export interface WishlistItem {
  id: string;
  productId: string;
  addedAt: string;
  product: ProductListItem;
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private http = inject(HttpClient);

  // Set of product IDs in wishlist — loaded once on demand
  private _savedIds = signal<Set<string>>(new Set());
  private _items = signal<WishlistItem[]>([]);
  private _loaded = false;

  readonly savedIds = this._savedIds.asReadonly();
  readonly items = this._items.asReadonly();

  isSaved(productId: string) {
    return this._savedIds().has(productId);
  }

  async loadIds() {
    if (this._loaded) return;
    try {
      const ids = await firstValueFrom(
        this.http.get<string[]>(`${API_URL}/wishlist/ids`, { withCredentials: true }),
      );
      this._savedIds.set(new Set(ids));
      this._loaded = true;
    } catch {
      // Non loggato — ignora
    }
  }

  async loadItems() {
    try {
      const items = await firstValueFrom(
        this.http.get<WishlistItem[]>(`${API_URL}/wishlist`, { withCredentials: true }),
      );
      this._items.set(items);
      this._savedIds.set(new Set(items.map(i => i.productId)));
      this._loaded = true;
    } catch {
      this._items.set([]);
    }
  }

  async toggle(productId: string) {
    try {
      const res = await firstValueFrom(
        this.http.post<{ saved: boolean }>(
          `${API_URL}/wishlist/${productId}/toggle`,
          {},
          { withCredentials: true },
        ),
      );
      const cur = new Set(this._savedIds());
      if (res.saved) {
        cur.add(productId);
      } else {
        cur.delete(productId);
        // Rimuovi anche dalla lista items se caricata
        this._items.update(list => list.filter(i => i.productId !== productId));
      }
      this._savedIds.set(cur);
      return res.saved;
    } catch {
      return null;
    }
  }

  reset() {
    this._savedIds.set(new Set());
    this._items.set([]);
    this._loaded = false;
  }
}
