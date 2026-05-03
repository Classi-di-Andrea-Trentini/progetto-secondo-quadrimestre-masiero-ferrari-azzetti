import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(@Req() req: any) {
    return this.wishlistService.getWishlist(req.user.id);
  }

  @Get('ids')
  getWishlistIds(@Req() req: any) {
    return this.wishlistService.getWishlistProductIds(req.user.id);
  }

  @Post(':productId/toggle')
  toggle(@Req() req: any, @Param('productId') productId: string) {
    return this.wishlistService.toggle(req.user.id, productId);
  }
}
