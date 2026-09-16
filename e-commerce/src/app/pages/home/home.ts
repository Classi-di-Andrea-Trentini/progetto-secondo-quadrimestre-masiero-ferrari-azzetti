import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ProductsService, ProductListItem } from '../../services/products.service';
import { ScrollStrip } from '../../components/scroll-strip/scroll-strip';

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
      percorso relativo, nessuna dipendenza da CDN esterne. Il fan carousel che
      un tempo ruotava su sei di queste illustrazioni e' sparito insieme al resto
      della sua sezione: la striscia di prodotti veri (<app-scroll-strip>) copre
      lo stesso ruolo editoriale con dati reali invece che segnaposto. */
  readonly heroHighlight = {
    image: '/media/catalogo/collezioni/capispalla.svg',
    title: 'Outerwear',
    subtitle: 'Layers for the shoulder seasons',
  };

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

  formatPrice(product: ProductListItem): string {
    const base = parseFloat(String(product.basePrice));
    const d = product.discounts[0];
    if (!d) return '€ ' + base.toFixed(2).replace('.', ',');
    const val = parseFloat(String(d.value));
    const eff = d.type === 'percentage' ? base * (1 - val / 100) : base - val;
    return '€ ' + eff.toFixed(2).replace('.', ',');
  }

  hasDiscount(product: ProductListItem): boolean {
    return product.discounts.length > 0;
  }
}
