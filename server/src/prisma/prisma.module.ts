import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService] // permetto esportazione servizio
})
export class PrismaModule {}
