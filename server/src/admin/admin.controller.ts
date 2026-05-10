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
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';
import {
  AdminListQueryDto,
  AdminOrdersQueryDto,
  UpdateOrderStatusDto,
  UpdateUserRoleDto,
  CreateProductDto,
  UpdateProductDto,
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
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
  getUsers(@Query() query: AdminListQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminService.updateUserRole(id, dto);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  @Get('products')
  getProducts(@Query() query: AdminListQueryDto) {
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
  deleteProduct(@Param('id') id: string) {
    return this.adminService.deleteProduct(id);
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  @Get('orders')
  getOrders(@Query() query: AdminOrdersQueryDto) {
    return this.adminService.getOrders(query);
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
  getPromoCodes(@Query() query: AdminListQueryDto) {
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
  deletePromoCode(@Param('id') id: string) {
    return this.adminService.deletePromoCode(id);
  }
}
