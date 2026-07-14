import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface RefreshTokenPayload {
  sub: number;
  sid: string;
}

export interface RefreshTokenSubject {
  userId: number;
  sessionId: string;
  sessionDbId: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: RefreshTokenPayload): Promise<RefreshTokenSubject> {
    const session = await this.prisma.userSession.findFirst({
      where: { tokenId: payload.sid, userId: payload.sub },
    });

    if (!session) {
      throw new UnauthorizedException(
        'Refresh token tidak valid atau sudah dicabut.',
      );
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      sessionDbId: session.id,
    };
  }
}
