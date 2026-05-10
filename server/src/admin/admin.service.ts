import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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

  async getUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.role) where.role = query.role;
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

  async updateUserRole(id: string, dto: UpdateUserRoleDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utente non trovato');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role as any },
      select: { id: true, email: true, fullName: true, role: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'updateUserRole',
        entityType: 'user',
        entityId: id,
        oldValue: { role: user.role },
        newValue: { role: dto.role },
      },
    }).catch(() => {});
    return updated;
  }

  async deleteUser(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utente non trovato');
    await this.prisma.user.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'deleteUser',
        entityType: 'user',
        entityId: id,
        oldValue: { email: user.email, fullName: user.fullName },
      },
    }).catch(() => {});
    return { message: 'Utente eliminato' };
  }

  // ─── Products ───────────────────────────────────────────────────────────────

  async getProducts(query: AdminProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
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

  async deleteProduct(id: string, adminId: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw new NotFoundException('Prodotto non trovato');
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'deleteProduct',
        entityType: 'product',
        entityId: id,
        oldValue: { name: product.name, slug: product.slug },
      },
    }).catch(() => {});
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
      this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'updateOrderStatus',
          entityType: 'order',
          entityId: id,
          oldValue: { status: order.status },
          newValue: { status: dto.status, note: dto.note },
        },
      }),
    ]);

    // Notifica spedizione se lo stato diventa 'shipped'
    if (dto.status === 'shipped') {
      const orderWithUser = await this.prisma.order.findUnique({
        where: { id },
        include: { user: { select: { email: true, fullName: true } } },
      });
      if (orderWithUser?.user) {
        this.mail.sendShippingNotification(
          orderWithUser.user.email,
          orderWithUser.user.fullName,
          { id },
        ).catch(() => {});
      }
    }

    return { id, status: dto.status };
  }

  // ─── Promo Codes ────────────────────────────────────────────────────────────

  async getPromoCodes(query: AdminPromoQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.discountType) where.type = query.discountType;
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

  async deletePromoCode(id: string, adminId: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Codice promozionale non trovato');
    await this.prisma.promoCode.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'deletePromoCode',
        entityType: 'promo_code',
        entityId: id,
        oldValue: { code: promo.code },
      },
    }).catch(() => {});
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

  async updateReviewStatus(id: string, dto: UpdateReviewStatusDto, adminId: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Recensione non trovata');
    const updated = await this.prisma.review.update({
      where: { id },
      data: { status: dto.status as any },
      include: {
        user: { select: { fullName: true, email: true } },
        product: { select: { name: true, slug: true } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'updateReviewStatus',
        entityType: 'review',
        entityId: id,
        oldValue: { status: review.status },
        newValue: { status: dto.status },
      },
    }).catch(() => {});
    return updated;
  }

  async deleteReview(id: string, adminId: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Recensione non trovata');
    await this.prisma.review.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'deleteReview',
        entityType: 'review',
        entityId: id,
        oldValue: { productId: review.productId, rating: review.rating },
      },
    }).catch(() => {});
    return { message: 'Recensione eliminata' };
  }

  // ─── Returns (Admin) ────────────────────────────────────────────────────────

  async getReturns(query: AdminReturnsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { orderId: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          order: { select: { id: true, total: true, createdAt: true } },
          items: {
            include: {
              orderItem: { select: { productName: true, quantity: true } },
            },
          },
        },
      }),
      this.prisma.return.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async updateReturnStatus(id: string, dto: UpdateReturnStatusDto, adminId: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: { user: { select: { email: true, fullName: true } } },
    });
    if (!ret) throw new NotFoundException('Reso non trovato');

    const updateData: any = {
      status: dto.status,
      adminNote: dto.adminNote ?? ret.adminNote,
    };
    if (dto.refundAmount !== undefined) updateData.refundAmount = dto.refundAmount;
    if (dto.status === 'refunded') updateData.resolvedAt = new Date();

    const updated = await this.prisma.return.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'updateReturnStatus',
        entityType: 'return',
        entityId: id,
        oldValue: { status: ret.status },
        newValue: { status: dto.status, adminNote: dto.adminNote },
      },
    }).catch(() => {});

    if (ret.user) {
      this.mail.sendReturnStatusUpdate(
        ret.user.email,
        ret.user.fullName,
        id,
        dto.status,
        dto.adminNote,
      ).catch(() => {});
    }

    return updated;
  }

  // ─── CSV Export ──────────────────────────────────────────────────────────────

  async exportOrders(query: AdminExportOrdersQueryDto): Promise<string> {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    const header = ['id', 'createdAt', 'status', 'user.email', 'user.fullName', 'total'].join(',');
    const rows = orders.map((o) =>
      [
        o.id,
        o.createdAt.toISOString(),
        o.status,
        `"${(o.user?.email ?? '').replace(/"/g, '""')}"`,
        `"${(o.user?.fullName ?? '').replace(/"/g, '""')}"`,
        parseFloat(String(o.total)).toFixed(2),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async exportUsers(): Promise<string> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
        _count: { select: { orders: true } },
      },
    });

    const header = ['id', 'email', 'fullName', 'role', 'createdAt', 'emailVerifiedAt', 'ordersCount'].join(',');
    const rows = users.map((u) =>
      [
        u.id,
        `"${u.email.replace(/"/g, '""')}"`,
        `"${u.fullName.replace(/"/g, '""')}"`,
        u.role,
        u.createdAt.toISOString(),
        u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : '',
        u._count.orders,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
