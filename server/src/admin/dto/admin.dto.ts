import { IsString, IsIn, IsOptional, IsNumber, IsBoolean, Min, IsDateString, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class AdminListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminOrdersQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'])
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateUserRoleDto {
  @IsString()
  @IsIn(['user', 'admin'])
  role: string;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @Type(() => Number)
  @IsNumber()
  basePrice: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  basePrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePromoCodeDto {
  @IsString()
  code: string;

  @IsString()
  @IsIn(['percentage', 'fixed_amount'])
  discountType: string;

  @Type(() => Number)
  @IsNumber()
  discountValue: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AdminReviewsQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsString()
  status?: string; // 'pending' | 'approved' | 'rejected' | '' (all)
}

export class UpdateReviewStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: string;
}
