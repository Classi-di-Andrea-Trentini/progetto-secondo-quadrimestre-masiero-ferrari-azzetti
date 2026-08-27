import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { URL } from 'node:url';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine(
  // {allowedHosts: ['localhost', 'redesigned-cod-7vp96w4v4qwgfr67j-4200.app.github.dev']}
);


/**
 * Proxy verso il backend per `/api` e `/uploads`.
 *
 * In sviluppo ci pensa il dev server di Angular (`proxy.conf.json`), che in
 * produzione non esiste: senza queste righe il sito costruito chiamerebbe
 * `/api/...` sul proprio host e prenderebbe 404 su ogni richiesta.
 *
 * Passare dallo stesso dominio non e' un dettaglio: il login e' un cookie
 * HttpOnly `SameSite=Lax`, e chiamare il backend su un'altra origine
 * significherebbe CORS piu' cookie di terze parti — cioe' un login che smette
 * di funzionare appena il browser stringe le regole.
 *
 * Scritto con `http.request` invece di aggiungere una dipendenza: e' un giro di
 * tubi fra due stream, e cosi' regge anche l'upload multipart delle foto
 * prodotto senza bufferare il file in memoria.
 */
const backendOrigin = (process.env['BACKEND_URL'] ?? 'http://backend:3000').replace(/\/$/, '');

app.use(['/api', '/uploads'], (req, res) => {
  const target = new URL(req.originalUrl, backendOrigin);
  const upstream = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      // `host` riscritto: mandare al backend l'host del frontend confonde
      // qualunque cosa il backend costruisca a partire dall'intestazione.
      headers: { ...req.headers, host: target.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    console.error('[proxy] backend irraggiungibile:', error.message);
    if (!res.headersSent) res.status(502).json({ message: 'Backend non raggiungibile' });
    else res.end();
  });

  req.pipe(upstream);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
