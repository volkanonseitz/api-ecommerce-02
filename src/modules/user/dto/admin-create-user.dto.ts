import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsInt,
  IsObject,
} from 'class-validator';

export class AdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Z]/)
  @Matches(/[a-z]/)
  @Matches(/[0-9]/)
  password: string;

  @IsOptional()
  @IsInt()
  shop_id?: number;

  @IsOptional()
  @IsObject()
  profile?: object;

  @IsOptional()
  @IsObject()
  address?: object;
}
