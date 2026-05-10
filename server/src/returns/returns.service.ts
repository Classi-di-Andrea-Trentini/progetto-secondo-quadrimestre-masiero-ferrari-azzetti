import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.return.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            orderItem: { select: { productName: true, variantLabel: true, quantity: true } },
          },
        },
        order: { select: { id: true, createdAt: true, total: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: {
        items: {
          include: { orderItem: true },
        },
        order: { select: { id: true, createdAt: true, total: true } },
      },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (ret.userId !== userId) throw new ForbiddenException();
    return ret;
  }

  async create(userId: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();

    const eligibleStatuses = ['delivered', 'completed'];
    if (!eligibleStatuses.includes(order.status)) {
      throw new BadRequestException('Returns can only be requested for delivered or completed orders');
    }

    const existingReturn = await this.prisma.return.findFirst({
      where: { orderId: dto.orderId, status: { notIn: ['rejected'] } },
    });
    if (existingReturn) throw new BadRequestException('A return request already exists for this order');

    // Validate each return item against the actual order items
    for (const item of dto.items) {
      const orderItem = order.items.find(i => i.id === item.orderItemId);
      if (!orderItem) throw new BadRequestException(`Order item ${item.orderItemId} not found in this order`);
      if (item.quantity > orderItem.quantity)
        throw new BadRequestException(`Cannot return more than ${orderItem.quantity} units of ${orderItem.productName}`);
    }

    const created = await this.prisma.return.create({
      data: {
        orderId: dto.orderId,
        userId,
        reason: dto.reason,
        items: {
          create: dto.items.map(i => ({
            orderItemId: i.orderItemId,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'return_create',
        entityType: 'return',
        entityId: created.id,
        newValue: { orderId: dto.orderId, reason: dto.reason, itemCount: dto.items.length },
      },
    }).catch(() => {});

    return created;
  }
}
