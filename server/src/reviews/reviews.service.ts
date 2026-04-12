import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async findByProduct(productId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where = { productId, status: 'approved' as const };
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { fullName: true, avatarUrl: true } },
          replies: {
            include: { admin: { select: { fullName: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async create(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId: dto.productId } },
    });
    if (existing) throw new ConflictException('You have already reviewed this product');

    // Check if user purchased this product (isVerified flag)
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        order: { userId, status: { in: ['delivered', 'completed'] } },
        variant: { productId: dto.productId },
      },
    });

    return this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        status: 'approved', // auto-approve; set to 'pending' if moderation needed
        isVerified: !!purchased,
      },
    });
  }

  async voteHelpful(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    const existing = await this.prisma.reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });
    if (existing) throw new ConflictException('Already voted');

    await this.prisma.$transaction([
      this.prisma.reviewHelpfulVote.create({ data: { reviewId, userId } }),
      this.prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { increment: 1 } } }),
    ]);
    return { helpful: true };
  }

  async removeVote(reviewId: string, userId: string) {
    const vote = await this.prisma.reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });
    if (!vote) throw new BadRequestException('Vote not found');

    await this.prisma.$transaction([
      this.prisma.reviewHelpfulVote.delete({ where: { reviewId_userId: { reviewId, userId } } }),
      this.prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { decrement: 1 } } }),
    ]);
    return { helpful: false };
  }

  async remove(reviewId: string, userId: string): Promise<{ productId: string }> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException();
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { productId: review.productId };
  }

  /** Recalculate and persist avgRating on the product */
  async recalcProductRating(productId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { productId, status: 'approved' },
      _avg: { rating: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { avgRating: agg._avg.rating ?? 0 },
    });
  }
}
