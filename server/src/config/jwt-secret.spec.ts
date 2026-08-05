import { getJwtSecret } from './jwt-secret';

describe('getJwtSecret', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('restituisce il segreto quando e- impostato e abbastanza lungo', () => {
    process.env.JWT_SECRET = 'a'.repeat(64);
    expect(getJwtSecret()).toBe('a'.repeat(64));
  });

  it('fallisce invece di usare un fallback quando manca', () => {
    // Il punto del fix: prima qui c-era `?? 'changeme_in_production'`, quindi l-app partiva
    // e firmava i token con una stringa che sta scritta nel sorgente.
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET non impostata/);
  });

  it('rifiuta un segreto troppo corto', () => {
    process.env.JWT_SECRET = 'corta';
    expect(() => getJwtSecret()).toThrow(/troppo corta/);
  });
});
