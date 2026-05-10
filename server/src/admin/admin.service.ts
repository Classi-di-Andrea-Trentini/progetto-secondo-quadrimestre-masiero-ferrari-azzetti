import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminListQueryDto,
  AdminOrdersQueryDto,
  UpdateOrderStatusDto,
  UpdateUserRoleDto,
  CreateProductDto,
  UpdateProductDto,
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  AdminReviewsQueryDto,
  UpdateReviewStatusDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const [
      totalUsers,
      totalOrders,
      totalProducts,
      revenueAgg,
      pendingOrders,
      recentOrders,
      topProducts,
      ordersByStatus,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.product.count(),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { in: ['paid', 'processing', 'shipped', 'delivered', 'completed'] } },
      }),
      this.prisma.order.count({ where: { status: 'pending' } }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { fullName: true, email: true } },
          items: { select: { productName: true, quantity: true, lineTotal: true } },
        },
      }),
      this.prisma.product.findMany({
        orderBy: { soldCount: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, soldCount: true, basePrice: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    return {
      totalUsers,
      totalOrders,
      totalProducts,
      totalRevenue: parseFloat(String(revenueAgg._sum.total ?? 0)),
      pendingOrders,
      recentOrders,
      topProducts,
      ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count.status })),
    };
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  async getUsers(query: AdminListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utente non trovato');
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role as any },
      select: { id: true, email: true, fullName: true, role: true },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utente non trovato');
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Utente eliminato' };
  }

  // ─── Products ───────────────────────────────────────────────────────────────

  async getProducts(query: AdminListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          images: { where: { isCover: true }, take: 1 },
          discounts: { where: { isActive: true }, take: 1 },
          _count: { select: { variants: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async createProduct(dto: CreateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('Slug già in uso');
    const productData: any = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      basePrice: dto.basePrice,
      isActive: dto.isActive ?? true,
    };
    if (dto.categoryId) productData.categoryId = dto.categoryId;
    return this.prisma.product.create({
      data: productData,
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Prodotto non trovato');
    return this.prisma.product.update({ where: { id }, data: dto as any });
  }

  async deleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Prodotto non trovato');
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Prodotto eliminato' };
  }

  // ─── Orders ─────────────────────────────────────────────────────────────────

  async getOrders(query: AdminOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { id: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, email: true } },
          items: { select: { productName: true, quantity: true, lineTotal: true } },
          address: { select: { city: true, country: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getOrderDetail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, email: true } },
        address: true,
        items: {
          include: {
            variant: {
              include: {
                product: { select: { name: true, slug: true, images: { where: { isCover: true }, take: 1 } } },
              },
            },
          },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        promoCode: { select: { code: true } },
      },
    });
    if (!order) throw new NotFoundException('Ordine non trovato');
    return order;
  }

  async updateOrderStatus(id: string, dto: UpdateOrderStatusDto, adminId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Ordine non trovato');

    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id }, data: { status: dto.status as any } }),
      this.prisma.orderStatusHistory.create({
        data: { orderId: id, status: dto.status as any, changedBy: adminId, note: dto.note },
      }),
    ]);

    return { id, status: dto.status };
  }

  // ─── Promo Codes ────────────────────────────────────────────────────────────

  async getPromoCodes(query: AdminListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { uses: true } } },
      }),
      this.prisma.promoCode.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async createPromoCode(dto: CreatePromoCodeDto) {
    const existing = await this.prisma.promoCode.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Codice già esistente');
    return this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.discountType as any,
        value: dto.discountValue,
        minOrderAmount: dto.minOrderAmount ?? null,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePromoCode(id: string, dto: UpdatePromoCodeDto) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Codice promozionale non trovato');
    return this.prisma.promoCode.update({ where: { id }, data: dto as any });
  }

  async deletePromoCode(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Codice promozionale non trovato');
    await this.prisma.promoCode.delete({ where: { id } });
    return { message: 'Codice eliminato' };
  }

  // ─── Reviews ────────────────────────────────────────────────────────────────

  async getReviews(query: AdminReviewsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, email: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async updateReviewStatus(id: string, dto: UpdateReviewStatusDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Recensione non trovata');
    return this.prisma.review.update({
      where: { id },
      data: { status: dto.status as any },
      include: {
        user: { select: { fullName: true, email: true } },
        product: { select: { name: true, slug: true } },
      },
    });
  }

  async deleteReview(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Recensione non trovata');
    await this.prisma.review.delete({ where: { id } });
    return { message: 'Recensione eliminata' };
  }
}
