import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
  @IsString()
  old_password!: string;

  @IsStrongPassword({
    minLength: 12,
    requireSpecialChar: true,
    forbidRepeatingChars: true,
  })
  new_password!: string;
}
