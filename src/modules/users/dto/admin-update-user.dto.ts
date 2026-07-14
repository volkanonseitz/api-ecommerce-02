import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Padanan AdminUpdateUserRequest.php — shop_id BOLEH diubah di sini (khusus admin). */
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
