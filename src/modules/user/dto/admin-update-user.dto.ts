import {
  IsOptional,
  IsString,
  MaxLength,
  IsEmail,
  IsInt,
} from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  shop_id?: number;
}
