import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class TransferOwnershipDto {
  @IsInt()
  shop_id!: number;

  @IsInt()
  vendor_id!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  vendorMessage?: string;
}
