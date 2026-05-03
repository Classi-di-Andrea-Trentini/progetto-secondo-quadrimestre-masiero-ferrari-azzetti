import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, IsIn, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetProductsDto {
    // ricerca testuale nome
    @IsOptional() @IsString()
    search?: string;

    // per categoria
    @IsOptional() @IsString()
    categoryId?: string;

    // per "brand"
    @IsOptional() @IsString()
    brand?: string;

    // prezzi MINIMO e MASSIMO
    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    minPrice?: number;

    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    maxPrice?: number;

    // per "featured" e "new arrival"
    @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean()
    isFeatured?: boolean;

    @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean()
    isNewArrival?: boolean;

    // Filtro colori: ?colors[]=#FF0000&colors[]=#000000
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    @IsArray()
    colors?: string[];

    // Filtro taglie: ?sizes[]=M&sizes[]=L
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    @IsArray()
    sizes?: string[];

    // ordinamento: newest, popular, price_asc, price_desc, rating
    @IsOptional() @IsString()
    @IsIn(['newest', 'popular', 'price_asc', 'price_desc', 'rating'])
    sortBy?: string = 'newest';

    // paginazione
    @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
    page?: number = 1;

    // LIMITE
    @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100)
    limit?: number = 24;
}
