import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetProductsDto } from './dto/get-products.dto';


@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) {}

    async findAll(dto: GetProductsDto) {
        // dto
        const { search, categoryId, brand, minPrice, maxPrice, isFeatured, isNewArrival, page = 1, limit = 20 } = dto;

        const where: any = {
            isActive: true,
            ...(search && {
                name: { contains: search, mode: 'insensitive' },
            }),
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
        };

        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                category: { select: { id: true, name: true, slug: true } },
                images: { where: { isCover: true }, take: 1 },
                variants: { where: { isActive: true }, select: { id: true, size: true, color: true, colorHex: true, priceOverride: true, stockQty: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            data: products,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const product = await this.prisma.product.findUnique({ // cerco singolo
            where: { id },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                images: { orderBy: { isCover: 'desc' } },
                variants: { where: { isActive: true }, select: { id: true, size: true, color: true, colorHex: true, priceOverride: true, stockQty: true } },
            }
        });

        if (!product) { // controllo che non esista
            throw new NotFoundException('Product not found');
        }

        return product;
    }

    




}
