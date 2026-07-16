import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';
import {
  RegisterAddressDto,
  RegisterProfileDto,
} from '../../auth/dto/register-nested.dto';

export class AdminCreateUserDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEmail()
  email!: string;

  // Aturan lama: min 8, upper+lower+digit, TANPA wajib karakter spesial.
  @IsStrongPassword({
    minLength: 8,
    requireSpecialChar: false,
    forbidRepeatingChars: false,
  })
  password!: string;

  @IsOptional()
  @IsInt()
  shop_id?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterProfileDto)
  profile?: RegisterProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterAddressDto)
  address?: RegisterAddressDto;
}
