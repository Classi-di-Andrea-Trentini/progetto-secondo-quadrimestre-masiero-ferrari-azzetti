import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-home',
  imports: [RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly auth = inject(AuthService);
  readonly collectionHighlights = [
    {
      image:
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
      title: 'Outerwear Edit',
      subtitle: 'Layering pieces for transitional days',
    },
    {
      image:
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
      title: 'Minimal Wardrobe',
      subtitle: 'Clean silhouettes and timeless essentials',
    },
    {
      image:
        'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80',
      title: 'Evening Neutrals',
      subtitle: 'Elevated tones for refined occasions',
    },
    {
      image:
        'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80',
      title: 'Street Tailoring',
      subtitle: 'Structured fits with relaxed attitude',
    },
    {
      image:
        'https://images.unsplash.com/photo-1463100099107-aa0980c362e6?auto=format&fit=crop&w=1200&q=80',
      title: 'Monochrome Line',
      subtitle: 'Black and ivory staples reimagined',
    },
    {
      image:
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80',
      title: 'Weekend Capsule',
      subtitle: 'Effortless pieces for off-duty looks',
    },
  ];

  readonly activeSlide = signal(0);

  readonly promoShowcase = [
    {
      label: 'new season',
      title: 'New Collection',
      description:
        'Essential pieces with refined proportions and carefully selected materials for every day.',
      notes: ['Modern silhouettes', 'Premium fabrics', 'Timeless palette'],
      cta: 'Discover More',
      link: '/products',
    },
    {
      label: 'seasonal sale',
      title: 'Up to',
      highlight: '-60%',
      description:
        'An exclusive selection of essential items at special prices for a limited time.',
      notes: ['Limited-time prices', 'Best-selling edits', 'Fast worldwide shipping'],
      cta: 'Shop the Sale',
      link: '/products',
    },
    {
      label: 'members benefits',
      title: 'Early Access',
      description:
        'Sign in to preview upcoming drops, save wishlists, and unlock private offers.',
      notes: ['Private offers', 'Wishlist sync', 'Early product drops'],
      cta: 'Go to Account',
      link: '/me',
      loginLink: '/login',
    },
  ];

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
