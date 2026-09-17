import { IsArray, IsString, IsNumber, IsOptional, IsEnum, ValidateNested, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @IsUUID('loose')
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
}

export class CheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsUUID('loose')
  addressId: string;

  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod;

  @IsOptional()
  @IsString()
  promoCode?: string;

  /** Codice della gift card da scalare su questo ordine. */
  @IsOptional()
  @IsString()
  giftCardCode?: string;

  /** Punti fedelta' da convertire in sconto su questo ordine. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loyaltyPoints?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
