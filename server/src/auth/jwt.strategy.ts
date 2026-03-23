import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';

export interface JwtPayload {
  sub: string;
  sid: string;
  role: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      // Estrae il token dal cookie HttpOnly chiamato access_token
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.access_token ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'changeme_in_production',
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateSession(payload.sub, payload.sid);
    if (!user) {
      throw new UnauthorizedException('Sessione non valida o scaduta');
    }
    // Aggiunge sessionId all'utente per permettere l'invalidazione della sessione corrente
    return { ...user, sessionId: payload.sid };
  }
}
