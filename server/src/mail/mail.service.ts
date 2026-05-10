import { Injectable, Logger } from '@nestjs/common';
import {
  welcomeEmail,
  emailVerification,
  emailChangeConfirmation,
  emailChangedAlert,
  passwordChangedAlert,
  newsletterConfirmation,
  passwordResetEmail,
  orderConfirmationEmail,
  shippingNotificationEmail,
  returnStatusUpdateEmail,
} from './templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY ?? '';
  private readonly senderEmail = process.env.RESEND_SENDER_EMAIL ?? 'noreply@commonera.it';
  private readonly senderName = process.env.RESEND_SENDER_NAME ?? 'Common Era';
  private readonly isDev = process.env.NODE_ENV !== 'production';

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (this.isDev) {
      const sep = '─'.repeat(60);
      this.logger.debug(`\n${sep}\nEMAIL → ${to}\nOGGETTO: ${subject}\n${sep}\n${html}\n${sep}\n`);
    }

    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY non configurata. Email non inviata.');
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: `${this.senderName} <${this.senderEmail}>`,
          to,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Resend API error [${res.status}]: ${text}`);
      } else {
        this.logger.log(`Email "${subject}" inviata a ${to}`);
      }
    } catch (err) {
      this.logger.error('Errore nella chiamata a Resend:', err);
    }
  }

  async sendEmailVerification(email: string, fullName: string, verificationUrl: string) {
    await this.send(
      email,
      'Verify your email address — Common Era',
      emailVerification(fullName, verificationUrl),
    );
  }

  async sendWelcome(email: string, fullName: string) {
    await this.send(email, 'Welcome to Common Era', welcomeEmail(fullName));
  }

  async sendEmailChangeConfirmation(newEmail: string, fullName: string, confirmationUrl: string) {
    await this.send(
      newEmail,
      'Confirm your new email address — Common Era',
      emailChangeConfirmation(fullName, newEmail, confirmationUrl),
    );
  }

  async sendEmailChangedAlert(oldEmail: string, fullName: string, newEmail: string) {
    await this.send(
      oldEmail,
      'Your email address has been updated — Common Era',
      emailChangedAlert(oldEmail, fullName, newEmail),
    );
  }

  async sendPasswordChangedAlert(email: string, fullName: string) {
    await this.send(
      email,
      'Your password has been changed — Common Era',
      passwordChangedAlert(fullName),
    );
  }

  async sendNewsletterConfirmation(email: string, name: string) {
    await this.send(
      email,
      'You\'re subscribed to Common Era',
      newsletterConfirmation(name),
    );
  }

  async sendPasswordResetEmail(to: string, fullName: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4200';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await this.send(
      to,
      'Reimposta la tua password — Common Era',
      passwordResetEmail(fullName, resetUrl),
    );
  }

  async sendOrderConfirmation(
    to: string,
    fullName: string,
    order: { id: string; items: Array<{ productName: string; quantity: number; lineTotal: any }>; total: any; trackingNumber?: string },
  ): Promise<void> {
    const orderId = order.id.slice(0, 8).toUpperCase();
    await this.send(
      to,
      `Ordine confermato #${orderId} — Common Era`,
      orderConfirmationEmail(fullName, order),
    );
  }

  async sendShippingNotification(
    to: string,
    fullName: string,
    order: { id: string; trackingNumber?: string; trackingUrl?: string },
  ): Promise<void> {
    await this.send(
      to,
      'Il tuo ordine è in spedizione — Common Era',
      shippingNotificationEmail(fullName, order),
    );
  }

  async sendReturnStatusUpdate(
    to: string,
    fullName: string,
    returnId: string,
    status: string,
    adminNote?: string,
  ): Promise<void> {
    await this.send(
      to,
      'Aggiornamento reso — Common Era',
      returnStatusUpdateEmail(fullName, returnId, status, adminNote),
    );
  }
}
