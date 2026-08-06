import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InventoryService } from './inventory.service';
import { StockAlertsModule } from '../stock-alerts/stock-alerts.module';

@Module({
  imports: [StockAlertsModule],
  controllers: [AdminController],
  providers: [AdminService, InventoryService],
})
export class AdminModule {}
