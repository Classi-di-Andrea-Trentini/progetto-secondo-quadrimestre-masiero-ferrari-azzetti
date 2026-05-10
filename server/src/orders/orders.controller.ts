import { Controller, Get, Patch, Param, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get()
  findAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.findAll(req.user.id, Number(page) || 1, Number(limit) || 10);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.id, id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(@Req() req: any, @Param('id') id: string) {
    return this.svc.cancelOrder(req.user.id, id);
  }
}
