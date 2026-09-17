import { Controller, Get, Query, Param, Inject } from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products.dto';

@Controller('products')
export class ProductsController {
    // inject del servizio
    constructor(@Inject(ProductsService) private productsService: ProductsService) {}

    // filtro -> valori disponibili, con quanti prodotti hanno ciascuno
    @Get('filters')
    getFilters() {
        return this.productsService.getFilters();
    }

    /**
     * Suggerimenti per la barra di ricerca. Sta **prima** di `:slug`, altrimenti
     * Nest interpreterebbe "suggest" come lo slug di un prodotto.
     */
    @Get('suggest')
    suggest(@Query('q') q: string) {
        return this.productsService.suggest(q ?? '');
    }

    /** Prodotti per id: la cronologia dei "visti di recente" vive nel browser. */
    @Get('by-ids')
    byIds(@Query('ids') ids: string) {
        return this.productsService.findByIds((ids ?? '').split(',').filter(Boolean));
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
