import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';
import {
  AdminListQueryDto,
  AdminOrdersQueryDto,
  AdminUsersQueryDto,
  AdminProductsQueryDto,
  AdminPromoQueryDto,
  UpdateOrderStatusDto,
  UpdateUserRoleDto,
  CreateProductDto,
  UpdateProductDto,
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  AdminReviewsQueryDto,
  UpdateReviewStatusDto,
  AdminReturnsQueryDto,
  UpdateReturnStatusDto,
  AdminExportOrdersQueryDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard/stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  getUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/export')
  async exportUsers(@Res() res: Response) {
    const csv = await this.adminService.exportUsers();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
  }

  @Patch('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @Req() req: any) {
    return this.adminService.updateUserRole(id, dto, req.user.id);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deleteUser(id, req.user.id);
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  @Get('products')
  getProducts(@Query() query: AdminProductsQueryDto) {
    return this.adminService.getProducts(query);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminService.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.adminService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.OK)
  deleteProduct(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deleteProduct(id, req.user.id);
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  @Get('orders')
  getOrders(@Query() query: AdminOrdersQueryDto) {
    return this.adminService.getOrders(query);
  }

  @Get('orders/export')
  async exportOrders(@Query() query: AdminExportOrdersQueryDto, @Res() res: Response) {
    const csv = await this.adminService.exportOrders(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  }

  @Get('orders/:id')
  getOrderDetail(@Param('id') id: string) {
    return this.adminService.getOrderDetail(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: any,
  ) {
    return this.adminService.updateOrderStatus(id, dto, req.user.id);
  }

  // ─── Promo Codes ──────────────────────────────────────────────────────────

  @Get('promo-codes')
  getPromoCodes(@Query() query: AdminPromoQueryDto) {
    return this.adminService.getPromoCodes(query);
  }

  @Post('promo-codes')
  createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.adminService.createPromoCode(dto);
  }

  @Patch('promo-codes/:id')
  updatePromoCode(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.adminService.updatePromoCode(id, dto);
  }

  @Delete('promo-codes/:id')
  @HttpCode(HttpStatus.OK)
  deletePromoCode(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deletePromoCode(id, req.user.id);
  }

  // ─── Reviews ──────────────────────────────────────────────────────────────

  @Get('reviews')
  getReviews(@Query() query: AdminReviewsQueryDto) {
    return this.adminService.getReviews(query);
  }

  @Patch('reviews/:id/status')
  updateReviewStatus(@Param('id') id: string, @Body() dto: UpdateReviewStatusDto, @Req() req: any) {
    return this.adminService.updateReviewStatus(id, dto, req.user.id);
  }

  @Delete('reviews/:id')
  @HttpCode(HttpStatus.OK)
  deleteReview(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deleteReview(id, req.user.id);
  }

  // ─── Returns ──────────────────────────────────────────────────────────────

  @Get('returns')
  getReturns(@Query() query: AdminReturnsQueryDto) {
    return this.adminService.getReturns(query);
  }

  @Patch('returns/:id/status')
  updateReturnStatus(@Param('id') id: string, @Body() dto: UpdateReturnStatusDto, @Req() req: any) {
    return this.adminService.updateReturnStatus(id, dto, req.user.id);
  }
}
