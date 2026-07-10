import {
  IsOptional,
  IsString,
  MaxLength,
  IsEmail,
  IsObject,
  IsArray,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsObject()
  profile?: {
    id?: number;
    bio?: string;
    avatar?: string;
    contact?: string;
    gender?: string;
    birth_date?: string;
  };

  @IsOptional()
  @IsArray()
  address?: Array<{
    id?: number;
    title?: string;
    type?: string;
    street_address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
    is_default?: boolean;
  }>;
}
