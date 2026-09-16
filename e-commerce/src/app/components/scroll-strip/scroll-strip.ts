import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Striscia di card che trasla in orizzontale mentre la pagina scorre in verticale.
 *
 * La sezione e' "incollata" (position: sticky) per un tratto di scroll verticale
 * pari a `strip.scrollWidth - viewport`: mentre quel tratto viene consumato, la
 * riga interna trasla della stessa quantita' in orizzontale. E' un componente
 * riusabile con content projection: chi lo usa ci mette dentro le proprie card
 * (`<app-scroll-strip><div class="card">...</div>...</app-scroll-strip>`).
 *
 * Il calcolo (progress -> offset) vive in metodi puri (`applyProgress`,
 * `setTravel`) cosi' i test non devono simulare uno scroll vero: chiamano
 * direttamente i metodi. Lo scroll vero, gestito in `afterNextRender`, si
 * limita a invocarli.
 */
@Component({
  selector: 'app-scroll-strip',
  standalone: true,
  templateUrl: './scroll-strip.html',
  styleUrl: './scroll-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollStrip {
  readonly offset = signal(0);

  private travel = 0;
  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly strip = viewChild.required<ElementRef<HTMLElement>>('strip');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      // jsdom (test) non implementa matchMedia, ed e' lo stesso identico caso
      // limite di un ambiente senza `window` come il server durante SSR: se
      // manca, l'effetto non ha senso (non c'e' uno scroll reale da leggere)
      // quindi si esce subito invece di far esplodere il componente.
      if (typeof matchMedia !== 'function') return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!matchMedia('(min-width: 1024px)').matches) return;

      this.measure();
      const onScroll = () => this.applyProgress(this.progress());
      const onResize = () => {
        this.measure();
        onScroll();
      };
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onResize);
      });
      onScroll();
    });
  }

  setTravel(px: number): void {
    this.travel = Math.max(0, px);
  }

  measure(): void {
    const strip = this.strip().nativeElement;
    this.setTravel(strip.scrollWidth - strip.clientWidth);
    this.section().nativeElement.style.setProperty('--travel', `${this.travel}px`);
  }

  /** 0 = la sezione entra incollata, 1 = la lascia. */
  progress(): number {
    const box = this.section().nativeElement.getBoundingClientRect();
    return -box.top / (box.height - innerHeight);
  }

  applyProgress(p: number): void {
    const clamped = Math.min(1, Math.max(0, p));
    // A progress 0 il calcolo produce -0 (negazione di Math.round(0)): Vitest
    // confronta con Object.is (a differenza di Jasmine/Karma) e -0 !== 0,
    // quindi il segnale deve restare in +0 quando il valore e' zero.
    this.offset.set(-Math.round(this.travel * clamped) || 0);
  }
}
