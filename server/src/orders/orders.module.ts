import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InvoiceService } from './invoice.service';

@Module({ controllers: [OrdersController], providers: [OrdersService, InvoiceService] })
export class OrdersModule {}
