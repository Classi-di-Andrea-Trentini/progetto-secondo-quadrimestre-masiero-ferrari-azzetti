import type { ComponentFixture } from '@angular/core/testing';
// Import esplicito, non il global ambiente di vitest: questo file non finisce
// in un *.spec.ts (e' importato da sei), quindi tsconfig.app.json lo include
// nella build di produzione con `types: []` — senza questo import `ng build`
// fallisce con "Cannot find name 'expect'" pur non finendo mai nel bundle
// finale (nessun file di produzione lo importa, solo i test lo fanno).
import { expect } from 'vitest';

// Le sei tabelle admin (users, orders, products, promo, returns, reviews)
// diventano sotto `md` una lista di card: stesso scheletro ovunque, un
// <div class="panel p-4"> per riga dentro un contenitore "md:hidden", con lo
// stesso <div class="panel ..."> anche per lo stato vuoto. jsdom non valuta
// le media query, ma qui non serve: le due varianti (tabella e card) sono
// entrambe sempre nel DOM — una dietro "hidden md:block", l'altra dietro
// "md:hidden" — quindi il ramo card si verifica leggendolo direttamente,
// senza dover simulare un breakpoint.
//
// Condiviso da ogni pagina con questo pattern invece di ripetere lo stesso
// corpo di test sei volte: la stessa duplicazione che il pattern in styles.css
// esiste per evitare, vale anche per i test.
export interface CardListExpectation<T> {
  fixture: ComponentFixture<unknown>;
  /** Spegne lo spinner di caricamento: le card vivono nel ramo @else di @if(loading()). */
  setLoading: (value: boolean) => void;
  /** Il signal che alimenta sia la tabella che la lista di card. */
  setItems: (items: T[]) => void;
  /** Almeno un elemento, con dati distinguibili nel testo della card. */
  sampleItems: T[];
  /** Testo atteso nella prima card (es. il nome utente, l'ID ordine, il codice promo). */
  expectedTextInFirstCard: string;
  /** Il messaggio mostrato quando l'elenco e' vuoto, es. "No users found". */
  emptyMessage: string;
}

export function expectResponsiveCardList<T>(opts: CardListExpectation<T>): void {
  const { fixture, setLoading, setItems, sampleItems, expectedTextInFirstCard, emptyMessage } = opts;

  setLoading(false);
  setItems(sampleItems);
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  const cardContainer = el.querySelector('[class*="md:hidden"]');
  expect(cardContainer).toBeTruthy();
  expect(cardContainer!.children.length).toBe(sampleItems.length);
  expect(cardContainer!.textContent).toContain(expectedTextInFirstCard);

  // La tabella dietro "hidden md:block" resta nel DOM in parallelo: stesso
  // numero di righe, cosi' le due viste non possono disallinearsi in numero.
  const tableContainer = el.querySelector('[class*="hidden md:block"]');
  if (tableContainer) {
    const rows = tableContainer.querySelectorAll('tbody tr');
    expect(rows.length).toBe(sampleItems.length);
  }

  setItems([]);
  fixture.detectChanges();

  const emptyCardContainer = el.querySelector('[class*="md:hidden"]');
  expect(emptyCardContainer!.children.length).toBe(1);
  expect(emptyCardContainer!.textContent).toContain(emptyMessage);
}
