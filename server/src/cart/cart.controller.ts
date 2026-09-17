import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddCartItemDto, MergeCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  addItem(@Req() req: any, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(req.user.id, dto);
  }

  @Patch('items/:variantId')
  updateItem(
    @Req() req: any,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user.id, variantId, dto.quantity);
  }

  @Delete('items/:variantId')
  removeItem(@Req() req: any, @Param('variantId') variantId: string) {
    return this.cartService.removeItem(req.user.id, variantId);
  }

  @Delete()
  clear(@Req() req: any) {
    return this.cartService.clear(req.user.id);
  }

  /** Chiamata subito dopo il login, col carrello che l'utente aveva da sloggato. */
  @Post('merge')
  merge(@Req() req: any, @Body() dto: MergeCartDto) {
    return this.cartService.merge(req.user.id, dto.items);
  }
}
