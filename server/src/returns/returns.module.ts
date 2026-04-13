import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({ controllers: [ReturnsController], providers: [ReturnsService] })
export class ReturnsModule {}
