import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export interface StrongPasswordOptions {
  minLength?: number;
  requireSpecialChar?: boolean;
  forbidRepeatingChars?: boolean;
}

/**
 * Versi "murni" (bukan decorator) dari aturan password, dipakai ulang oleh
 * UsersSecurityService untuk menghasilkan pesan error per-field seperti
 * UserSecurityService::validatePasswordStrength() lama (yang mengembalikan
 * array pesan, bukan cuma true/false).
 */
export function evaluatePasswordStrength(
  password: string,
  options: StrongPasswordOptions = {},
): string[] {
  const { minLength = 12, requireSpecialChar = true, forbidRepeatingChars = true } = options;
  const errors: string[] = [];

  if (password.length < minLength) errors.push(`Password minimal ${minLength} karakter`);
  if (!/[A-Z]/.test(password)) errors.push('Password harus mengandung huruf kapital');
  if (!/[a-z]/.test(password)) errors.push('Password harus mengandung huruf kecil');
  if (!/[0-9]/.test(password)) errors.push('Password harus mengandung angka');
  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password harus mengandung karakter spesial');
  }
  if (forbidRepeatingChars) {
    if (/(\d)\1{2,}/.test(password)) errors.push('Password tidak boleh memiliki angka berulang 3x berturut-turut');
    if (/([A-Za-z])\1{2,}/.test(password)) errors.push('Password tidak boleh memiliki huruf berulang 3x berturut-turut');
  }

  return errors;
}

/**
 * Padanan aturan regex password di Laravel FormRequest lama
 * (RegisterRequest / ChangePasswordRequest / AdminCreateUserRequest),
 * digabung jadi satu custom validator supaya tidak perlu tumpukan
 * @Matches terpisah di setiap DTO.
 *
 * Default (dipakai RegisterRequest & ChangePasswordRequest lama):
 *   - minimal 12 karakter
 *   - ada huruf besar, huruf kecil, angka, karakter spesial
 *   - tidak boleh ada 3+ karakter/angka berulang berturut-turut
 *
 * Untuk AdminCreateUserRequest lama (min 8, tanpa wajib karakter spesial),
 * panggil @IsStrongPassword({ minLength: 8, requireSpecialChar: false, forbidRepeatingChars: false })
 */
export function IsStrongPassword(
  options: StrongPasswordOptions = {},
  validationOptions?: ValidationOptions,
) {
  const {
    minLength = 12,
    requireSpecialChar = true,
    forbidRepeatingChars = true,
  } = options;

  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return evaluatePasswordStrength(value, { minLength, requireSpecialChar, forbidRepeatingChars })
            .length === 0;
        },
        defaultMessage(): string {
          return (
            `Password minimal ${minLength} karakter dan harus mengandung huruf besar, ` +
            `huruf kecil, angka${requireSpecialChar ? ', karakter spesial' : ''}` +
            `${forbidRepeatingChars ? ', serta tidak boleh ada karakter berulang 3x berturut-turut' : ''}.`
          );
        },
      },
    });
  };
}
