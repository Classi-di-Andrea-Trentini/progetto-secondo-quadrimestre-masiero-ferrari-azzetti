import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('promo-codes')
@UseGuards(JwtAuthGuard)
export class PromoCodesController {
  constructor(private readonly svc: PromoCodesService) {}

  @Post('validate')
  validate(@Req() req: any, @Body() dto: ValidatePromoDto) {
    return this.svc.validate(dto.code, dto.orderAmount, req.user.id);
  }
}
