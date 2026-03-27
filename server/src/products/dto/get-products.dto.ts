import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, IsIn, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetProductsDto {
    @IsOptional() @IsString()
    search?: string;

    @IsOptional() @IsString()
    categoryId?: string;

    @IsOptional() @IsString()
    brand?: string;

    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    minPrice?: number;

    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    maxPrice?: number;

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

    @IsOptional() @IsString()
    @IsIn(['newest', 'popular', 'price_asc', 'price_desc', 'rating'])
    sortBy?: string = 'newest';

    @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
    page?: number = 1;

    @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100)
    limit?: number = 24;
}
