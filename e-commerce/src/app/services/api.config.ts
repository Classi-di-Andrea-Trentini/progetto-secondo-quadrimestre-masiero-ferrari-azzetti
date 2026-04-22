// URL base del backend. In locale punta a localhost:3000; su GitHub Codespaces
// l'hostname del frontend è <codespace>-4200.app.github.dev e il backend è
// esposto sullo stesso dominio ma sulla porta 3000, quindi deriviamo l'URL
// dal hostname corrente per evitare il "Failed to fetch" verso localhost.
function computeApiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }
  const { protocol, hostname } = window.location;
  if (hostname.endsWith('.app.github.dev')) {
    return `${protocol}//${hostname.replace(/-4200(\.app\.github\.dev)$/, '-3000$1')}`;
  }
  return 'http://localhost:3000';
}

export const API_URL = computeApiUrl();
