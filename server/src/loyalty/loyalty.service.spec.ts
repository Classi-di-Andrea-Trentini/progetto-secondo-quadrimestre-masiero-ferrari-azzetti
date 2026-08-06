import { BadRequestException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

/**
 * La matematica dei punti si prova senza database: quello che conta e' che il
 * cliente non veda mai promesso piu' di quanto gli viene poi scalato.
 */
describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let created: any[];

  /** Finto client di transazione: registra cosa verrebbe scritto. */
  const txWithBalance = (balance: number) =>
    ({
      loyaltyEntry: {
        aggregate: async () => ({ _sum: { points: balance } }),
        create: async ({ data }: any) => {
          created.push(data);
          return data;
        },
      },
    }) as any;

  beforeEach(() => {
    created = [];
    service = new LoyaltyService({} as any);
  });

  describe('awardForOrder', () => {
    it('accredita un punto per euro, troncando i centesimi', () => {
      const tx = txWithBalance(0);
      return service.awardForOrder(tx, 'u1', 'o1', 34.99).then((points) => {
        expect(points).toBe(34);
        expect(created[0]).toMatchObject({ points: 34, reason: 'Acquisto' });
      });
    });

    it('non accredita niente su un imponibile a zero', async () => {
      const tx = txWithBalance(0);
      expect(await service.awardForOrder(tx, 'u1', 'o1', 0)).toBe(0);
      expect(created).toHaveLength(0);
    });

    it('non accredita punti negativi', async () => {
      const tx = txWithBalance(0);
      expect(await service.awardForOrder(tx, 'u1', 'o1', -50)).toBe(0);
    });
  });

  describe('redeemWithin', () => {
    it('converte 100 punti in un euro', async () => {
      const result = await service.redeemWithin(txWithBalance(1000), 'u1', 'o1', 600, 50);
      expect(result).toEqual({ points: 600, discount: 6 });
      expect(created[0]).toMatchObject({ points: -600, reason: 'Sconto punti' });
    });

    it('rifiuta sotto la soglia minima', async () => {
      await expect(
        service.redeemWithin(txWithBalance(1000), 'u1', 'o1', 100, 50),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rifiuta piu\' punti di quelli posseduti', async () => {
      await expect(
        service.redeemWithin(txWithBalance(500), 'u1', 'o1', 900, 50),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('non scala piu\' di quanto valga l\'ordine', async () => {
      // Ordine da 4 EUR: anche chiedendo 900 punti se ne spendono 400, gli altri
      // restano al cliente invece di evaporare.
      const result = await service.redeemWithin(txWithBalance(5000), 'u1', 'o1', 900, 4);
      expect(result).toEqual({ points: 400, discount: 4 });
      expect(created[0].points).toBe(-400);
    });

    it('arrotonda per difetto al centinaio, senza sconti a centesimi', async () => {
      // 350 punti sarebbero 3,50 EUR: si scalano 300 per un sconto tondo di 3 EUR.
      const result = await service.redeemWithin(txWithBalance(5000), 'u1', 'o1', 650, 3.5);
      expect(result).toEqual({ points: 300, discount: 3 });
    });

    it('non scrive niente quando l\'ordine e\' troppo piccolo per un euro di sconto', async () => {
      const result = await service.redeemWithin(txWithBalance(5000), 'u1', 'o1', 900, 0.5);
      expect(result).toEqual({ points: 0, discount: 0 });
      expect(created).toHaveLength(0);
    });
  });
});
