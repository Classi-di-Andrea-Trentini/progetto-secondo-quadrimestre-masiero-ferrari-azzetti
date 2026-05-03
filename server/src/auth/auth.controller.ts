import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt.strategy';

// Durata del cookie (7 giorni in ms) — deve corrispondere alla sessione nel DB
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// In ambienti cross-site HTTPS (es. GitHub Codespaces dove frontend e backend
// stanno su sottodomini diversi di *.app.github.dev) il browser accetta il
// cookie solo con SameSite=None e Secure=true. In locale su HTTP manteniamo
// SameSite=Strict per la protezione CSRF.
function getCookieOptions(req: Request) {
  const origin = req.headers.origin ?? '';
  let crossSiteHttps = false;
  try {
    const url = new URL(origin);
    crossSiteHttps =
      url.protocol === 'https:' && url.hostname.endsWith('.app.github.dev');
  } catch {
    // origin assente o malformato: usa default
  }
  return {
    httpOnly: true,
    secure: crossSiteHttps || process.env.NODE_ENV === 'production',
    sameSite: crossSiteHttps ? ('none' as const) : ('strict' as const),
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  // Massimo 5 registrazioni per IP ogni 15 minuti
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return { message: 'Registrazione completata', user };
  }

  // Massimo 10 tentativi di login per IP ogni 15 minuti
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const request = req as Request;
    const response = res as Response;

    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ?? request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await this.authService.login(dto, ipAddress, userAgent);

    const payload = {
      sub: result.userId,
      sid: result.sessionId,
      role: result.role,
    };

    const token = this.jwtService.sign(payload);
    response.cookie('access_token', token, getCookieOptions(request));

    return { message: 'Login effettuato', user: result.user };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const request = req as Request;
    const response = res as Response;

    const token: string = (request.cookies as any)?.access_token;
    if (token) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        await this.authService.logout(payload.sid);
      } catch {
        // Token già scaduto o invalido, procedi comunque a cancellare il cookie
      }
    }

    response.clearCookie('access_token', { ...getCookieOptions(request), maxAge: 0 });
    return { message: 'Logout effettuato' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return req.user;
  }
}
