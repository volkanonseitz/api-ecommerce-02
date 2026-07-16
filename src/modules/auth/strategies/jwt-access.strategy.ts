import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AuthUser } from '../../../types/auth-user.type';

export interface AccessTokenPayload {
  sub: number;
  sid: string; // session id (UUID), disimpan juga di UserSession.tokenId
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
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

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          roles: { include: { role: true } },
          permissions: { include: { permission: true } },
        },
      }),
      this.prisma.userSession.findFirst({
        where: { tokenId: payload.sid, userId: payload.sub },
      }),
    ]);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif atau tidak ditemukan.');
    }

    if (!session) {
      // Sesi sudah dicabut (logout / revoke session / logout semua perangkat).
      throw new UnauthorizedException(
        'Sesi sudah berakhir, silakan login kembali.',
      );
    }

    // Padanan trackSessionActivity() -> update last_activity_at tiap request
    // (fire-and-forget, tidak perlu di-await supaya tidak menambah latensi).
    void this.prisma.userSession
      .update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      })
      .catch(() => undefined);

    const roleNames = user.roles.map((r) => r.role.name);
    const rolePermissionNames = await this.prisma.roleHasPermission.findMany({
      where: { roleId: { in: user.roles.map((r) => r.roleId) } },
      include: { permission: true },
    });

    const permissionNames = new Set<string>([
      ...user.permissions.map((p) => p.permission.name),
      ...rolePermissionNames.map((rp) => rp.permission.name),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      sessionId: payload.sid,
      roles: roleNames,
      permissions: Array.from(permissionNames),
    };
  }
}
