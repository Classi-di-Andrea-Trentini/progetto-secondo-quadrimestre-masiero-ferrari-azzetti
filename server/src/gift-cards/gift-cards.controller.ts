import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GiftCardsService } from './gift-cards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('gift-cards')
@UseGuards(JwtAuthGuard)
export class GiftCardsController {
  constructor(private readonly svc: GiftCardsService) {}

  /** Saldo di un codice, per mostrarlo al checkout prima di confermare l'ordine. */
  @Get(':code')
  check(@Param('code') code: string) {
    return this.svc.check(code);
  }
}
