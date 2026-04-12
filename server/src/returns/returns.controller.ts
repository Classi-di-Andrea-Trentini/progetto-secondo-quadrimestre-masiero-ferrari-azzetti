import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('returns')
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly svc: ReturnsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.id, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateReturnDto) {
    return this.svc.create(req.user.id, dto);
  }
}
