import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { mkdirSync } from 'fs';
// cookie-parser è CommonJS puro (niente campo "exports"). Con `module: nodenext`
// l'import default non si risolve in modo affidabile, quindi usiamo la sintassi
// import-equals che mappa esattamente a `require` mantenendo i tipi.
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cartella upload persistente (montata come volume Docker)
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // Intestazioni di sicurezza HTTP
  app.use(helmet());

  // `X-Forwarded-For` va creduto solo se davanti c'e' davvero un proxy nostro. Senza questa
  // riga Express ignora l'header (giusto: chiunque puo' scriverlo), ma il codice lo leggeva
  // comunque a mano. Con TRUST_PROXY impostata (es. "1" dietro un nginx) `req.ip` diventa
  // l'IP reale del client; senza, resta quello della connessione.
  // Attenzione a non metterla a caso: dichiarare un proxy che non c'e' rende di nuovo
  // falsificabile l'IP, e con esso i bucket del rate limiter.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const hops = Number(trustProxy);
    app.set('trust proxy', Number.isFinite(hops) ? hops : trustProxy);
    logger.log(`trust proxy attivo: ${trustProxy}`);
  }

  // Cookie parser richiesto per leggere i cookie HttpOnly
  app.use(cookieParser());

  // Prefisso globale: tutte le route del backend sono esposte sotto /api/*.
  // Questo permette al dev server Angular di fare proxy di /api/** verso il
  // backend lasciando che tutto il resto venga servito dalla SPA, ed evita
  // collisioni fra rotte frontend e backend (es. /products esiste in entrambi).
  // `sitemap.xml` e `robots.txt` restano in radice: i motori di ricerca li cercano
  // li' e non sotto `/api`, e un file servito altrove semplicemente non viene letto.
  app.setGlobalPrefix('api', { exclude: ['sitemap.xml', 'robots.txt'] });

  // CORS: accetta richieste con credenziali dall'origine del frontend.
  // Oltre a FRONTEND_URL supporta gli host effimeri di GitHub Codespaces
  // (*.app.github.dev) e i domini extra indicati in CORS_EXTRA_ORIGINS
  // (lista separata da virgole). Gli origin rifiutati vengono loggati per
  // semplificare la diagnosi di "Failed to fetch" lato browser.
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  const extraOrigins = (process.env.CORS_EXTRA_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // I domini jolly (*.app.github.dev, *.gitpod.io) sono spazi pubblici e condivisi: qualunque
  // persona con un Codespace ottiene un sottodominio che passava questa allowlist, e insieme
  // al cookie SameSite=None impostato apposta per quella classe di origin poteva montare un
  // session riding contro chi avesse l'app aperta. Restano accettati solo fuori da produzione,
  // che e' il caso per cui erano stati messi.
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const { hostname } = new URL(origin);
        const isEphemeralDevHost =
          !isProduction &&
          (hostname.endsWith('.app.github.dev') ||
            hostname.endsWith('.gitpod.io') ||
            hostname.endsWith('.github.dev'));
        const allowed =
          origin === frontendUrl ||
          extraOrigins.includes(origin) ||
          (!isProduction && (hostname === 'localhost' || hostname === '127.0.0.1')) ||
          isEphemeralDevHost;
        if (allowed) return cb(null, true);
      } catch {
        // origin malformato: cade in rifiuto
      }
      logger.warn(`CORS: origin rifiutato -> ${origin}`);
      return cb(new Error(`Origin non consentito da CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validazione e trasformazione automatica dei DTO in ingresso
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Rimuove campi non dichiarati nel DTO
      forbidNonWhitelisted: true,
      transform: true,        // Converte automaticamente i tipi primitivi
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Backend in ascolto sulla porta ${port}`);
  logger.log(`FRONTEND_URL configurato: ${frontendUrl}`);
  if (extraOrigins.length > 0) {
    logger.log(`CORS extra origins: ${extraOrigins.join(', ')}`);
  }
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Errore fatale durante il bootstrap:', err);
  process.exit(1);
});
