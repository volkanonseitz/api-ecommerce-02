import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

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
  @Transform(({ value }): unknown[] | undefined => {
    if (!value) return undefined;

    return typeof value === 'string'
      ? (JSON.parse(value) as unknown[])
      : (value as unknown[]);
  })
  @IsArray()
  socials?: unknown[];
}

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
