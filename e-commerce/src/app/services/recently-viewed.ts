import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';

/**
 * I prodotti guardati di recente.
 *
 * La cronologia sta nel browser e non sul server: è una comodità, non un dato che
 * valga la pena legare a un account — e così funziona anche da sloggati, che è
 * proprio quando serve di più. Sul server si chiedono solo i dati aggiornati dei
 * prodotti, perché prezzo e disponibilità possono essere cambiati da ieri.
 */

export interface RecentProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: string | number;
  images: { url: string }[];
  discounts: { type: string; value: string | number; label: string | null }[];
}

const STORAGE_KEY = 'commonera.recently-viewed';
/** Oltre una decina la fila diventa un secondo catalogo, non un promemoria. */
const MAX_ITEMS = 10;

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly products = signal<RecentProduct[]>([]);

  /** Registra una visita, mettendo il prodotto in cima e senza duplicarlo. */
  remember(productId: string): void {
    if (!isPlatformBrowser(this.platformId) || !productId) return;
    const ids = [productId, ...this.readIds().filter((id) => id !== productId)].slice(0, MAX_ITEMS);
    this.writeIds(ids);
  }

  /**
   * Carica i prodotti visti, escludendo quello aperto adesso: mostrarlo fra i
   * "visti di recente" mentre lo si sta guardando non serve a nessuno.
   */
  async load(excludeId?: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const ids = this.readIds().filter((id) => id !== excludeId);
    if (ids.length === 0) {
      this.products.set([]);
      return;
    }

    try {
      const products = await firstValueFrom(
        this.http.get<RecentProduct[]>(`${API_URL}/products/by-ids?ids=${ids.join(',')}`),
      );
      this.products.set(products ?? []);

      // I prodotti spariti dal catalogo non tornano piu': si tolgono dalla
      // cronologia, altrimenti restano a occupare posti per sempre.
      const alive = new Set((products ?? []).map((product) => product.id));
      const survived = this.readIds().filter((id) => alive.has(id) || id === excludeId);
      if (survived.length !== this.readIds().length) this.writeIds(survived);
    } catch {
      this.products.set([]);
    }
  }

  clear(): void {
    this.writeIds([]);
    this.products.set([]);
  }

  private readIds(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private writeIds(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Storage pieno o in incognito: la cronologia vale per la sessione e basta.
    }
  }
}
