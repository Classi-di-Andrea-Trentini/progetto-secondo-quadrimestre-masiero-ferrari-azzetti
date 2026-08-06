import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { GetProductsDto } from './dto/get-products.dto';
import { normalisedWords, searchClause } from './product-search';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) {}

    // findAll con dto
    async findAll(dto: GetProductsDto) {

        // vari "campi"
        const {
            search, categoryId, brand,
            minPrice, maxPrice,
            isFeatured, isNewArrival,
            colors, sizes,
            sortBy = 'newest',
            page = 1, limit = 24,
        } = dto;

        // La ricerca testuale era dichiarata nel DTO e mai applicata: senza questa
        // riga la barra di ricerca restituiva l'intero catalogo a ogni parola.
        // Al confronto letterale si aggiungono gli id trovati sui nomi ripuliti da
        // trattini e spazi, cosi' "tshirt" trova "T-Shirt".
        const looseIds = await this.searchLooseIds(search);
        const literal = searchClause(search);
        const search_ =
            literal && looseIds.length
                ? { OR: [literal, { id: { in: looseIds } }] }
                : literal;

        // costruzione campo where per db
        const where: any = {
            // aggiorno tutti i vari campi
            isActive: true,
            deletedAt: null,
            ...(search_ && search_),
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

        // ordinamento
        const orderBy: any =
            sortBy === 'price_asc'  ? { basePrice: 'asc' } :
            sortBy === 'price_desc' ? { basePrice: 'desc' } :
            sortBy === 'popular'    ? { soldCount: 'desc' } :
            sortBy === 'rating'     ? { avgRating: 'desc' } :
                                      { createdAt: 'desc' };

        // per trovare pià prodotti
        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: { select: { id: true, name: true, slug: true } },
                    images: {
                        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
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

    /**
     * Id dei prodotti il cui nome o marca, tolti trattini e spazi, contiene la
     * ricerca ripulita allo stesso modo.
     *
     * Va fatto in SQL perche' la normalizzazione deve avvenire sul lato database:
     * `contains` confronta le stringhe come sono scritte, e a catalogo il prodotto
     * si chiama "T-Shirt" mentre l'utente scrive "tshirt".
     */
    private async searchLooseIds(term?: string): Promise<string[]> {
        const words = normalisedWords(term);
        if (words.length === 0) return [];

        // Tutte le parole devono comparire, come nel confronto letterale.
        const conditions = words.map(
            (word) => Prisma.sql`(
                regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') LIKE ${'%' + word + '%'}
                OR regexp_replace(lower(coalesce(p.brand, '')), '[^a-z0-9]', '', 'g') LIKE ${'%' + word + '%'}
            )`,
        );

        const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
            SELECT p.id FROM products p
            WHERE p.is_active = true AND p.deleted_at IS NULL
              AND ${Prisma.join(conditions, ' AND ')}
            LIMIT 200
        `);

        return rows.map((row) => row.id);
    }

    // find by slug
    async findBySlug(slug: string) {
        // sta volta find unique (1 prodotto per slug)
        const product = await this.prisma.product.findUnique({
            where: { slug, deletedAt: null },
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

        // gestione errori
        if (!product) throw new NotFoundException('Product not found!');

        // per trovare tutti quei prodotti con slug
        const related = await this.prisma.product.findMany({
            where: {
                isActive: true,
                deletedAt: null,
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

    // metodo per fare il get filtrato
    /**
     * Valori disponibili per i filtri, **con quanti prodotti hanno ciascuno**.
     *
     * Senza i conteggi l'utente sceglie alla cieca e finisce spesso su liste vuote:
     * un filtro che mostra "Verde (0)" si evita da solo. I numeri si contano sui
     * prodotti attivi, non sulle varianti, altrimenti un prodotto con cinque taglie
     * dello stesso colore lo farebbe sembrare cinque prodotti.
     */
    async getFilters() {
        const activeProduct = { isActive: true, deletedAt: null } as const;

        const [categories, colors, sizes, brands, priceRange, byCategory] = await Promise.all([
            this.prisma.category.findMany({
                where: { isActive: true },
                select: { id: true, name: true, slug: true, parentId: true },
                orderBy: { sortOrder: 'asc' },
            }),
            this.prisma.productVariant.findMany({
                where: { isActive: true, colorHex: { not: null }, product: activeProduct },
                select: { color: true, colorHex: true, productId: true },
            }),
            this.prisma.productVariant.findMany({
                where: { isActive: true, size: { not: null }, product: activeProduct },
                select: { size: true, productId: true },
            }),
            this.prisma.product.groupBy({
                by: ['brand'],
                where: { ...activeProduct, brand: { not: null } },
                _count: { _all: true },
            }),
            this.prisma.product.aggregate({
                where: activeProduct,
                _min: { basePrice: true },
                _max: { basePrice: true },
            }),
            this.prisma.product.groupBy({
                by: ['categoryId'],
                where: activeProduct,
                _count: { _all: true },
            }),
        ]);

        const categoryCounts = new Map(byCategory.map((row) => [row.categoryId, row._count._all]));
        // I prodotti stanno nelle categorie foglia: senza sommare i figli, un padre
        // come "Clothing" mostrerebbe 0 pur avendo sotto tutto il guardaroba.
        const rolledUp = rollUpCategoryCounts(categories, categoryCounts);

        return {
            categories: categories.map((category) => ({
                ...category,
                count: rolledUp.get(category.id) ?? 0,
            })),
            colors: countDistinctProducts(colors, (variant) => variant.colorHex).map((entry) => ({
                colorHex: entry.key,
                color: colors.find((variant) => variant.colorHex === entry.key)?.color ?? null,
                count: entry.count,
            })),
            sizes: countDistinctProducts(sizes, (variant) => variant.size).map((entry) => ({
                size: entry.key,
                count: entry.count,
            })),
            brands: brands
                .map((row) => ({ brand: row.brand as string, count: row._count._all }))
                .sort((a, b) => b.count - a.count),
            priceRange: {
                min: Number(priceRange._min.basePrice ?? 0),
                max: Number(priceRange._max.basePrice ?? 1000),
            },
        };
    }

    /**
     * Suggerimenti per la barra di ricerca: prodotti e categorie che iniziano o
     * contengono quello che si sta scrivendo. Risposta piccola apposta, viene
     * chiamata a ogni pausa nella digitazione.
     */
    async suggest(term: string, limit = 8) {
        const clause = searchClause(term);
        if (!clause) return { products: [], categories: [] };

        const looseIds = await this.searchLooseIds(term);
        const where: any = {
            isActive: true,
            deletedAt: null,
            ...(looseIds.length ? { OR: [clause, { id: { in: looseIds } }] } : clause),
        };

        const [products, categories] = await Promise.all([
            this.prisma.product.findMany({
                where,
                take: limit,
                orderBy: { soldCount: 'desc' },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    basePrice: true,
                    images: { where: { isCover: true }, take: 1, select: { url: true } },
                },
            }),
            this.prisma.category.findMany({
                where: { isActive: true, name: { contains: term.trim(), mode: 'insensitive' } },
                take: 4,
                select: { id: true, name: true, slug: true },
            }),
        ]);

        return { products, categories };
    }

    /**
     * Prodotti per id, nell'ordine chiesto.
     *
     * Serve ai "visti di recente": la cronologia sta nel browser (nessun motivo di
     * tenerla sul server) e qui si recuperano solo i dati aggiornati. L'ordine dato
     * dal client va rispettato, altrimenti la lista si rimescola a ogni caricamento.
     */
    async findByIds(ids: string[]) {
        const wanted = ids.slice(0, 20);
        if (wanted.length === 0) return [];

        const products = await this.prisma.product.findMany({
            where: { id: { in: wanted }, isActive: true, deletedAt: null },
            include: {
                images: { where: { isCover: true }, take: 1 },
                discounts: { where: { isActive: true }, take: 1, select: { type: true, value: true, label: true } },
            },
        });

        const byId = new Map(products.map((product) => [product.id, product]));
        return wanted.map((id) => byId.get(id)).filter(Boolean);
    }
}

/**
 * Conta **prodotti distinti** per valore, non righe di variante: lo stesso prodotto
 * con cinque taglie nero non vale cinque.
 */
function countDistinctProducts<T extends { productId: string }>(
    rows: T[],
    key: (row: T) => string | null,
): { key: string; count: number }[] {
    const groups = new Map<string, Set<string>>();
    for (const row of rows) {
        const value = key(row);
        if (!value) continue;
        const bucket = groups.get(value) ?? new Set<string>();
        bucket.add(row.productId);
        groups.set(value, bucket);
    }
    return [...groups.entries()]
        .map(([value, products]) => ({ key: value, count: products.size }))
        .sort((a, b) => b.count - a.count);
}

/** Somma su ogni categoria anche i prodotti delle sue discendenti. */
function rollUpCategoryCounts(
    categories: { id: string; parentId: string | null }[],
    own: Map<string, number>,
): Map<string, number> {
    const children = new Map<string, string[]>();
    for (const category of categories) {
        if (!category.parentId) continue;
        children.set(category.parentId, [...(children.get(category.parentId) ?? []), category.id]);
    }

    const total = new Map<string, number>();
    const visit = (id: string, seen: Set<string>): number => {
        // La guardia sui cicli evita un ricorsivo infinito se i dati fossero storti.
        if (seen.has(id)) return 0;
        seen.add(id);
        const sum =
            (own.get(id) ?? 0) +
            (children.get(id) ?? []).reduce((acc, child) => acc + visit(child, seen), 0);
        total.set(id, sum);
        return sum;
    };

    for (const category of categories) visit(category.id, new Set());
    return total;
}
