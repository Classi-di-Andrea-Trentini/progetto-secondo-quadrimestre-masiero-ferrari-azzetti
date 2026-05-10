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

  // Cookie parser richiesto per leggere i cookie HttpOnly
  app.use(cookieParser());

  // Prefisso globale: tutte le route del backend sono esposte sotto /api/*.
  // Questo permette al dev server Angular di fare proxy di /api/** verso il
  // backend lasciando che tutto il resto venga servito dalla SPA, ed evita
  // collisioni fra rotte frontend e backend (es. /products esiste in entrambi).
  app.setGlobalPrefix('api');

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

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const { hostname } = new URL(origin);
        const allowed =
          origin === frontendUrl ||
          extraOrigins.includes(origin) ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.endsWith('.app.github.dev') ||
          hostname.endsWith('.gitpod.io') ||
          hostname.endsWith('.github.dev');
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
