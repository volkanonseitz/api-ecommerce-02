import { IsIn, IsString } from 'class-validator';

export class SocialLoginDto {
  @IsIn(['facebook', 'google'])
  provider!: 'facebook' | 'google';

  @IsString()
  access_token!: string;
}
