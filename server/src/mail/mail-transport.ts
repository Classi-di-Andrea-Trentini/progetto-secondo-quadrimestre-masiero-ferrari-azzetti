import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Come escono materialmente le email.
 *
 * `MailService` resta la facciata con i suoi `sendQualcosa()`; qui sotto c'è solo
 * il trasporto. La separazione serve perché il provider è cambiato: il progetto era
 * scritto su **Resend**, ma quella chiave non esiste — l'unica configurazione di
 * posta che Alessio ha davvero è un **server SMTP**, lo stesso già usato da
 * NorthLeap CRM. Cambiare trasporto senza toccare i punti che mandano le email
 * significa che questa scelta si può rifare in futuro senza riaprire mezzo backend.
 *
 * Con `app.mail.provider` vuoto non si invia nulla e lo si dice nei log: è lo stato
 * giusto per uno sviluppo in cui non si vuole spedire davvero.
 */

export interface MailTransport {
  readonly name: string;
  send(message: { from: string; to: string; subject: string; html: string }): Promise<void>;
}

/** Trasporto SMTP autenticato: host, porta e cifratura arrivano dall'ambiente. */
export class SmtpTransport implements MailTransport {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpTransport.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    /** STARTTLS sulla 587 oppure TLS implicito sulla 465: si escludono a vicenda. */
    secure: boolean;
    requireTls: boolean;
  }) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTls,
      auth: { user: config.user, pass: config.pass },
      // Senza timeout espliciti una connessione che non risponde blocca la richiesta
      // HTTP che l'ha innescata: la verifica email è sincrona dentro la registrazione.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }

  async send(message: { from: string; to: string; subject: string; html: string }): Promise<void> {
    const info = await this.transporter.sendMail(message);
    this.logger.log(`SMTP: "${message.subject}" → ${message.to} (${info.messageId})`);
  }
}

/** Trasporto Resend, tenuto perché il progetto nasce così e la chiave può arrivare. */
export class ResendTransport implements MailTransport {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendTransport.name);

  constructor(private readonly apiKey: string) {}

  async send(message: { from: string; to: string; subject: string; html: string }): Promise<void> {
    // URL cablato apposta: è un indirizzo fisso di un servizio noto, e prenderlo
    // dall'ambiente aprirebbe la porta a farsi mandare le email altrove.
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(message),
    });

    if (!res.ok) throw new Error(`Resend [${res.status}]: ${await res.text()}`);
    this.logger.log(`Resend: "${message.subject}" → ${message.to}`);
  }
}

/**
 * Costruisce il trasporto scelto, o `null` se non è configurato niente.
 * `MAIL_PROVIDER` decide; senza, si prova a dedurlo da quello che c'è.
 */
export function buildTransport(env: NodeJS.ProcessEnv, logger: Logger): MailTransport | null {
  const declared = (env.MAIL_PROVIDER ?? '').trim().toLowerCase();
  const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_USERNAME && env.SMTP_PASSWORD);
  const hasResend = Boolean(env.RESEND_API_KEY);

  const provider = declared || (hasSmtp ? 'smtp' : hasResend ? 'resend' : '');

  if (provider === 'smtp') {
    if (!hasSmtp) {
      logger.warn('MAIL_PROVIDER=smtp ma mancano host, utente o password. Email disattivate.');
      return null;
    }
    const port = Number(env.SMTP_PORT ?? 587);
    return new SmtpTransport({
      host: env.SMTP_HOST!,
      port,
      user: env.SMTP_USERNAME!,
      pass: env.SMTP_PASSWORD!,
      // La 465 usa TLS dall'inizio; le altre porte partono in chiaro e salgono con STARTTLS.
      secure: (env.SMTP_SSL ?? '').toLowerCase() === 'true' || port === 465,
      requireTls: (env.SMTP_STARTTLS ?? 'true').toLowerCase() === 'true' && port !== 465,
    });
  }

  if (provider === 'resend') {
    if (!hasResend) {
      logger.warn('MAIL_PROVIDER=resend ma RESEND_API_KEY manca. Email disattivate.');
      return null;
    }
    return new ResendTransport(env.RESEND_API_KEY!);
  }

  logger.warn('Nessun trasporto email configurato: le email vengono solo registrate nei log.');
  return null;
}
