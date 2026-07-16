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
