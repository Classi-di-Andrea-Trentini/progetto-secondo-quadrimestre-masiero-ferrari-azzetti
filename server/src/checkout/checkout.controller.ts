import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly svc: CheckoutService) {}

  @Post()
  placeOrder(@Req() req: any, @Body() dto: CheckoutDto) {
    return this.svc.placeOrder(req.user.id, dto);
  }
}
