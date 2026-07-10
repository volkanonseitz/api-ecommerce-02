import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UserSecurityService } from './user-security.service';
import { SocialLoginService } from './social-login.service';
import { AttemptLoginAction } from '../actions/attempt-login.action';
import { RegisterUserAction } from '../actions/register-user.action';
import { RegisterUserDto } from '../dto/register-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private securityService: UserSecurityService,
    private socialLoginService: SocialLoginService,
    private attemptLoginAction: AttemptLoginAction,
    private registerUserAction: RegisterUserAction,
  ) {}

  async attemptLogin(
    email: string,
    password: string,
    ip: string,
    userAgent: string,
  ) {
    return this.attemptLoginAction.execute(email, password, ip, userAgent);
  }

  async register(data: RegisterUserDto, requestedPermission: string | null) {
    const user = await this.registerUserAction.execute(
      data,
      requestedPermission,
    );
    await this.securityService.recordPasswordChange(user.id, data.password);
    return user;
  }

  async socialLogin(provider: string, accessToken: string) {
    return this.socialLoginService.handle(provider, accessToken);
  }

  async logout(userId: number, tokenId: string): Promise<boolean> {
    // Hapus token
    const deleted = await this.prisma.personal_access_tokens.delete({
      where: { id: Number(tokenId) },
    });
    if (deleted) {
      // Hapus session tracking
      await this.prisma.userSession.deleteMany({
        where: { userId: userId, token_id: tokenId },
      });
      return true;
    }
    return false;
  }

  issueToken(
    user: any,
    deviceName: string,
  ): { access_token: string; token_id: number } {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    // Simpan token ke personal_access_tokens? Atau kita simpan di tabel tokens? Kita bisa buat sendiri.
    // Karena kita pakai JWT stateless, kita tidak perlu menyimpan token. Tapi untuk fitur logout dari semua perangkat, kita perlu track.
    // Kita bisa menggunakan personal_access_tokens seperti Laravel Sanctum.
    // Di sini kita asumsikan kita tetap menyimpan token di personal_access_tokens.
    // Kita akan buat method createToken di service.
    // Mari kita buat method createToken terpisah.
    return { access_token: token, token_id: 1 }; // sementara
  }

  async createToken(
    userId: number,
    name: string,
    ip: string,
    userAgent: string,
  ): Promise<{ plainTextToken: string; tokenId: number }> {
    // Generate random token
    const token = this.jwtService.sign({ sub: userId });
    // Simpan ke personal_access_tokens
    const record = await this.prisma.personal_access_tokens.create({
      data: {
        tokenable_type: 'App\\Models\\User',
        tokenable_id: userId,
        name,
        token: token, // seharusnya hash
        abilities: null,
        last_used_at: new Date(),
        expires_at: null,
      },
    });
    // Track session
    await this.securityService.trackSessionActivity(
      userId,
      String(record.id),
      ip,
      userAgent,
    );
    return { plainTextToken: token, tokenId: record.id };
  }
}
