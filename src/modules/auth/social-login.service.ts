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

/**
 * Bentuk mentah response Facebook Graph `/me?fields=id,name,email,picture`.
 * Field opsional (bukan `id`/`email`) sengaja dibuat optional karena
 * Graph API tidak selalu mengembalikan semuanya (mis. user tidak
 * mengizinkan scope tertentu).
 */
interface FacebookProfileResponse {
  id: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

/** Bentuk mentah response Google `oauth2/v3/userinfo`. */
interface GoogleProfileResponse {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
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
    const baseUrl = this.config.getOrThrow<string>('FACEBOOK_GRAPH_URL');

    const response = await firstValueFrom(
      this.httpService.get<FacebookProfileResponse>(`${baseUrl}/me`, {
        params: { fields: 'id,name,email,picture', access_token: accessToken },
      }),
    ).catch((): never => {
      throw new BadRequestException(
        'Gagal memverifikasi access token Facebook.',
      );
    });

    const data = response.data;

    if (!data.email) {
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
    const url = this.config.getOrThrow<string>('GOOGLE_USERINFO_URL');

    const response = await firstValueFrom(
      this.httpService.get<GoogleProfileResponse>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ).catch((): never => {
      throw new BadRequestException('Gagal memverifikasi access token Google.');
    });

    const data = response.data;

    if (!data.email) {
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
