import { Controller, Get, Query, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products.dto';

@Controller('products')
export class ProductsController {
    public constructor(private readonly productsService: ProductsService) {}

    @Get()
    products(@Query() dto: GetProductsDto) {
        return this.productsService.findAll(dto);
    }

    @Get()
    product(@Param('id') id: string) {
        return this.productsService.findOne(id);
    }
}
