import { IsEmail, IsString } from 'class-validator';

/** Padanan LoginRequest.php */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
