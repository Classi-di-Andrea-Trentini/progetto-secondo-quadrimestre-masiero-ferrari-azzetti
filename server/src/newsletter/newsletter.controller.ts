import { Controller, Post, Body } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { NewsletterService } from './newsletter.service';

class SubscribeDto {
  @IsEmail()
  email: string;
}

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto.email);
  }
}
