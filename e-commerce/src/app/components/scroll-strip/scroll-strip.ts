import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
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
 * riga interna trasla della stessa quantita' in orizzontale. `viewport` e' il
 * `clientWidth` del contenitore sticky (`#sticky`), MAI quello della rail
 * stessa (`#strip`): la rail e' un flex item senza vincoli propri di
 * larghezza, quindi il suo `clientWidth` coincide sempre col suo
 * `scrollWidth` (vedi il commento su `measure()` piu' sotto) e misurarla
 * contro se stessa produce sempre `travel = 0`. E' un componente riusabile
 * con content projection: chi lo usa ci mette dentro le proprie card
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
  /**
   * Etichetta (in inglese, come il resto del copy del sito) letta dagli screen
   * reader sul contenitore `.scroll-strip__sticky`: e' l'elemento che sotto `lg`
   * e con `prefers-reduced-motion` diventa davvero scorrevole (overflow-x:auto),
   * quindi ha bisogno di un ruolo dichiarato. Chi usa il componente puo'
   * sovrascriverla per descrivere il contenuto proiettato.
   */
  @Input() ariaLabel = 'Scrollable image strip';

  readonly offset = signal(0);

  private travel = 0;
  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly strip = viewChild.required<ElementRef<HTMLElement>>('strip');
  /**
   * `.scroll-strip__sticky`: e' il contenitore con `overflow: hidden` che da'
   * davvero la larghezza del viewport. `strip` (`.scroll-strip__rail`) e'
   * invece un flex item senza vincoli di larghezza propri dentro un flex
   * container che riempie il genitore: siccome le sue card hanno `shrink-0`,
   * il minimo di contenuto della rail supera sempre lo spazio disponibile, e
   * flexbox non lascia mai un elemento restringersi sotto il proprio "minimo
   * automatico" (il famoso `min-width: auto` implicito). Risultato: se si
   * misura la rail contro se stessa, `scrollWidth` e `clientWidth` coincidono
   * sempre — sono la stessa identica larghezza di contenuto — e `travel`
   * risulta sempre 0, a prescindere da quante card ci sono. Misurando invece
   * contro il contenitore sticky (che NON cresce col contenuto, ha
   * `overflow: hidden` e la sua larghezza e' vincolata dalla sezione/viewport)
   * si ottiene la differenza vera tra "quanto e' largo il contenuto" e
   * "quanto spazio c'e' per vederlo".
   */
  private readonly sticky = viewChild.required<ElementRef<HTMLElement>>('sticky');
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
    const viewport = this.sticky().nativeElement;
    this.setTravel(strip.scrollWidth - viewport.clientWidth);
    this.section().nativeElement.style.setProperty('--travel', `${this.travel}px`);
  }

  /** 0 = la sezione entra incollata, 1 = la lascia. */
  progress(): number {
    const box = this.section().nativeElement.getBoundingClientRect();
    return -box.top / (box.height - innerHeight);
  }

  applyProgress(p: number): void {
    const clamped = Math.min(1, Math.max(0, p));
    // Il `|| 0` normalizza due casi, non uno solo:
    // 1) a progress 0 il calcolo produce -0 (negazione di Math.round(0)): Vitest
    //    confronta con Object.is (a differenza di Jasmine/Karma) e -0 !== 0,
    //    quindi il segnale deve restare in +0 quando il valore e' zero;
    // 2) quando `travel` e' 0 (sezione non ancora misurata), `progress()` divide
    //    per `box.height - innerHeight`, che vale 0 proprio perche' l'altezza
    //    della sezione e' `100vh + travel`: il risultato e' NaN, che qui
    //    diventa `-Math.round(0 * NaN)` = NaN, e `|| 0` lo riporta a 0 — corretto,
    //    perche' con travel 0 non c'e' nulla da traslare.
    this.offset.set(-Math.round(this.travel * clamped) || 0);
  }
}
