import { IsString, IsNumber, Min } from 'class-validator';

export class ValidatePromoDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  orderAmount: number;
}
