import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SESSION_TTL_MS } from './session.constants';

const BCRYPT_ROUNDS = 12;

/**
 * Hash di una password che non esiste, usato solo per bruciare lo stesso tempo di un confronto
 * vero quando l'email non e' registrata (vedi `login`). E' un hash bcrypt valido a 12 round,
 * quindi `bcrypt.compare` ci lavora sopra esattamente come su un utente reale.
 */
const DUMMY_PASSWORD_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.tGGWo9Ir4KHfPtyDzM.PdKHkxCUuBoO';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email già in uso');
    }

    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    } catch {
      throw new InternalServerErrorException('Errore interno durante la registrazione');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    // Email di benvenuto (fire-and-forget)
    this.mail.sendWelcome(user.email, user.fullName).catch(() => {});

    return user;
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Il messaggio generico da solo non bastava: se l'utente non esisteva si usciva subito,
    // mentre con un utente reale si aspettavano i ~12 round di bcrypt (decine di ms). La
    // differenza si misura dall'esterno, quindi bastava cronometrare le risposte per sapere
    // quali email sono registrate. Adesso il confronto bcrypt avviene sempre: su un utente
    // inesistente gira contro un hash finto, e i due percorsi costano uguale.
    const passwordValid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.isActive || user.deletedAt || !passwordValid) {
      throw new UnauthorizedException('Credenziali non valide');
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    // Genera un token casuale e ne salva l'hash nel DB.
    // Questo identifica univocamente l'evento di login.
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      userId: user.id,
      sessionId: session.id,
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        birthDate: user.birthDate,
        gender: user.gender,
        newsletterOptIn: user.newsletterOptIn,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      },
    };
  }

  async validateSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            deletedAt: true,
            avatarUrl: true,
            phone: true,
            birthDate: true,
            gender: true,
            newsletterOptIn: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) return null;
    if (session.userId !== userId) return null;
    if (session.expiresAt < new Date()) return null;
    if (!session.user.isActive || session.user.deletedAt) return null;

    return session.user;
  }

  async logout(sessionId: string) {
    await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {
      // Ignora se la sessione non esiste già
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.isActive || user.deletedAt) {
      // Ritorna silenziosamente senza rivelare se l'email esiste o meno
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 3600000), // 1 ora
      },
    });

    this.mail.sendPasswordResetEmail(user.email, user.fullName, token).catch(() => {});
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const reset = await this.prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!reset) {
      throw new BadRequestException('Token non valido o scaduto');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.deleteMany({
        where: { userId: reset.userId },
      }),
    ]);

    this.mail.sendPasswordChangedAlert(reset.user.email, reset.user.fullName).catch(() => {});
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        phone: true,
        birthDate: true,
        gender: true,
        newsletterOptIn: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        addresses: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });
  }
}
