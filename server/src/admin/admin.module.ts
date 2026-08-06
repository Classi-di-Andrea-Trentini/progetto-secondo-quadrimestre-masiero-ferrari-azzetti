import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InventoryService } from './inventory.service';
import { StockAlertsModule } from '../stock-alerts/stock-alerts.module';
import { GiftCardsModule } from '../gift-cards/gift-cards.module';

@Module({
  imports: [StockAlertsModule, GiftCardsModule],
  controllers: [AdminController],
  providers: [AdminService, InventoryService],
})
export class AdminModule {}
