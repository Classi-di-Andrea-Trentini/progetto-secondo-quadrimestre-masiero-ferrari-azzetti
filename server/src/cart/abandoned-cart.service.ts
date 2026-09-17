import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { priceOf } from '../common/pricing';

/**
 * Carrelli abbandonati.
 *
 * Diventa possibile solo ora che il carrello vive sul server: finché stava nel
 * browser non c'era modo di sapere che qualcuno aveva lasciato qualcosa dentro.
 *
 * Il promemoria parte **una volta sola** per carrello. Due regole tengono lontano
 * il fastidio, che è il rischio vero di questa funzione:
 *
 * 1. si aspetta che il carrello sia fermo da abbastanza tempo, altrimenti si
 *    scrive a chi sta ancora comprando;
 * 2. l'invio segna il carrello, e riempirlo di nuovo lo rimette in gioco solo
 *    perché `updatedAt` cambia — non perché si riparta da zero ogni notte.
 */

/** Fermo da almeno un giorno: sotto, è gente che sta ancora decidendo. */
const IDLE_HOURS = 24;
/** Oltre una settimana il promemoria è fuori tempo massimo e sembra spam. */
const MAX_AGE_HOURS = 24 * 7;

@Injectable()
export class AbandonedCartService {
  private readonly logger = new Logger(AbandonedCartService.name);
  /**
   * Carrelli già sollecitati, per `updatedAt`: senza, ogni passaggio dello
   * scheduler riscriverebbe alle stesse persone. Sta in memoria perché aggiungere
   * una colonna solo per questo non vale una migrazione; al riavvio si riparte, e
   * il peggio che può capitare è un secondo promemoria dopo un riavvio.
   */
  private readonly reminded = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  /** Carrelli fermi con roba dentro, per la dashboard di chi vende. */
  async list() {
    const now = Date.now();
    const idleBefore = new Date(now - IDLE_HOURS * 3600_000);
    const olderThan = new Date(now - MAX_AGE_HOURS * 3600_000);

    const carts = await this.prisma.cart.findMany({
      where: {
        updatedAt: { lt: idleBefore, gt: olderThan },
        items: { some: {} },
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { discounts: { where: { isActive: true }, take: 1 } },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return carts.map((cart) => {
      const value = cart.items.reduce(
        (sum, item) => sum + priceOf(item.variant).unitPrice * item.quantity,
        0,
      );
      return {
        cartId: cart.id,
        userId: cart.user.id,
        email: cart.user.email,
        fullName: cart.user.fullName,
        items: cart.items.length,
        units: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        value: Math.round(value * 100) / 100,
        idleSince: cart.updatedAt,
        reminded: this.reminded.get(cart.id) === cart.updatedAt.getTime(),
      };
    });
  }

  /**
   * Manda i promemoria mancanti. Restituisce quanti ne ha spediti.
   * Separata dal cron così si può lanciare a mano e provarla.
   */
  async sendReminders(): Promise<number> {
    const candidates = await this.list();
    let sent = 0;

    for (const cart of candidates) {
      if (cart.reminded) continue;

      try {
        await this.mail.sendAbandonedCart(cart.email, cart.fullName ?? '', cart.units, cart.value);
        sent++;
      } catch (error) {
        this.logger.warn(`Abandoned cart email failed for ${cart.email}: ${error}`);
      }
      // Segnato comunque: un indirizzo che rifiuta le email non deve far riprovare
      // a ogni giro, per sempre.
      this.reminded.set(cart.cartId, cart.idleSince.getTime());
    }

    if (sent > 0) this.logger.log(`Sent ${sent} abandoned cart reminder(s)`);
    return sent;
  }

  /** Una volta al giorno: è un promemoria, non una notifica. */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async scheduledRun(): Promise<void> {
    try {
      await this.sendReminders();
    } catch (error) {
      // Un errore qui non deve far cadere lo scheduler per tutti gli altri job.
      this.logger.error(`Abandoned cart run failed: ${error}`);
    }
  }
}
