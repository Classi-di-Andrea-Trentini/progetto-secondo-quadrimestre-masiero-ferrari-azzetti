import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { StockAlertsService } from './stock-alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsUUID } from 'class-validator';

class StockAlertDto {
  // `'loose'` come altrove: gli id del seed hanno una versione fuori dallo standard.
  @IsUUID('loose')
  variantId!: string;
}

@Controller('stock-alerts')
@UseGuards(JwtAuthGuard)
export class StockAlertsController {
  constructor(private readonly svc: StockAlertsService) {}

  @Get()
  mine(@Req() req: any) {
    return this.svc.mine(req.user.id);
  }

  @Post()
  subscribe(@Req() req: any, @Body() dto: StockAlertDto) {
    return this.svc.subscribe(req.user.id, dto.variantId);
  }

  @Delete()
  unsubscribe(@Req() req: any, @Body() dto: StockAlertDto) {
    return this.svc.unsubscribe(req.user.id, dto.variantId);
  }
}
