import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly svc: LoyaltyService) {}

  /** Saldo, valore in euro e soglia minima, per mostrarli al checkout. */
  @Get()
  summary(@Req() req: any) {
    return this.svc.summary(req.user.id);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    return this.svc.history(req.user.id, Number(limit) || 50);
  }
}
