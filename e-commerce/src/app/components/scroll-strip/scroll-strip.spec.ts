import { TestBed } from '@angular/core/testing';
import { ScrollStrip } from './scroll-strip';

describe('ScrollStrip', () => {
  it('translates the strip as the sticky section is scrolled through', () => {
    const fixture = TestBed.createComponent(ScrollStrip);
    const cmp = fixture.componentInstance;
    fixture.detectChanges();

    cmp.applyProgress(0);
    expect(cmp.offset()).toBe(0);

    cmp.setTravel(800);
    cmp.applyProgress(0.5);
    expect(cmp.offset()).toBe(-400);

    cmp.applyProgress(1);
    expect(cmp.offset()).toBe(-800);
  });

  it('clamps progress outside the sticky range', () => {
    const fixture = TestBed.createComponent(ScrollStrip);
    const cmp = fixture.componentInstance;
    cmp.setTravel(800);

    cmp.applyProgress(-3);
    expect(cmp.offset()).toBe(0);

    cmp.applyProgress(9);
    expect(cmp.offset()).toBe(-800);
  });

  it('does not blow up when matchMedia is unavailable (jsdom test env / SSR)', () => {
    // jsdom non implementa window.matchMedia, esattamente come il server durante SSR:
    // afterNextRender deve difendersi da soli, senza che il test debba stubbare nulla.
    expect(typeof (globalThis as { matchMedia?: unknown }).matchMedia).not.toBe('function');

    const fixture = TestBed.createComponent(ScrollStrip);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('measures travel against the sticky viewport, not the unconstrained rail', () => {
    // Regressione per il bug B1: la rail (`.scroll-strip__rail`) e' un flex
    // item senza vincoli di larghezza propri, quindi il suo `clientWidth`
    // coincide SEMPRE col suo `scrollWidth` (jsdom non fa layout, ma il
    // comportamento reale e' identico: e' proprio quello che rendeva
    // `travel` sempre 0 in produzione). Qui si simula quello scenario reale
    // definendo le proprieta' a mano: se `measure()` guardasse ancora
    // `strip.clientWidth` invece di quello del contenitore sticky, `travel`
    // risulterebbe 0 anche con 2400px di contenuto in un viewport da 1440px.
    const fixture = TestBed.createComponent(ScrollStrip);
    fixture.detectChanges();

    const rail: HTMLElement = fixture.nativeElement.querySelector('.scroll-strip__rail');
    const sticky: HTMLElement = fixture.nativeElement.querySelector('.scroll-strip__sticky');
    Object.defineProperty(rail, 'scrollWidth', { value: 2400, configurable: true });
    Object.defineProperty(rail, 'clientWidth', { value: 2400, configurable: true });
    Object.defineProperty(sticky, 'clientWidth', { value: 1440, configurable: true });

    fixture.componentInstance.measure();

    const section: HTMLElement = fixture.nativeElement.querySelector('.scroll-strip');
    expect(section.style.getPropertyValue('--travel')).toBe('960px');
  });

  it('keeps the fallback scrollable container keyboard-reachable and labelled', () => {
    // Sotto lg e con prefers-reduced-motion la striscia diventa un contenitore
    // overflow-x:auto in puro CSS: senza tabindex non e' raggiungibile da
    // tastiera (WCAG 2.1.1) e senza role/aria-label uno screen reader non
    // capisce che quella zona scorre.
    const fixture = TestBed.createComponent(ScrollStrip);
    fixture.detectChanges();

    const sticky: HTMLElement = fixture.nativeElement.querySelector('.scroll-strip__sticky');
    expect(sticky.tabIndex).toBe(0);
    expect(sticky.getAttribute('role')).toBe('region');
    expect(sticky.getAttribute('aria-label')?.trim()).toBeTruthy();
  });
});
