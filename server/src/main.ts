import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Intestazioni di sicurezza HTTP
  app.use(helmet());

  // Cookie parser richiesto per leggere i cookie HttpOnly
  app.use(cookieParser());

  // CORS: accetta richieste con credenziali dall'origine del frontend.
  // Oltre a FRONTEND_URL supporta gli host effimeri di GitHub Codespaces
  // (*.app.github.dev), dove frontend e backend girano su sottodomini diversi.
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const { hostname } = new URL(origin);
        if (origin === frontendUrl || hostname.endsWith('.app.github.dev')) {
          return cb(null, true);
        }
      } catch {
        // origin malformato: rifiuta
      }
      return cb(new Error('Origin non consentito da CORS'));
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
