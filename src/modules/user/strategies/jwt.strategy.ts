import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // payload berisi { sub: userId, email, iat, exp }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profile: true,
        // include permissions, roles jika diperlukan
      },
    });
    if (!user) {
      throw new Error('User not found');
    }
    // Tambahkan permissions ke user object
    const permissions = await this.prisma.model_has_permissions.findMany({
      where: { model_id: user.id, model_type: 'App\\Models\\User' },
      include: { permission: true },
    });
    const roles = await this.prisma.model_has_roles.findMany({
      where: { model_id: user.id, model_type: 'App\\Models\\User' },
      include: { role: true },
    });
    return {
      ...user,
      permissions: permissions.map((p) => p.permission.name),
      roles: roles.map((r) => r.role.name),
    };
  }
}
