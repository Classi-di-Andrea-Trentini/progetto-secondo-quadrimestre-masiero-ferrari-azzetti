import { Controller, Get, Query, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products.dto';

@Controller('products')
export class ProductsController {
    public constructor(private readonly productsService: ProductsService) {}

    @Get('filters')
    getFilters() {
        return this.productsService.getFilters();
    }

    @Get()
    products(@Query() dto: GetProductsDto) {
        return this.productsService.findAll(dto);
    }

    @Get(':slug')
    product(@Param('slug') slug: string) {
        return this.productsService.findBySlug(slug);
    }
}