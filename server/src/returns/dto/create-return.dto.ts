import { IsArray, IsString, IsUUID, IsInt, Min, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @IsUUID()
  orderItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateReturnDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @MinLength(10)
  reason: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}
