import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, InventoryService],
})
export class AdminModule {}
