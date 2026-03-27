import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async getWishlist(userId: string) {
    const items = await this.prisma.wishlist.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        product: {
          include: {
            images: {
              orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
              take: 2,
            },
            discounts: {
              where: { isActive: true },
              take: 1,
              select: { type: true, value: true, label: true },
            },
          },
        },
      },
    });
    return items;
  }

  async getWishlistProductIds(userId: string): Promise<string[]> {
    const items = await this.prisma.wishlist.findMany({
      where: { userId },
      select: { productId: true },
    });
    return items.map(i => i.productId);
  }

  async toggle(userId: string, productId: string) {
    const existing = await this.prisma.wishlist.findFirst({
      where: { userId, productId, variantId: null },
    });

    if (existing) {
      await this.prisma.wishlist.delete({ where: { id: existing.id } });
      return { saved: false };
    } else {
      await this.prisma.wishlist.create({
        data: { userId, productId },
      });
      return { saved: true };
    }
  }
}
