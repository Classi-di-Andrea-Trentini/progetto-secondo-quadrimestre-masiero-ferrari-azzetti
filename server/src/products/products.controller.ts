import { Controller, Get, Query, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products.dto';

@Controller('products')
export class ProductsController {
    public constructor(private readonly productsService: ProductsService) {}

    @Get()
    findAll(@Query() dto: GetProductsDto) {
        return this.productsService.findAll(dto);
    }

    @Get('filters')
    getFilters() {
        return this.productsService.getFilters();
    }

    @Get(':slug')
    findBySlug(@Param('slug') slug: string) {
        return this.productsService.findBySlug(slug);
    @Get(':id')
    product(@Param('id') id: string) {
        return this.productsService.findOne(id);
    }
}
