/**
 * Durata della sessione, in un posto solo.
 *
 * Prima questo valore viveva in tre punti che non erano d'accordo: `SESSION_TTL_MS` a 7 giorni
 * in `auth.service.ts`, `expiresIn: '1d'` sul JWT in `auth.module.ts` e il `maxAge` del cookie
 * a 7 giorni nel controller. Il risultato e' che il pezzo piu' corto vinceva sempre: l'utente
 * rifaceva il login dopo 24 ore anche se la sessione nel DB sarebbe stata valida per altri sei
 * giorni, e per quei sei giorni il browser continuava a mandare un cookie con dentro un token
 * gia' scaduto.
 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
