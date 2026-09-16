import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { API_URL } from './api.config';

export interface PaymentConfig {
  enabled: boolean;
  publishableKey: string;
}

/**
 * Il dialogo con Stripe, tutto in un posto.
 *
 * Stripe.js si carica **solo** quando serve davvero: e' uno script di terze
 * parti, e tirarlo dentro a ogni visita di un catalogo che nessuno comprera'
 * costa a chi guarda e non serve a noi. Se le chiavi non ci sono, questa classe
 * non carica niente e il checkout prende il percorso simulato.
 */
@Injectable({ providedIn: 'root' })
export class StripeService {
  private readonly http = inject(HttpClient);

  private config: PaymentConfig | null = null;
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;

  /** Letta una volta sola: non cambia mentre il negozio e' acceso. */
  async paymentConfig(): Promise<PaymentConfig> {
    if (!this.config) {
      this.config = await firstValueFrom(
        this.http.get<PaymentConfig>(`${API_URL}/payments/config`, { withCredentials: true }),
      );
    }
    return this.config;
  }

  /**
   * Monta il Payment Element nel contenitore indicato.
   * @returns false se l'incasso non e' reale, cioe' se non c'e' niente da montare
   */
  async mountPaymentElement(container: HTMLElement, clientSecret: string): Promise<boolean> {
    const config = await this.paymentConfig();
    if (!config.enabled || !config.publishableKey) return false;

    if (!this.stripe) {
      // Import dinamico: senza chiavi il modulo non entra nemmeno nel bundle
      // che il browser esegue.
      const { loadStripe } = await import('@stripe/stripe-js');
      this.stripe = await loadStripe(config.publishableKey);
    }
    if (!this.stripe) return false;

    this.elements = this.stripe.elements({
      clientSecret,
      // L'aspetto segue i token del negozio: un modulo di pagamento che sembra
      // di un altro sito e' il momento in cui la gente smette di fidarsi.
      appearance: { theme: 'flat', variables: { colorPrimary: '#17171b', borderRadius: '0px' } },
    });
    this.elements.create('payment').mount(container);
    return true;
  }

  /**
   * Conferma il pagamento. Non reindirizza se non e' indispensabile
   * (`if_required`): i pagamenti senza 3D Secure restano dentro la pagina.
   */
  async confirmPayment(): Promise<{ ok: boolean; error?: string }> {
    if (!this.stripe || !this.elements) {
      return { ok: false, error: 'Modulo di pagamento non pronto' };
    }
    const result = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });
    if (result.error) {
      return { ok: false, error: result.error.message ?? 'Pagamento non riuscito' };
    }
    return { ok: true };
  }

  /**
   * Percorso senza chiavi: l'ordine si conferma passando dallo **stesso**
   * webhook del percorso vero, non da una scorciatoia che lo dichiara pagato.
   */
  async confirmSimulated(orderId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API_URL}/payments/simulate/${orderId}`, {}, { withCredentials: true }),
    );
  }

  reset(): void {
    this.elements = null;
  }
}
