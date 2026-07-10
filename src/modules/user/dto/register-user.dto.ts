import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsObject,
} from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'Password harus mengandung huruf kapital' })
  @Matches(/[a-z]/, { message: 'Password harus mengandung huruf kecil' })
  @Matches(/[0-9]/, { message: 'Password harus mengandung angka' })
  @Matches(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'Password harus mengandung karakter spesial',
  })
  password: string;

  @IsOptional()
  @IsObject()
  profile?: {
    avatar?: string;
    bio?: string;
    socials?: any;
  };

  @IsOptional()
  @IsObject()
  address?: {
    street_address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  @IsOptional()
  @IsString()
  permission?: string; // hanya store_owner yang diizinkan dari public
}
