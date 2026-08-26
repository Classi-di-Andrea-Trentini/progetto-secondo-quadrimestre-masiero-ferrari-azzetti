import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ProductsService, ProductListItem } from '../../services/products.service';

@Component({
  selector: 'app-home',
  imports: [RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  readonly auth = inject(AuthService);
  private readonly productsService = inject(ProductsService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly featuredProducts = signal<ProductListItem[]>([]);
  readonly collectionHighlights = [
    {
      image:
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
      title: 'Capispalla',
      subtitle: 'Strati per le mezze stagioni',
    },
    {
      image:
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
      title: 'Guardaroba minimo',
      subtitle: 'Linee pulite, capi che restano',
    },
    {
      image:
        'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80',
      title: 'Neutri da sera',
      subtitle: 'Toni sobri per le occasioni',
    },
    {
      image:
        'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80',
      title: 'Sartoria di strada',
      subtitle: 'Tagli costruiti, portati morbidi',
    },
    {
      image:
        'https://images.unsplash.com/photo-1463100099107-aa0980c362e6?auto=format&fit=crop&w=1200&q=80',
      title: 'Linea monocroma',
      subtitle: 'Nero e avorio, i due estremi',
    },
    {
      image:
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80',
      title: 'Capsule weekend',
      subtitle: 'Quello che metti senza pensarci',
    },
  ];

  readonly activeSlide = signal(0);

  /** Il primo blocco e' l'ancora della fascia; gli altri due la accompagnano. */
  readonly promoShowcase = [
    {
      label: 'Saldi di stagione',
      title: 'Fino a',
      highlight: '−60%',
      description:
        'Una selezione di capi essenziali a prezzo ridotto, finché durano le taglie.',
      notes: ['Prezzi a tempo', 'I più venduti', 'Spedizione in 48h'],
      cta: 'Vai ai saldi',
      link: '/products',
    },
    {
      label: 'Nuova stagione',
      title: 'La collezione',
      description:
        'Proporzioni sobrie e materiali scelti uno per uno, pensati per tutti i giorni.',
      notes: ['Linee attuali', 'Tessuti scelti', 'Palette senza tempo'],
      cta: 'Scopri',
      link: '/products',
    },
    {
      label: 'Per chi ha un account',
      title: 'Accesso in anteprima',
      description:
        'Entra per vedere gli arrivi in anticipo, salvare la lista dei desideri e usare i tuoi punti.',
      notes: ['Offerte riservate', 'Lista dei desideri', 'Punti fedeltà'],
      cta: 'Vai all\'account',
      link: '/me',
      loginLink: '/login',
    },
  ];

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.productsService.getProducts({ sortBy: 'newest', limit: 4 }).subscribe({
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

  prevSlide(): void {
    const total = this.collectionHighlights.length;
    this.activeSlide.update((value) => (value - 1 + total) % total);
  }

  nextSlide(): void {
    const total = this.collectionHighlights.length;
    this.activeSlide.update((value) => (value + 1) % total);
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
  }

  isActive(index: number): boolean {
    return this.getSlideOffset(index) === 0;
  }

  isLeft(index: number): boolean {
    return this.getSlideOffset(index) === -1;
  }

  isRight(index: number): boolean {
    return this.getSlideOffset(index) === 1;
  }

  isHidden(index: number): boolean {
    return !this.isActive(index) && !this.isLeft(index) && !this.isRight(index);
  }

  private getSlideOffset(index: number): number {
    const total = this.collectionHighlights.length;
    let offset = index - this.activeSlide();

    if (offset > total / 2) {
      offset -= total;
    }

    if (offset < -total / 2) {
      offset += total;
    }

    return offset;
  }

}
