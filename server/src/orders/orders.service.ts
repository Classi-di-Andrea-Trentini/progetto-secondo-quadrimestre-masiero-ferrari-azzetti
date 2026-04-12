import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_INCLUDE = {
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
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  promoCode: { select: { code: true } },
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: { select: { productName: true, quantity: true, lineTotal: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
        },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();
    return order;
  }
}
