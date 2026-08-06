import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SitemapService } from './sitemap.service';
import { SitemapController } from './sitemap.controller';

@Module({
  controllers: [ProductsController, SitemapController],
  providers: [ProductsService, SitemapService]
})
export class ProductsModule {}
