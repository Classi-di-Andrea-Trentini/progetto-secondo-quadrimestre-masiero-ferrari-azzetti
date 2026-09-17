import { Prisma } from '@prisma/client';

/**
 * Costruzione della clausola di ricerca testuale.
 *
 * Prima il parametro `search` veniva letto dal DTO e **poi mai usato**: la clausola
 * `where` non lo nominava. Il risultato era che la barra di ricerca del sito
 * restituiva sempre l'intero catalogo — cercare una parola inesistente dava 24
 * prodotti su 24, e nessuno se n'era accorto perché "qualche risultato" sembra
 * sempre plausibile.
 *
 * Si cerca su nome, marca, descrizione breve e nome della categoria, perché è
 * quello che un cliente si aspetta digitando "nera" o "cotone".
 */

/** Sotto i due caratteri la ricerca non discrimina nulla: meglio ignorarla. */
const MIN_LENGTH = 2;

export function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parole di ricerca da confrontare con i nomi ripuliti da trattini e spazi.
 *
 * Serve perché la gente scrive `tshirt` e a catalogo il prodotto si chiama
 * `T-Shirt`: col solo confronto letterale quella ricerca dà zero risultati, che è
 * il modo più rapido per far credere a un cliente che non vendi una cosa.
 */
export function normalisedWords(term: string | undefined): string[] {
  const trimmed = term?.trim();
  if (!trimmed || trimmed.length < MIN_LENGTH) return [];
  return trimmed
    .split(/\s+/)
    .slice(0, 6)
    .map(normalise)
    .filter((word) => word.length >= MIN_LENGTH);
}

export function searchClause(term: string | undefined): Prisma.ProductWhereInput | null {
  const trimmed = term?.trim();
  if (!trimmed || trimmed.length < MIN_LENGTH) return null;

  // Ogni parola deve comparire da qualche parte: "t-shirt nera" trova la maglietta
  // nera, non tutte le t-shirt e in più tutto ciò che è nero.
  const words = trimmed.split(/\s+/).slice(0, 6);

  return {
    AND: words.map((word) => ({
      OR: [
        { name: { contains: word, mode: 'insensitive' as const } },
        { brand: { contains: word, mode: 'insensitive' as const } },
        { shortDesc: { contains: word, mode: 'insensitive' as const } },
        { description: { contains: word, mode: 'insensitive' as const } },
        { category: { name: { contains: word, mode: 'insensitive' as const } } },
      ],
    })),
  };
}
