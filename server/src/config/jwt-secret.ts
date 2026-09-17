/**
 * Unica fonte del segreto di firma dei JWT.
 *
 * Prima il valore era letto in due punti (`auth.module.ts` e `jwt.strategy.ts`), ognuno con il
 * proprio fallback `'changeme_in_production'`: se `JWT_SECRET` non era impostato l'app partiva
 * lo stesso e firmava i token con una stringa che sta scritta nel sorgente. Qui invece manca il
 * fallback apposta — meglio un avvio che fallisce di uno che sembra funzionare e firma con un
 * segreto pubblico.
 */
const MIN_SECRET_LENGTH = 32;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET non impostata. Generane una con `openssl rand -base64 64` e mettila nel file .env.',
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET troppo corta (${secret.length} caratteri, minimo ${MIN_SECRET_LENGTH}). Generane una con \`openssl rand -base64 64\`.`,
    );
  }

  return secret;
}
