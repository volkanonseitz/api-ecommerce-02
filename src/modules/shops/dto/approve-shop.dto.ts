import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ApproveShopDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  admin_commission_rate?: number;

  @IsOptional()
  @IsBoolean()
  is_custom_commission?: boolean;
}
