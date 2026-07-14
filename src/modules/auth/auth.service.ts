import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { RbacService } from '../../common/services/rbac.service';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginService } from './social-login.service';
import { EmailVerificationService } from './email-verification.service';
import type { User } from '@prisma/client';
import {
  AccountLockedException,
  EmailUnverifiedException,
  InvalidCredentialsException,
} from '../../common/exceptions/app.exceptions';
import type { StringValue } from 'ms';

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
    private readonly socialLoginService: SocialLoginService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async attemptLogin(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Mitigasi timing-attack: tetap lakukan hash compare walau user tidak
      // ada, supaya waktu respons "email tidak ditemukan" vs "password salah"
      // tidak bisa dibedakan penyerang. Dibungkus try/catch karena hash dummy
      // di bawah cuma perlu makan waktu yang setara, bukan untuk divalidasi.
      await bcrypt
        .compare(
          'dummy_password',
          '$2b$12$CwTycUXWue0Thq9StjUM0uJ8i9G0G0Zk6q6c6Zk6c6Zk6c6Zk6c6O',
        )
        .catch(() => undefined);
      throw new InvalidCredentialsException();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AccountLockedException(user.lockedUntil);
    }

    if (
      !user.isActive ||
      !user.password ||
      !(await bcrypt.compare(password, user.password))
    ) {
      await this.registerFailedLoginAttempt(user.id, user.failedLoginAttempts);
      throw new InvalidCredentialsException();
    }

    if (!user.emailVerifiedAt) {
      throw new EmailUnverifiedException();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: meta.ip,
        lastLoginUserAgent: meta.userAgent.slice(0, 1000),
      },
    });

    return this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  }

  private async registerFailedLoginAttempt(
    userId: number,
    currentAttempts: number,
  ): Promise<void> {
    const attempts = currentAttempts + 1;
    const data: { failedLoginAttempts: number; lockedUntil?: Date } = {
      failedLoginAttempts: attempts,
    };
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      data.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
    }
    await this.prisma.user.update({ where: { id: userId }, data });
  }

  /**
   * Padanan RegisterUserAction::execute() + event Registered (yang di
   * Laravel otomatis memicu $user->sendEmailVerificationNotification()
   * lewat SendEmailVerificationNotification listener bawaan framework).
   * shop_id, is_active, dll TIDAK PERNAH ikut karena RegisterDto memang
   * tidak membawa field itu sama sekali (whitelist eksplisit, lihat
   * catatan di register.dto.ts).
   */
  async register(dto: RegisterDto): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    // Defense in depth: permission yang diminta divalidasi ulang di sini,
    // tidak pernah percaya begitu saja walau DTO sudah membatasi ke 'store_owner'.
    const grantedPermission =
      dto.permission === 'store_owner' ? 'store_owner' : 'customer';

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: passwordHash,
          // emailVerifiedAt SENGAJA null (padanan MustVerifyEmail) — baru
          // di-set setelah user klik link verifikasi (lihat email-verification.service.ts).
        },
      });

      if (dto.profile) {
        await tx.userProfile.create({
          data: {
            customerId: created.id,
            avatar: dto.profile.avatar
              ? { original: dto.profile.avatar }
              : undefined,
            bio: dto.profile.bio,
            socials: dto.profile.socials as object | undefined,
          },
        });
      }

      if (dto.address) {
        await tx.address.create({
          data: {
            customerId: created.id,
            title: 'Utama',
            type: 'home',
            address: {
              street_address: dto.address.street_address,
              city: dto.address.city,
              state: dto.address.state,
              zip: dto.address.zip,
              country: dto.address.country,
            },
          },
        });
      }

      return created;
    });

    await this.rbac.grantPermission(user.id, grantedPermission);
    await this.rbac.assignRole(user.id, grantedPermission);

    // Fire-and-forget: kegagalan kirim email TIDAK boleh menggagalkan
    // registrasi (user masih bisa minta kirim ulang lewat POST /auth/email/resend).
    this.emailVerificationService
      .sendVerificationEmail(user)
      .catch(() => undefined);

    return user;
  }

  /** Padanan SocialLoginService.php (handle()). */
  async socialLogin(
    provider: 'facebook' | 'google',
    accessToken: string,
    meta: RequestMeta,
  ): Promise<User> {
    const profile = await this.socialLoginService.fetchProfile(
      provider,
      accessToken,
    );

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existingUser) {
      const linked = await this.prisma.provider.findFirst({
        where: { userId: existingUser.id, provider },
      });
      if (!linked) {
        throw new ConflictException(
          `Email sudah terdaftar. Silakan tautkan akun ${provider} dari pengaturan profil Anda.`,
        );
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.user.upsert({
        where: { email: profile.email },
        create: {
          email: profile.email,
          name: profile.name,
          emailVerifiedAt: new Date(),
        },
        update: {},
      });

      const existingProvider = await tx.provider.findFirst({
        where: { userId: upserted.id, provider },
      });
      if (existingProvider) {
        await tx.provider.update({
          where: { id: existingProvider.id },
          data: { providerUserId: profile.providerId },
        });
      } else {
        await tx.provider.create({
          data: {
            userId: upserted.id,
            provider,
            providerUserId: profile.providerId,
          },
        });
      }

      if (profile.avatar) {
        const existingProfile = await tx.userProfile.findUnique({
          where: { customerId: upserted.id },
        });
        if (existingProfile) {
          await tx.userProfile.update({
            where: { customerId: upserted.id },
            data: {
              avatar: { thumbnail: profile.avatar, original: profile.avatar },
            },
          });
        } else {
          await tx.userProfile.create({
            data: {
              customerId: upserted.id,
              avatar: { thumbnail: profile.avatar, original: profile.avatar },
            },
          });
        }
      }

      await tx.user.update({
        where: { id: upserted.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: meta.ip,
          lastLoginUserAgent: meta.userAgent.slice(0, 1000),
        },
      });

      return upserted;
    });

    const isStaffOrAbove = await this.rbac.hasAnyRole(user.id, [
      'super_admin',
      'store_owner',
      'staff',
    ]);
    if (!isStaffOrAbove) {
      await this.rbac.grantPermission(user.id, 'customer');
      await this.rbac.assignRole(user.id, 'customer');
    }

    return user;
  }

  /** Padanan issueToken() lama, tapi menerbitkan SEPASANG token (access+refresh). */
  async issueTokenPair(userId: number, meta: RequestMeta): Promise<TokenPair> {
    const sessionId = randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as StringValue,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          '7d') as StringValue,
      },
    );

    await this.prisma.userSession.create({
      data: {
        userId,
        tokenId: sessionId,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        lastActivityAt: new Date(),
      },
    });

    return { accessToken, refreshToken, sessionId };
  }

  /**
   * Padanan token rotation: refresh token lama otomatis invalid setelah
   * dipakai sekali (session row di-update ke sid baru), mendeteksi
   * replay/pencurian refresh token.
   */
  async rotateTokenPair(
    userId: number,
    sessionDbId: number,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const sessionId = randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as StringValue,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') ??
          '7d') as StringValue,
      },
    );

    await this.prisma.userSession.update({
      where: { id: sessionDbId },
      data: {
        tokenId: sessionId,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        lastActivityAt: new Date(),
      },
    });

    return { accessToken, refreshToken, sessionId };
  }

  /** Padanan AuthService::logout() (satu sesi/device saat ini). */
  async logout(userId: number, sessionId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId, tokenId: sessionId },
    });
  }
}
