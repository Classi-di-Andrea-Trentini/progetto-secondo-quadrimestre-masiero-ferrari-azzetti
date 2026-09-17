import { normalisedWords, normalise, searchClause } from './product-search';

describe('searchClause', () => {
  it('non filtra niente quando la ricerca e\' vuota o troppo corta', () => {
    // Restituire `null` e' quello che fa saltare la condizione: se restituisse un
    // oggetto vuoto la query girerebbe comunque, senza scopo.
    expect(searchClause(undefined)).toBeNull();
    expect(searchClause('   ')).toBeNull();
    expect(searchClause('a')).toBeNull();
  });

  it('richiede tutte le parole, non una qualsiasi', () => {
    // "t-shirt nera" deve trovare la maglietta nera, non tutte le t-shirt piu'
    // tutto cio' che e' nero.
    const clause = searchClause('t-shirt nera') as any;
    expect(clause.AND).toHaveLength(2);
    expect(clause.AND[0].OR.length).toBeGreaterThan(1);
  });

  it('cerca su nome, marca, descrizione e categoria', () => {
    const clause = searchClause('cotone') as any;
    const fields = clause.AND[0].OR.map((cond: any) => Object.keys(cond)[0]);
    expect(fields).toEqual(
      expect.arrayContaining(['name', 'brand', 'shortDesc', 'description', 'category']),
    );
  });

  it('ignora le parole oltre la sesta', () => {
    const clause = searchClause('a1 b2 c3 d4 e5 f6 g7 h8') as any;
    expect(clause.AND).toHaveLength(6);
  });
});

describe('normalise', () => {
  it('toglie tutto quello che non e\' lettera o cifra', () => {
    expect(normalise('T-Shirt')).toBe('tshirt');
    expect(normalise("L'Oréal 2.0")).toBe('loral20');
  });
});

describe('normalisedWords', () => {
  it('prepara le parole per il confronto sui nomi ripuliti', () => {
    // A catalogo il prodotto e' "T-Shirt": chi scrive "tshirt" deve trovarlo,
    // altrimenti sembra che quel prodotto non esista.
    expect(normalisedWords('tshirt nera')).toEqual(['tshirt', 'nera']);
  });

  it('scarta le parole che dopo la pulizia diventano troppo corte', () => {
    expect(normalisedWords('-- a +')).toEqual([]);
  });

  it('non produce niente per una ricerca vuota', () => {
    expect(normalisedWords(undefined)).toEqual([]);
    expect(normalisedWords('')).toEqual([]);
  });
});
