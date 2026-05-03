import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;
// Durata della sessione: 7 giorni
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

    // Messaggio generico per non rivelare se l'email esiste o meno
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Credenziali non valide');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
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
