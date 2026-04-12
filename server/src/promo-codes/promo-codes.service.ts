import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PromoValidationResult {
  promoCodeId: string;
  code: string;
  discountValue: number;
  description: string | null;
}

@Injectable()
export class PromoCodesService {
  constructor(private prisma: PrismaService) {}

  async validate(
    code: string,
    orderAmount: number,
    userId: string,
  ): Promise<PromoValidationResult> {
    const promo = await this.prisma.promoCode.findUnique({ where: { code: code.toUpperCase().trim() } });

    if (!promo || !promo.isActive) throw new BadRequestException('Invalid or expired promo code');

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) throw new BadRequestException('Promo code not yet active');
    if (promo.expiresAt && promo.expiresAt < now) throw new BadRequestException('Promo code has expired');
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses)
      throw new BadRequestException('Promo code usage limit reached');

    const minAmount = promo.minOrderAmount ? parseFloat(String(promo.minOrderAmount)) : 0;
    if (orderAmount < minAmount)
      throw new BadRequestException(`Minimum order amount for this code is €${minAmount.toFixed(2)}`);

    if (promo.maxUsesPerUser !== null) {
      const userUses = await this.prisma.promoCodeUse.count({
        where: { promoCodeId: promo.id, userId },
      });
      if (userUses >= promo.maxUsesPerUser)
        throw new BadRequestException('You have already used this promo code');
    }

    const value = parseFloat(String(promo.value));
    let discountValue =
      promo.type === 'percentage' ? orderAmount * (value / 100) : value;

    if (promo.maxDiscountCap !== null) {
      const cap = parseFloat(String(promo.maxDiscountCap));
      discountValue = Math.min(discountValue, cap);
    }

    discountValue = Math.min(discountValue, orderAmount);

    return {
      promoCodeId: promo.id,
      code: promo.code,
      discountValue: Math.round(discountValue * 100) / 100,
      description: promo.description,
    };
  }
}
