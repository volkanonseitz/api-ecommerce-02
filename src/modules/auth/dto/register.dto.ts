import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';
import { RegisterAddressDto, RegisterProfileDto } from './register-nested.dto';

/**
 * Padanan RegisterRequest.php.
 * Catatan penting yang DIPERTAHANKAN dari versi lama:
 * - `shop_id` SENGAJA tidak ada field-nya di sini sama sekali. Kalau client
 *   kirim shop_id di body, class-transformer/whitelist (lihat main.ts,
 *   ValidationPipe { whitelist: true }) akan membuang field itu sebelum
 *   sampai ke AuthService -> mencegah mass assignment, sama seperti dulu.
 * - `permission` hanya boleh 'store_owner'; nilai lain (termasuk
 *   'super_admin') ditolak di sini DAN dicek ulang di AuthService
 *   (defense in depth, meniru RegisterUserAction lama).
 */
export class RegisterDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEmail()
  email!: string;

  @IsStrongPassword({
    minLength: 12,
    requireSpecialChar: true,
    forbidRepeatingChars: true,
  })
  password!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterProfileDto)
  profile?: RegisterProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterAddressDto)
  address?: RegisterAddressDto;

  @IsOptional()
  @IsIn(['store_owner'])
  permission?: string;
}
