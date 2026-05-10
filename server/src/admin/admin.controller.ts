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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
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
  CreateVariantDto,
  UpdateVariantDto,
  CreateImageDto,
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

  @Get('products/:id')
  getProductDetail(@Param('id') id: string) {
    return this.adminService.getProductDetail(id);
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

  // ─── Variants ─────────────────────────────────────────────────────────────

  @Post('products/:id/variants')
  createVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.adminService.createVariant(id, dto);
  }

  @Patch('products/:id/variants/:variantId')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.adminService.updateVariant(id, variantId, dto);
  }

  @Delete('products/:id/variants/:variantId')
  @HttpCode(HttpStatus.OK)
  deleteVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.adminService.deleteVariant(id, variantId);
  }

  // ─── Images ───────────────────────────────────────────────────────────────

  @Post('products/:id/images')
  addImage(@Param('id') id: string, @Body() dto: CreateImageDto) {
    return this.adminService.addImage(id, dto);
  }

  @Post('products/:id/images/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'products');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Solo file immagine sono consentiti'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Nessun file ricevuto');
    const backendUrl = process.env['BACKEND_URL'] ?? 'http://localhost:3000';
    const url = `${backendUrl}/uploads/products/${file.filename}`;
    return this.adminService.addImage(id, { url });
  }

  @Delete('products/:id/images/:imageId')
  @HttpCode(HttpStatus.OK)
  deleteImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.adminService.deleteImage(id, imageId);
  }

  @Patch('products/:id/images/:imageId/cover')
  setCoverImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.adminService.setCoverImage(id, imageId);
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
