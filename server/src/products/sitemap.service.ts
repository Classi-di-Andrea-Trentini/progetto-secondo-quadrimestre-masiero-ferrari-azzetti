import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sitemap e `robots.txt`.
 *
 * Un negozio senza sitemap si fa indicizzare a fortuna: le schede prodotto sono
 * raggiungibili solo passando per i filtri, che un motore di ricerca esplora male.
 * Qui l'elenco è generato dal catalogo, quindi non invecchia da solo.
 *
 * Vengono escluse le pagine che non hanno senso nei risultati (account, carrello,
 * checkout): indicizzarle porta visite che finiscono su una schermata di login.
 */

/** Pagine fisse che vale la pena far trovare. */
const STATIC_PATHS: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/products', priority: '0.9', changefreq: 'daily' },
  { path: '/about', priority: '0.5', changefreq: 'monthly' },
];

@Injectable()
export class SitemapService {
  constructor(private prisma: PrismaService) {}

  async build(baseUrl: string): Promise<string> {
    const base = baseUrl.replace(/\/$/, '');

    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true, deletedAt: null },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      }),
    ]);

    const entries = [
      ...STATIC_PATHS.map((entry) => ({
        loc: `${base}${entry.path}`,
        lastmod: null as Date | null,
        changefreq: entry.changefreq,
        priority: entry.priority,
      })),
      ...categories.map((category) => ({
        // Le categorie non hanno una rotta propria: si arriva alla lista filtrata.
        loc: `${base}/products?category=${encodeURIComponent(category.id)}`,
        lastmod: null as Date | null,
        changefreq: 'weekly',
        priority: '0.7',
      })),
      ...products.map((product) => ({
        loc: `${base}/product/${encodeURIComponent(product.slug)}`,
        lastmod: product.updatedAt,
        changefreq: 'weekly',
        priority: '0.8',
      })),
    ];

    const body = entries
      .map(
        (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${
      entry.lastmod ? `\n    <lastmod>${entry.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''
    }
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
  }

  robots(baseUrl: string): string {
    const base = baseUrl.replace(/\/$/, '');
    return [
      'User-agent: *',
      // Pagine personali o di passaggio: farle indicizzare porta visite inutili.
      'Disallow: /me',
      'Disallow: /checkout',
      'Disallow: /login',
      'Disallow: /register',
      'Disallow: /reset-password',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n');
  }
}

/** L'`&` di un `?category=` non escapato basta a rendere la sitemap XML non valida. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
