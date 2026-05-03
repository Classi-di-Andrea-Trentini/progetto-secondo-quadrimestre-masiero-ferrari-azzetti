import { Controller, Get, Query, Param, Inject } from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products.dto';

@Controller('products')
export class ProductsController {
    // inject del servizio 
    constructor(@Inject(ProductsService) private productsService: ProductsService) {}

    // 3 metodi get
    // filtro -> prende un prodotto filtrato secondo il metodo 
    @Get('filters')
    getFilters() {
        return this.productsService.getFilters();
    }

    // get --> prende un prodotto con findAll
    @Get()
    products(@Query() dto: GetProductsDto) {
        return this.productsService.findAll(dto);
    }

    // in base a slug
    @Get(':slug')
    product(@Param('slug') slug: string) {
        return this.productsService.findBySlug(slug);
    }
}