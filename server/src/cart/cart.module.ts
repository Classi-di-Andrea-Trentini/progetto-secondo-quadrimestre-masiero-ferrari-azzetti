import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AbandonedCartService } from './abandoned-cart.service';

@Module({
  controllers: [CartController],
  providers: [CartService, AbandonedCartService],
  exports: [CartService, AbandonedCartService],
})
export class CartModule {}
