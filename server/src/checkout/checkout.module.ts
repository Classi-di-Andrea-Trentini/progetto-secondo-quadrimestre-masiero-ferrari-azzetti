import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { GiftCardsModule } from '../gift-cards/gift-cards.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

@Module({
  imports: [GiftCardsModule, LoyaltyModule, PromoCodesModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
