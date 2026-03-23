import { Injectable, Logger } from '@nestjs/common';
import {
  welcomeEmail,
  emailChangeConfirmation,
  emailChangedAlert,
  passwordChangedAlert,
} from './templates';

interface KlaviyoProfile {
  email: string;
  firstName?: string;
  lastName?: string;
}

interface KlaviyoEventProps {
  [key: string]: unknown;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey = process.env.KLAVIYO_API_KEY ?? '';
  private readonly senderEmail = process.env.KLAVIYO_SENDER_EMAIL ?? 'noreply@commonera.it';
  private readonly senderName = process.env.KLAVIO_SENDER_NAME ?? 'Common Era';
  private readonly isDev = process.env.NODE_ENV !== 'production';

  private fullNameParts(fullName: string) {
    const parts = fullName.trim().split(' ');
    return {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' ') || '',
    };
  }

  // Invia un evento a Klaviyo. In produzione, i Flow di Klaviyo configurati
  // su questi eventi si occuperanno di inviare le email.
  // In sviluppo, logga anche l'HTML renderizzato per verifica locale.
  private async sendKlaviyoEvent(
    metricName: string,
    profile: KlaviyoProfile,
    properties: KlaviyoEventProps,
  ): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('KLAVIYO_API_KEY non configurata. Email non inviata.');
      return;
    }

    const { firstName, lastName } = this.fullNameParts(profile.firstName ?? '');

    const body = {
      data: {
        type: 'event',
        attributes: {
          metric: {
            data: {
              type: 'metric',
              attributes: { name: metricName },
            },
          },
          profile: {
            data: {
              type: 'profile',
              attributes: {
                email: profile.email,
                first_name: firstName,
                last_name: lastName,
              },
            },
          },
          properties: {
            ...properties,
            sender_name: this.senderName,
            sender_email: this.senderEmail,
          },
        },
      },
    };

    try {
      const res = await fetch('https://a.klaviyo.com/api/events', {
        method: 'POST',
        headers: {
          accept: 'application/vnd.api+json',
          revision: '2024-10-15',
          'content-type': 'application/vnd.api+json',
          Authorization: `Klaviyo-API-Key ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Klaviyo API error [${res.status}]: ${text}`);
      } else {
        this.logger.log(`Evento Klaviyo "${metricName}" inviato a ${profile.email}`);
      }
    } catch (err) {
      this.logger.error('Errore nella chiamata a Klaviyo:', err);
    }
  }

  private logEmail(to: string, subject: string, html: string) {
    if (!this.isDev) return;
    const sep = '─'.repeat(60);
    this.logger.debug(
      `\n${sep}\nEMAIL → ${to}\nOGGETTO: ${subject}\n${sep}\n${html}\n${sep}\n`,
    );
  }

  async sendWelcome(email: string, fullName: string) {
    const html = welcomeEmail(fullName);
    this.logEmail(email, 'Benvenuto in Common Era', html);
    await this.sendKlaviyoEvent('user_registered', { email, firstName: fullName }, {
      user_full_name: fullName,
      email_html: html,
    });
  }

  async sendEmailChangeConfirmation(
    newEmail: string,
    fullName: string,
    confirmationUrl: string,
  ) {
    const html = emailChangeConfirmation(fullName, newEmail, confirmationUrl);
    this.logEmail(newEmail, 'Conferma il cambio email — Common Era', html);
    await this.sendKlaviyoEvent(
      'email_change_requested',
      { email: newEmail, firstName: fullName },
      { confirmation_url: confirmationUrl, user_full_name: fullName, email_html: html },
    );
  }

  async sendEmailChangedAlert(oldEmail: string, fullName: string, newEmail: string) {
    const html = emailChangedAlert(oldEmail, fullName, newEmail);
    this.logEmail(oldEmail, 'Il tuo indirizzo email è stato aggiornato', html);
    await this.sendKlaviyoEvent(
      'email_changed',
      { email: oldEmail, firstName: fullName },
      { new_email: newEmail, user_full_name: fullName, email_html: html },
    );
  }

  async sendPasswordChangedAlert(email: string, fullName: string) {
    const html = passwordChangedAlert(fullName);
    this.logEmail(email, 'La tua password è stata modificata', html);
    await this.sendKlaviyoEvent(
      'password_changed',
      { email, firstName: fullName },
      { user_full_name: fullName, email_html: html },
    );
  }
}
