import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ProductsService, ProductListItem } from '../../services/products.service';
import { ScrollStrip } from '../../components/scroll-strip/scroll-strip';
import { formatPrice as formatPriceShared } from '../../services/format-price';

@Component({
  selector: 'app-home',
  imports: [RouterModule, ScrollStrip],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  readonly auth = inject(AuthService);
  private readonly productsService = inject(ProductsService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly featuredProducts = signal<ProductListItem[]>([]);

  /** Immagine di apertura dell'hero (e-commerce/public/media/catalogo/collezioni):
      percorso relativo, nessuna dipendenza da CDN esterne. */
  readonly heroHighlight = {
    image: '/media/catalogo/collezioni/capispalla.svg',
    title: 'Outerwear',
    subtitle: 'Layers for the shoulder seasons',
  };

  /** Ventaglio (fan carousel) sopra la striscia di prodotti, come nel design
      (`bd179c77.jpg`, `CardCarousel.tsx`): sei illustrazioni interne, le
      stesse gia' usate quando il carosello era stato tolto e poi rivoluto da
      Alessio. Copy tradotto dall'italiano dell'epoca, non preso dal design
      (il componente Figma usa immagini segnaposto di Picsum, senza titoli). */
  readonly collectionHighlights = [
    {
      image: '/media/catalogo/collezioni/capispalla.svg',
      title: 'Outerwear',
      subtitle: 'Layers for the shoulder seasons',
    },
    {
      image: '/media/catalogo/collezioni/guardaroba-minimo.svg',
      title: 'Minimal Wardrobe',
      subtitle: 'Clean lines, pieces that last',
    },
    {
      image: '/media/catalogo/collezioni/neutri-da-sera.svg',
      title: 'Evening Neutrals',
      subtitle: 'Quiet tones for the occasion',
    },
    {
      image: '/media/catalogo/collezioni/sartoria-di-strada.svg',
      title: 'Street Tailoring',
      subtitle: 'Structured cuts, worn soft',
    },
    {
      image: '/media/catalogo/collezioni/linea-monocroma.svg',
      title: 'Monochrome Line',
      subtitle: 'Black and ivory, the two extremes',
    },
    {
      image: '/media/catalogo/collezioni/capsule-weekend.svg',
      title: 'Weekend Capsule',
      subtitle: 'What you reach for without thinking',
    },
  ];

  /** Indice della card in primo piano. Le frecce lo cambiano; non c'e' nessun
      collegamento con lo scroll della pagina (a differenza di <app-scroll-strip>
      qui sotto, che invece si muove SOLO con lo scroll verticale). */
  readonly activeSlide = signal(0);

  /** Le prime due voci sono il copy letterale dei banner del design (design-code.txt,
      blocchi CollectionBanner e SaleBanner). La terza non ha un equivalente nel
      design: e' una funzionalita' del sito (accesso account) che non avrebbe senso
      togliere solo perche' il file Figma non la mostra. */
  readonly promoShowcase = [
    {
      label: 'Seasonal Sale',
      title: 'Up to',
      highlight: '-60%',
      description:
        'An exclusive selection of essential pieces at special prices. For a limited time only.',
      notes: ['Limited-time prices', 'Best sellers', '48h delivery'],
      cta: 'Shop the Sale',
      link: '/products',
    },
    {
      label: 'New Season',
      title: 'New Collection',
      description:
        'Essentiality, refined proportions and carefully selected materials. A modern vision of everyday style.',
      notes: ['Current lines', 'Chosen fabrics', 'Timeless palette'],
      cta: 'Discover More',
      link: '/products',
    },
    {
      label: 'For account holders',
      title: 'Early access',
      description:
        'Sign in to see new arrivals first, save your wishlist and use your loyalty points.',
      notes: ['Member-only offers', 'Wishlist', 'Loyalty points'],
      cta: 'Go to account',
      link: '/me',
      loginLink: '/login',
    },
  ];

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.productsService.getProducts({ sortBy: 'newest', limit: 8 }).subscribe({
      next: (res) => this.featuredProducts.set(res.data),
    });
  }

  getCoverImage(product: ProductListItem): string {
    return product.images.find((i) => i.isCover)?.url ?? product.images[0]?.url ?? '';
  }

  // Il calcolo del prezzo scontato resta qui (e' logica della card prodotto,
  // non formattazione); la resa in stringa (€120.00) e' centralizzata in
  // services/format-price.ts.
  formatPrice(product: ProductListItem): string {
    const base = parseFloat(String(product.basePrice));
    const d = product.discounts[0];
    if (!d) return formatPriceShared(base);
    const val = parseFloat(String(d.value));
    const eff = d.type === 'percentage' ? base * (1 - val / 100) : base - val;
    return formatPriceShared(eff);
  }

  hasDiscount(product: ProductListItem): boolean {
    return product.discounts.length > 0;
  }

  // ─── Ventaglio (fan carousel) ───────────────────────────────────────────
  // Stesso schema del design (CardCarousel.tsx): un indice attivo, le due
  // card immediatamente prima/dopo restano visibili ruotate ai lati, le
  // altre spariscono. Qui con il wraparound modulo, perche' le voci sono sei
  // e non tre come nel componente originale.

  prevSlide(): void {
    const total = this.collectionHighlights.length;
    this.activeSlide.update((value) => (value - 1 + total) % total);
  }

  nextSlide(): void {
    const total = this.collectionHighlights.length;
    this.activeSlide.update((value) => (value + 1) % total);
  }

  isActive(index: number): boolean {
    return this.slideOffset(index) === 0;
  }

  isLeft(index: number): boolean {
    return this.slideOffset(index) === -1;
  }

  isRight(index: number): boolean {
    return this.slideOffset(index) === 1;
  }

  isHidden(index: number): boolean {
    return !this.isActive(index) && !this.isLeft(index) && !this.isRight(index);
  }

  /** -1/0/+1 rispetto alla card attiva, con wraparound (l'ultima voce e'
      "a sinistra" della prima). Oltre quel raggio la card e' nascosta:
      il design ne mostra solo tre insieme, qui idem anche con sei voci. */
  private slideOffset(index: number): number {
    const total = this.collectionHighlights.length;
    let offset = index - this.activeSlide();
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    return offset;
  }
}
