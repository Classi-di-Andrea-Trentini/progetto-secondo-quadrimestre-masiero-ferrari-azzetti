// src/products/dto/get-products.dto.ts
import { IsOptional, IsString, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetProductsDto {


    // ricerca
    @IsOptional()
    @IsString()
    search?: string;          

    // categoria
    @IsOptional()
    @IsString()
    categoryId?: string;      

    // brand
    @IsOptional()
    @IsString()
    brand?: string;           

    // prezzo minimo
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPrice?: number;        

    // prezzo massimo
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxPrice?: number;        

    // prodotti in vetrina (SCONTATI???)
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isFeatured?: boolean;     

    // nuovi arrivi
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isNewArrival?: boolean;   

    // divisione in pagine
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;        

    // limite risultati (DA GESTIRE)
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;      
}