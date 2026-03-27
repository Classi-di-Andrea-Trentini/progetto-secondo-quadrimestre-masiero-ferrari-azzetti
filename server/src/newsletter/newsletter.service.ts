import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async subscribe(email: string): Promise<{ message: string }> {
    const normalised = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { email: normalised } });

    if (user) {
      if (user.newsletterOptIn) {
        throw new BadRequestException('This email is already subscribed.');
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { newsletterOptIn: true },
      });
      await this.mail.sendNewsletterConfirmation(normalised, user.fullName);
    } else {
      await this.mail.sendNewsletterConfirmation(normalised, normalised.split('@')[0]);
    }

    return { message: 'Subscription confirmed — check your inbox!' };
  }
}
