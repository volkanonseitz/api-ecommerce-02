import { IsIn, IsString } from 'class-validator';

/** Padanan SocialLoginRequest.php */
export class SocialLoginDto {
  @IsIn(['facebook', 'google'])
  provider!: 'facebook' | 'google';

  @IsString()
  access_token!: string;
}
