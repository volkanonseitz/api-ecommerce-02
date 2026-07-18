import { IsEmail, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class AddStaffDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEmail()
  email!: string;

  // Aturan lama: min 8, upper+lower+digit, TANPA wajib karakter spesial (sama seperti AdminCreateUserDto).
  @IsStrongPassword({
    minLength: 8,
    requireSpecialChar: false,
    forbidRepeatingChars: false,
  })
  password!: string;
}
