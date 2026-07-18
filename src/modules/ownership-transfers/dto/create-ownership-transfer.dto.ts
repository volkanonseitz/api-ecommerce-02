import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateOwnershipTransferDto {
  @IsInt()
  shop_id!: number;

  @IsInt()
  vendor_id!: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  vendorMessage?: string;
}
