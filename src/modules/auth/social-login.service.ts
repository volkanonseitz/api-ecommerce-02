import { BadRequestException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface SocialProfile {
  providerId: string;
  email: string;
  name: string;
  avatar?: string;
}

@Injectable()
export class SocialLoginService {
  private static readonly ALLOWED_PROVIDERS = ['facebook', 'google'] as const;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async fetchProfile(
    provider: 'facebook' | 'google',
    accessToken: string,
  ): Promise<SocialProfile> {
    if (!SocialLoginService.ALLOWED_PROVIDERS.includes(provider)) {
      throw new BadRequestException(
        'Silakan login menggunakan Facebook atau Google.',
      );
    }

    return provider === 'facebook'
      ? this.fetchFacebookProfile(accessToken)
      : this.fetchGoogleProfile(accessToken);
  }

  private async fetchFacebookProfile(
    accessToken: string,
  ): Promise<SocialProfile> {
    const baseUrl = this.config.get<string>('FACEBOOK_GRAPH_URL');
    const { data } = await firstValueFrom(
      this.httpService.get(`${baseUrl}/me`, {
        params: { fields: 'id,name,email,picture', access_token: accessToken },
      }),
    ).catch(() => {
      throw new BadRequestException(
        'Gagal memverifikasi access token Facebook.',
      );
    });

    if (!data?.email) {
      throw new BadRequestException('Email not provided by social provider');
    }

    return {
      providerId: String(data.id),
      email: data.email,
      name: data.name ?? 'User',
      avatar: data.picture?.data?.url,
    };
  }

  private async fetchGoogleProfile(
    accessToken: string,
  ): Promise<SocialProfile> {
    const url = this.config.get<string>('GOOGLE_USERINFO_URL');
    const { data } = await firstValueFrom(
      this.httpService.get(url as string, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ).catch(() => {
      throw new BadRequestException('Gagal memverifikasi access token Google.');
    });

    if (!data?.email) {
      throw new BadRequestException('Email not provided by social provider');
    }

    return {
      providerId: String(data.sub),
      email: data.email,
      name: data.name ?? 'User',
      avatar: data.picture,
    };
  }
}
