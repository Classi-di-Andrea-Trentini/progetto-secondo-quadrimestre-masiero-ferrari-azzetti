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

  // CORS: accetta richieste con credenziali solo dall'origine del frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
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
