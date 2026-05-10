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

export class AdminUsersQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'user', ''])
  role?: string;
}

export class AdminProductsQueryDto extends AdminListQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class AdminPromoQueryDto extends AdminListQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['percentage', 'fixed_amount', ''])
  discountType?: string;
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

export class AdminReturnsQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateReturnStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected', 'received', 'refunded'])
  status: string;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  refundAmount?: number;
}

export class AdminExportOrdersQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

// ─── Variants ──────────────────────────────────────────────────────────────

export class CreateVariantDto {
  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  colorHex?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceOverride?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  colorHex?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceOverride?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Images ────────────────────────────────────────────────────────────────

export class CreateImageDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}
