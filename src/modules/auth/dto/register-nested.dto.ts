import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/** Sub-objek `profile` pada RegisterRequest.php */
export class RegisterProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsArray()
  socials?: unknown[];
}

/**
 * Sub-objek `address` pada RegisterRequest.php.
 * required_with:address di Laravel -> di sini cukup @IsString wajib,
 * karena kalau object `address` tidak dikirim sama sekali, field ini juga
 * tidak divalidasi (lihat @IsOptional di RegisterDto.address).
 */
export class RegisterAddressDto {
  @IsString()
  @MaxLength(255)
  street_address!: string;

  @IsString()
  @MaxLength(255)
  city!: string;

  @IsString()
  @MaxLength(255)
  state!: string;

  @IsString()
  @MaxLength(20)
  zip!: string;

  @IsString()
  @MaxLength(255)
  country!: string;
}
