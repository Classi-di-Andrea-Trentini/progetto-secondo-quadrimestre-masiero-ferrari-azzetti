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
});
