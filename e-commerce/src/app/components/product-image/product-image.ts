import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

/**
 * Immagine di prodotto con segnaposto disegnato.
 *
 * Copre i tre casi in cui il catalogo mostrerebbe un riquadro rotto:
 * url assente, url vuoto, url non raggiungibile (404 / host sparito).
 * L'host riempie il contenitore, quindi si usa dentro il box che ne
 * definisce proporzioni e dimensioni (`.card-image`, `.thumb`, `aspect-[3/4]`…).
 */
@Component({
  selector: 'app-product-image',
  standalone: true,
  templateUrl: './product-image.html',
  styleUrl: './product-image.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductImageComponent {
  private readonly source = signal<string | null>(null);
  protected readonly failed = signal(false);

  /** URL dell'immagine. Vuoto, null o non raggiungibile ⇒ segnaposto. */
  @Input()
  set src(value: string | null | undefined) {
    const next = value?.trim() ? value.trim() : null;
    if (next !== this.source()) {
      this.source.set(next);
      this.failed.set(false);
    }
  }
  get src(): string | null {
    return this.source();
  }

  /** Testo alternativo; usato anche come aria-label del segnaposto. */
  @Input() alt = '';

  /** object-fit dell'immagine reale. */
  @Input() fit: 'cover' | 'contain' = 'cover';

  @Input() loading: 'lazy' | 'eager' = 'lazy';

  protected readonly showFallback = computed(() => this.source() === null || this.failed());

  protected onError(): void {
    this.failed.set(true);
  }
}
