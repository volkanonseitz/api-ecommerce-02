import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['facebook', 'google'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  access_token: string;
}
