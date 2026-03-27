import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const USER_SELECT = {
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
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};

    if (dto.fullName !== undefined) data['fullName'] = dto.fullName;
    if (dto.phone !== undefined) data['phone'] = dto.phone || null;
    if (dto.gender !== undefined) data['gender'] = dto.gender || null;
    if (dto.newsletterOptIn !== undefined) data['newsletterOptIn'] = dto.newsletterOptIn;
    if (dto.birthDate !== undefined) {
      data['birthDate'] = dto.birthDate ? new Date(dto.birthDate) : null;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });
  }

  async requestEmailChange(userId: string, dto: ChangeEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    const passwordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Password attuale non corretta');
    }

    const newEmail = dto.newEmail.toLowerCase();

    // Verifica che la nuova email non sia già in uso da un altro account
    const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email già in uso');
    }

    // Invalida eventuali richieste precedenti per questo utente
    await this.prisma.emailVerification.deleteMany({ where: { userId } });

    // Il token è un JWT firmato che contiene la nuova email.
    // La firma con JWT_SECRET garantisce che non sia stato manipolato.
    const token = this.jwtService.sign(
      { sub: userId, newEmail, purpose: 'email-change' },
      { expiresIn: '24h' },
    );

    await this.prisma.emailVerification.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
    const confirmationUrl = `${backendUrl}/users/confirm-email/${token}`;

    this.mail.sendEmailChangeConfirmation(newEmail, user.fullName, confirmationUrl).catch(() => {});

    return { message: 'Ti abbiamo inviato un link di conferma alla nuova email. Hai 24 ore per confermarlo.' };
  }

  async confirmEmailChange(token: string) {
    let payload: { sub: string; newEmail: string; purpose: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Link non valido o scaduto');
    }

    if (payload.purpose !== 'email-change') {
      throw new UnauthorizedException('Link non valido');
    }

    const verification = await this.prisma.emailVerification.findUnique({ where: { token } });
    if (!verification || verification.usedAt) {
      throw new UnauthorizedException('Link già utilizzato o non trovato');
    }
    if (verification.expiresAt < new Date()) {
      throw new UnauthorizedException('Link scaduto');
    }

    // Verifica che la nuova email sia ancora libera (potrebbe essere stata presa nel frattempo)
    const taken = await this.prisma.user.findUnique({ where: { email: payload.newEmail } });
    if (taken && taken.id !== payload.sub) {
      throw new ConflictException('Email già in uso da un altro account');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, fullName: true },
    });

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        email: payload.newEmail,
        emailVerifiedAt: new Date(),
      },
    });

    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    if (currentUser) {
      this.mail.sendEmailChangedAlert(currentUser.email, currentUser.fullName, payload.newEmail).catch(() => {});
    }

    return { message: 'Email confermata e aggiornata con successo' };
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    if (user.emailVerifiedAt) {
      throw new ConflictException('Email già verificata');
    }

    // Invalida eventuali token precedenti (stesso userId, scopo verify)
    await this.prisma.emailVerification.deleteMany({ where: { userId } });

    const token = this.jwtService.sign(
      { sub: userId, purpose: 'email-verify' },
      { expiresIn: '24h' },
    );

    await this.prisma.emailVerification.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4200';
    const verificationUrl = `${frontendUrl}/verify-email/${token}`;

    this.mail.sendEmailVerification(user.email, user.fullName, verificationUrl).catch(() => {});

    return { message: 'Email di verifica inviata. Hai 24 ore per confermare.' };
  }

  async confirmVerification(token: string) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Link non valido o scaduto');
    }

    if (payload.purpose !== 'email-verify') {
      throw new UnauthorizedException('Link non valido');
    }

    const verification = await this.prisma.emailVerification.findUnique({ where: { token } });
    if (!verification || verification.usedAt) {
      throw new UnauthorizedException('Link già utilizzato o non trovato');
    }
    if (verification.expiresAt < new Date()) {
      throw new UnauthorizedException('Link scaduto');
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { emailVerifiedAt: new Date() },
    });

    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Email verificata con successo' };
  }

  async changePassword(userId: string, currentSessionId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    const passwordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Password attuale non corretta');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Invalida tutte le sessioni tranne quella corrente
    await this.prisma.session.deleteMany({
      where: { userId, NOT: { id: currentSessionId } },
    });

    this.mail.sendPasswordChangedAlert(user.email, user.fullName).catch(() => {});

    return { message: 'Password aggiornata con successo' };
  }
}
