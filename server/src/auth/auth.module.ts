import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { getJwtSecret } from '../config/jwt-secret';
import { SESSION_TTL_MS } from './session.constants';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      // `registerAsync` invece di `register`: cosi' il segreto viene letto quando il modulo
      // viene istanziato, non quando il file viene importato — altrimenti basta importare
      // questo modulo (per esempio da un test) per far esplodere il caricamento.
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          // Allineato alla durata della sessione nel DB: prima il JWT scadeva dopo 1 giorno
          // mentre la sessione ne durava 7, quindi l'utente rifaceva il login ogni giorno e
          // il cookie continuava a girare per altri 6 con dentro un token gia' inutile.
          expiresIn: `${SESSION_TTL_MS}ms`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
