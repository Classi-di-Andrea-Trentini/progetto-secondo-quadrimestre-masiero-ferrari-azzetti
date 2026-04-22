// URL base del backend.
//
// Strategia: il dev server Angular fa da proxy per il path /api/** verso
// http://backend:3000 (configurato in proxy.conf.json). Questo permette al
// browser di fare chiamate SAME-ORIGIN verso l'host del frontend, evitando
// del tutto i problemi di CORS, cookie cross-site e Codespaces port
// visibility: ogni richiesta parte e torna sullo stesso dominio del frontend.
//
// In SSR (Angular Universal dentro il container frontend) `window` non
// esiste e non passiamo per il dev server, quindi andiamo direttamente al
// backend attraverso la rete interna di Docker Compose.

function isNode(): boolean {
  return typeof window === 'undefined';
}

function computeApiUrl(): string {
  if (isNode()) {
    // SSR: dentro Docker il backend è raggiungibile come `backend:3000`
    // (DNS di Compose). Permettiamo comunque override via env per run fuori
    // container (test locali senza Compose).
    const fromEnv =
      typeof process !== 'undefined' ? process.env?.['BACKEND_URL'] : undefined;
    return fromEnv ? `${fromEnv.replace(/\/$/, '')}/api` : 'http://backend:3000/api';
  }
  // Browser: URL relativo, same-origin, passa per il proxy Angular.
  return '/api';
}

export const API_URL = computeApiUrl();

// Log diagnostico client-side: aiuta a capire subito verso cosa punta il
// frontend quando si vede "Failed to fetch".
if (!isNode()) {
  // eslint-disable-next-line no-console
  console.info('[api.config] API_URL =', API_URL || '(relative)');
}
