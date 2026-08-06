import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Come viene resa ogni pagina.
 *
 * Prima il progetto girava con `outputMode: "static"`, cioè **solo prerender**: le
 * pagine dinamiche erano segnate `Client` perché senza un server non c'era altra
 * scelta, e `ng serve` restituiva un guscio vuoto. Risultato: un motore di ricerca
 * che apriva una scheda prodotto non vedeva né il nome né il prezzo.
 *
 * Con `outputMode: "server"` si può scegliere per rotta, e il criterio è uno solo:
 * **chi deve leggere questa pagina?**
 *
 * | Rotta | Modo | Perché |
 * |---|---|---|
 * | `/`, `/home`, `/about` | Prerender (SSG) | uguali per tutti e cambiano di rado: si generano una volta in build |
 * | `/legal/:pagina` | Prerender (SSG) | tre pagine fisse, elenco noto in anticipo |
 * | `/products` | Server (SSR) | il catalogo cambia e va indicizzato: prerenderarlo lo congelerebbe |
 * | `/product/:slug` | Server (SSR) | prezzo e disponibilità devono essere freschi, ed è la pagina che porta traffico |
 * | login, registrazione, recupero password | Client (SPA) | niente da indicizzare, tutto dipende dal browser |
 * | `/me`, `/checkout`, `/admin/**` | Client (SPA) | dietro autenticazione: sul server non c'è nessun utente da rendere |
 *
 * La regola dietro la tabella: **SSG se il contenuto è uguale per tutti e stabile,
 * SSR se è pubblico ma cambia, SPA se è privato.** Rendere sul server una pagina
 * privata non serve a nessuno e costa una richiesta.
 */
export const serverRoutes: ServerRoute[] = [
  // ─── Pubbliche e stabili: generate in build ────────────────────────────────
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'home', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  {
    path: 'legal/:pagina',
    renderMode: RenderMode.Prerender,
    // L'elenco e' chiuso e noto: senza questi parametri Angular non saprebbe
    // quali pagine generare.
    getPrerenderParams: async () => [
      { pagina: 'privacy' },
      { pagina: 'terms' },
      { pagina: 'cookies' },
    ],
  },

  // ─── Pubbliche ma vive: rese a ogni richiesta ──────────────────────────────
  { path: 'products', renderMode: RenderMode.Server },
  { path: 'product/:slug', renderMode: RenderMode.Server },

  // ─── Private o puramente interattive: solo nel browser ─────────────────────
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: 'verify-email/:token', renderMode: RenderMode.Client },
  { path: 'me', renderMode: RenderMode.Client },
  { path: 'checkout', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },

  // Tutto il resto (compresa la 404) sul server: e' pubblico e non si sa in
  // anticipo cosa sia.
  { path: '**', renderMode: RenderMode.Server },
];
