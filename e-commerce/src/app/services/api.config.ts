// URL base del backend. In locale punta a localhost:3000; su GitHub Codespaces
// l'hostname del frontend è <codespace>-4200.app.github.dev e il backend è
// esposto sullo stesso dominio ma sulla porta 3000, quindi deriviamo l'URL
// dal hostname corrente per evitare il "Failed to fetch" verso localhost.
//
// Porte del backend e del frontend nei diversi ambienti: se cambiano, aggiorna
// qui e le regex di derivazione resteranno coerenti.
const FRONTEND_PORT = '4200';
const BACKEND_PORT = '3000';

function computeApiUrl(): string {
  if (typeof window === 'undefined') {
    // SSR: le richieste attraversano la rete Docker, non il DNS pubblico.
    return `http://localhost:${BACKEND_PORT}`;
  }

  const { protocol, hostname } = window.location;

  // GitHub Codespaces: <name>-4200.app.github.dev  →  <name>-3000.app.github.dev
  if (hostname.endsWith('.app.github.dev') || hostname.endsWith('.github.dev')) {
    const rewritten = hostname.replace(
      new RegExp(`-${FRONTEND_PORT}(\\.(app\\.)?github\\.dev)$`),
      `-${BACKEND_PORT}$1`,
    );
    return `${protocol}//${rewritten}`;
  }

  // Gitpod: 4200-<workspace>.<cluster>  →  3000-<workspace>.<cluster>
  if (hostname.endsWith('.gitpod.io')) {
    const rewritten = hostname.replace(
      new RegExp(`^${FRONTEND_PORT}-`),
      `${BACKEND_PORT}-`,
    );
    return `${protocol}//${rewritten}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}

export const API_URL = computeApiUrl();

// Log diagnostico: in dev aiuta a capire subito a quale backend punta il
// frontend quando si vede "Failed to fetch".
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[api.config] API_URL =', API_URL);
}
