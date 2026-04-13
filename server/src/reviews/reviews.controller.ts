import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  @Get('product/:productId')
  findByProduct(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findByProduct(productId, Number(page) || 1, Number(limit) || 10);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateReviewDto) {
    const review = await this.svc.create(req.user.id, dto);
    await this.svc.recalcProductRating(dto.productId);
    return review;
  }

  @Post(':id/helpful')
  @UseGuards(JwtAuthGuard)
  voteHelpful(@Req() req: any, @Param('id') id: string) {
    return this.svc.voteHelpful(id, req.user.id);
  }

  @Delete(':id/helpful')
  @UseGuards(JwtAuthGuard)
  removeVote(@Req() req: any, @Param('id') id: string) {
    return this.svc.removeVote(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: any, @Param('id') id: string) {
    const { productId } = await this.svc.remove(id, req.user.id);
    await this.svc.recalcProductRating(productId);
  }
}
