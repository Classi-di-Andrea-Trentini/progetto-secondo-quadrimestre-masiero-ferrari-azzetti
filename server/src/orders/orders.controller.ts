import { Controller, Get, Patch, Param, Query, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvoiceService } from './invoice.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly svc: OrdersService,
    private readonly invoices: InvoiceService,
  ) {}

  @Get()
  findAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.findAll(req.user.id, Number(page) || 1, Number(limit) || 10);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.id, id);
  }

  /**
   * Fattura in PDF. Il numero viene assegnato alla prima richiesta e poi non cambia.
   * Sta prima di `:id/cancel` solo per leggibilita'; le rotte non si sovrappongono.
   */
  @Get(':id/invoice')
  async invoice(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { filename, pdf } = await this.invoices.buildPdf(req.user.id, id);
    res.setHeader('Content-Type', 'application/pdf');
    // `attachment` perche' il browser lo salvi col nome giusto invece di aprirlo
    // in una scheda chiamata come l'id dell'ordine.
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(@Req() req: any, @Param('id') id: string) {
    return this.svc.cancelOrder(req.user.id, id);
  }
}
