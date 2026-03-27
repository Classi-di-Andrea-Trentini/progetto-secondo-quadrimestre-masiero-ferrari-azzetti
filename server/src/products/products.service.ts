import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetProductsDto } from './dto/get-products.dto';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) {}

    async findAll(dto: GetProductsDto) {
        const {
            search, categoryId, brand,
            minPrice, maxPrice,
            isFeatured, isNewArrival,
            colors, sizes,
            sortBy = 'newest',
            page = 1, limit = 24,
        } = dto;

        const where: any = {
            isActive: true,
            ...(search && { name: { contains: search, mode: 'insensitive' } }),
            ...(categoryId && { categoryId }),
            ...(brand && { brand }),
            ...(isFeatured !== undefined && { isFeatured }),
            ...(isNewArrival !== undefined && { isNewArrival }),
            ...((minPrice !== undefined || maxPrice !== undefined) && {
                basePrice: {
                    ...(minPrice !== undefined && { gte: minPrice }),
                    ...(maxPrice !== undefined && { lte: maxPrice }),
                },
            }),
            ...((colors?.length || sizes?.length) && {
                variants: {
                    some: {
                        isActive: true,
                        ...(colors?.length && { colorHex: { in: colors } }),
                        ...(sizes?.length && { size: { in: sizes } }),
                    },
                },
            }),
        };

        const orderBy: any =
            sortBy === 'price_asc'  ? { basePrice: 'asc' } :
            sortBy === 'price_desc' ? { basePrice: 'desc' } :
            sortBy === 'popular'    ? { soldCount: 'desc' } :
            sortBy === 'rating'     ? { avgRating: 'desc' } :
                                      { createdAt: 'desc' };

        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: { select: { id: true, name: true, slug: true } },
                    images: {
                        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
                        take: 2,
                    },
                    variants: {
                        where: { isActive: true },
                        select: { id: true, size: true, color: true, colorHex: true, priceOverride: true, stockQty: true },
                    },
                    discounts: {
                        where: { isActive: true },
                        select: { type: true, value: true, label: true },
                        take: 1,
                    },
                },
                orderBy,
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            data: products,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async findBySlug(slug: string) {
        const product = await this.prisma.product.findUnique({
            where: { slug },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                images: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }] },
                variants: {
                    where: { isActive: true },
                    select: { id: true, size: true, color: true, colorHex: true, priceOverride: true, stockQty: true },
                },
                discounts: {
                    where: { isActive: true },
                    select: { type: true, value: true, label: true },
                    take: 1,
                },
            },
        });

        if (!product) throw new NotFoundException('Prodotto non trovato');

        const related = await this.prisma.product.findMany({
            where: {
                isActive: true,
                categoryId: product.categoryId,
                slug: { not: slug },
            },
            take: 4,
            orderBy: { soldCount: 'desc' },
            include: {
                images: { where: { isCover: true }, take: 1 },
                discounts: { where: { isActive: true }, take: 1, select: { type: true, value: true, label: true } },
            },
        });

        return { product, related };
    }

    async getFilters() {
        const [categories, colors, sizes, priceRange] = await Promise.all([
            this.prisma.category.findMany({
                where: { isActive: true },
                select: { id: true, name: true, slug: true, parentId: true },
                orderBy: { sortOrder: 'asc' },
            }),
            this.prisma.productVariant.findMany({
                where: { isActive: true, colorHex: { not: null } },
                select: { color: true, colorHex: true },
                distinct: ['colorHex'],
                orderBy: { color: 'asc' },
            }),
            this.prisma.productVariant.findMany({
                where: { isActive: true, size: { not: null } },
                select: { size: true },
                distinct: ['size'],
            }),
            this.prisma.product.aggregate({
                where: { isActive: true },
                _min: { basePrice: true },
                _max: { basePrice: true },
            }),
        ]);

        return {
            categories,
            colors: colors.filter(c => c.colorHex),
            sizes: sizes.map(s => s.size).filter(Boolean),
            priceRange: {
                min: Number(priceRange._min.basePrice ?? 0),
                max: Number(priceRange._max.basePrice ?? 1000),
            },
        };
    }
}
