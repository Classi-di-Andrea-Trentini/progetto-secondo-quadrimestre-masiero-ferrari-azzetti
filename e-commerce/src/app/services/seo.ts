import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * Titolo, meta tag e dati strutturati delle pagine.
 *
 * Serve perché il sito è renderizzato lato server: se questi elementi vengono
 * scritti qui, arrivano già nell'HTML che riceve un motore di ricerca o l'anteprima
 * di un link su WhatsApp. Aggiungerli dopo, dal browser, non li fa vedere a nessuno
 * dei due.
 *
 * Il JSON-LD di un prodotto è quello che permette a Google di mostrare prezzo e
 * disponibilità direttamente nei risultati, invece del solo titolo.
 */

export interface ProductSeo {
  name: string;
  description: string | null;
  image: string | null;
  brand: string | null;
  sku: string | null;
  price: number;
  currency: string;
  inStock: boolean;
  url: string;
  rating?: { value: number; count: number } | null;
}

const JSON_LD_ID = 'product-structured-data';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  setPage(title: string, description: string, image?: string | null, url?: string): void {
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });

    // Open Graph: e' quello che leggono le anteprime dei link nelle chat.
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    if (image) this.meta.updateTag({ property: 'og:image', content: image });
    if (url) this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
  }

  setProduct(product: ProductSeo): void {
    const description =
      product.description?.slice(0, 300) ?? `${product.name} su Common Era.`;

    this.setPage(`${product.name} — Common Era`, description, product.image, product.url);
    this.meta.updateTag({ property: 'og:type', content: 'product' });

    this.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description,
      ...(product.image ? { image: [product.image] } : {}),
      ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      offers: {
        '@type': 'Offer',
        url: product.url,
        priceCurrency: product.currency,
        price: product.price.toFixed(2),
        availability: product.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      },
      ...(product.rating && product.rating.count > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: product.rating.value,
              reviewCount: product.rating.count,
            },
          }
        : {}),
    });
  }

  /** Toglie il blocco quando si lascia una scheda prodotto, per non lasciarlo su altre pagine. */
  clearJsonLd(): void {
    this.document.getElementById(JSON_LD_ID)?.remove();
  }

  private setJsonLd(data: unknown): void {
    this.clearJsonLd();
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // `</script>` dentro una descrizione chiuderebbe il tag in anticipo e
    // spezzerebbe la pagina: si neutralizza la sequenza, non tutto il contenuto.
    script.textContent = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');
    this.document.head.appendChild(script);
  }
}
