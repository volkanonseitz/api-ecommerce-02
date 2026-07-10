import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PermissionService } from './permission.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SocialLoginService {
  constructor(
    private prisma: PrismaService,
    private permissionService: PermissionService,
  ) {}

  async handle(provider: string, accessToken: string): Promise<any> {
    // Gunakan library Socialite atau axios untuk verifikasi token
    // Di sini kita asumsikan sudah mendapat data user dari provider
    // Misal: { email, name, id, avatar }
    // Implementasi nyata perlu memanggil API provider
    // Contoh dummy:
    const socialUser = await this.verifyToken(provider, accessToken);
    const email = socialUser.email;
    if (!email)
      throw new BadRequestException('Email tidak diberikan oleh provider');

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      // Cek apakah sudah terlink dengan provider ini
      const linked = await this.prisma.providers.findFirst({
        where: { userId: user.id, provider },
      });
      if (!linked) {
        throw new ConflictException(
          `Email sudah terdaftar. Silakan link akun ${provider} dari pengaturan profil.`,
        );
      }
    } else {
      // Buat user baru
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.users.create({
          data: {
            name: socialUser.name || 'User',
            email,
            email_verified_at: new Date(),
            password: await bcrypt.hash(Math.random().toString(36), 10),
          },
        });
        // Assign permission customer
        await this.permissionService.assignPermission(newUser.id, 'customer');
        // Assign role customer
        // Asumsikan ada tabel roles, kita assign role customer
        const role = await tx.role.findUnique({ where: { name: 'customer' } });
        if (role) {
          await tx.model_has_roles.create({
            data: {
              role_id: role.id,
              model_id: newUser.id,
              model_type: 'App\\Models\\User',
            },
          });
        }
        // Profile
        if (socialUser.avatar) {
          await tx.user_profiles.create({
            data: {
              customerId: newUser.id,
              avatar: {
                thumbnail: socialUser.avatar,
                original: socialUser.avatar,
              },
            },
          });
        }
        return newUser;
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        last_login_ip: '0.0.0.0', // bisa ambil dari request
        last_login_user_agent: 'social',
      },
    });

    return user;
  }

  private async verifyToken(provider: string, token: string): Promise<any> {
    // Implementasi dengan axios ke provider API
    // Misal untuk google: https://www.googleapis.com/oauth2/v3/userinfo?access_token=...
    // Untuk facebook: https://graph.facebook.com/me?access_token=...
    // Kembalikan { email, name, id, avatar }
    // Untuk contoh, kita return dummy
    return {
      email: 'social@example.com',
      name: 'Social User',
      id: '12345',
      avatar: 'https://avatar.com/123',
    };
  }
}
