import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
// `import PDFDocument from 'pdfkit'` compila ma esplode a runtime: il tsconfig ha
// `allowSyntheticDefaultImports` senza `esModuleInterop`, quindi TypeScript accetta
// l'import di default e non emette l'helper che lo fa funzionare — `pdfkit` è
// CommonJS e non ha un `default`. La forma `import = require` non ha questo problema
// e non richiede di toccare le opzioni globali del progetto.
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fattura in PDF dell'ordine.
 *
 * Il campo `invoice_number` esisteva nello schema fin dall'inizio ma **non lo
 * scriveva nessuno**: zero ordini su nove ne avevano uno. Il numero viene assegnato
 * qui, alla prima richiesta della fattura, e poi non cambia più — è il riferimento
 * che il cliente cita e non può ballare.
 *
 * Numerazione progressiva per anno (`2026-0001`). L'unicità la garantisce il
 * vincolo sul database: in caso di corsa fra due richieste una fallisce e si
 * riprova, invece di affidarsi a un conteggio letto un istante prima.
 */

const ORDER_INCLUDE = {
  items: true,
  address: true,
  user: { select: { email: true, fullName: true } },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} as const;

/** Tentativi in caso di collisione sul numero: bastano, le corse sono rare. */
const MAX_ATTEMPTS = 5;

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}

  async buildPdf(userId: string, orderId: string): Promise<{ filename: string; pdf: Buffer }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });

    if (!order) throw new NotFoundException('Order not found');
    // Il controllo di proprietà sta qui e non solo nel controller: la fattura
    // contiene indirizzo e nome, non è un documento da servire per id indovinato.
    if (order.userId !== userId) throw new ForbiddenException();

    const invoiceNumber = order.invoiceNumber ?? (await this.assignNumber(order.id, order.createdAt));
    const pdf = await this.render({ ...order, invoiceNumber });

    return { filename: `fattura-${invoiceNumber}.pdf`, pdf };
  }

  private async assignNumber(orderId: string, createdAt: Date): Promise<string> {
    const year = createdAt.getFullYear();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const used = await this.prisma.order.count({
        where: { invoiceNumber: { startsWith: `${year}-` } },
      });
      const candidate = `${year}-${String(used + 1 + attempt).padStart(4, '0')}`;

      try {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { invoiceNumber: candidate },
        });
        return candidate;
      } catch (error) {
        // Codice Prisma per violazione di vincolo unico: qualcun altro ha preso
        // questo numero mentre lo calcolavamo. Si riprova col successivo.
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }

    throw new Error('Could not assign an invoice number');
  }

  private render(order: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const euro = (value: unknown) => `EUR ${Number(value).toFixed(2)}`;

      doc.fontSize(20).text('Common Era', { continued: false });
      doc.fontSize(10).fillColor('#666').text('Fattura / Invoice');
      doc.moveDown();

      doc.fillColor('#000').fontSize(12);
      doc.text(`Numero: ${order.invoiceNumber}`);
      doc.text(`Data: ${new Date(order.createdAt).toLocaleDateString('it-IT')}`);
      doc.text(`Ordine: ${order.id}`);
      doc.text(`Stato: ${order.status}`);
      doc.moveDown();

      doc.fontSize(11).fillColor('#666').text('Intestatario');
      doc.fillColor('#000').fontSize(12);
      doc.text(order.address?.fullName ?? order.user?.fullName ?? '');
      if (order.user?.email) doc.text(order.user.email);
      if (order.address) {
        doc.text(order.address.street + (order.address.street2 ? `, ${order.address.street2}` : ''));
        doc.text(
          `${order.address.postalCode} ${order.address.city}` +
            (order.address.province ? ` (${order.address.province})` : ''),
        );
        doc.text(order.address.country);
      }
      doc.moveDown();

      // Intestazione della tabella
      const top = doc.y;
      doc.fontSize(10).fillColor('#666');
      doc.text('Articolo', 50, top);
      doc.text('Qta', 330, top, { width: 40, align: 'right' });
      doc.text('Prezzo', 380, top, { width: 70, align: 'right' });
      doc.text('Totale', 460, top, { width: 85, align: 'right' });
      doc.moveTo(50, top + 14).lineTo(545, top + 14).strokeColor('#ddd').stroke();
      doc.moveDown();

      doc.fillColor('#000').fontSize(10);
      for (const item of order.items ?? []) {
        const y = doc.y + 4;
        const label = [item.productName, item.variantLabel].filter(Boolean).join(' — ');
        doc.text(label, 50, y, { width: 270 });
        doc.text(String(item.quantity), 330, y, { width: 40, align: 'right' });
        doc.text(euro(item.unitPrice), 380, y, { width: 70, align: 'right' });
        doc.text(euro(item.lineTotal), 460, y, { width: 85, align: 'right' });
        doc.moveDown(0.6);
      }

      doc.moveDown();
      const totalsTop = doc.y;
      doc.moveTo(330, totalsTop).lineTo(545, totalsTop).strokeColor('#ddd').stroke();
      doc.moveDown(0.5);

      const line = (label: string, value: string, bold = false) => {
        const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(label, 330, y, { width: 120, align: 'right' });
        doc.text(value, 460, y, { width: 85, align: 'right' });
        doc.moveDown(0.4);
      };

      line('Subtotale', euro(order.subtotal));
      if (Number(order.discountTotal) > 0) line('Sconto', `- ${euro(order.discountTotal)}`);
      if (Number(order.giftCardAmount ?? 0) > 0) line('Gift card', `- ${euro(order.giftCardAmount)}`);
      line('Spedizione', euro(order.shippingCost));
      if (order.taxAmount != null) line('IVA', euro(order.taxAmount));
      line('Totale', euro(order.total), true);

      doc.font('Helvetica').fontSize(9).fillColor('#666');
      doc.moveDown(2);
      const payment = order.payments?.[0];
      if (payment) {
        doc.text(`Pagamento: ${payment.method} — ${payment.status}`, 50);
      }
      doc.text('Documento generato automaticamente, non valido ai fini fiscali.', 50);

      doc.end();
    });
  }
}
