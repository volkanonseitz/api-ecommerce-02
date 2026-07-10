import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class UserSecurityService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15; // minutes
  private readonly PASSWORD_HISTORY_LIMIT = 5;

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async enforceRateLimit(ip: string, identifier: string): Promise<boolean> {
    const key = `rate_limit:auth:${ip}:${identifier}`;
    const attempts = (await this.cacheManager.get<number>(key)) || 0;
    if (attempts >= 10) return false;
    await this.cacheManager.set(key, attempts + 1, 60);
    return true;
  }

  validatePasswordStrength(password: string): string[] {
    const errors: string[] = [];
    if (password.length < 12) errors.push('Password minimal 12 karakter');
    if (!/[A-Z]/.test(password))
      errors.push('Password harus mengandung huruf kapital');
    if (!/[a-z]/.test(password))
      errors.push('Password harus mengandung huruf kecil');
    if (!/[0-9]/.test(password)) errors.push('Password harus mengandung angka');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
      errors.push('Password harus mengandung karakter spesial');
    return errors;
  }

  async isPasswordInHistory(
    userId: number,
    newPassword: string,
  ): Promise<boolean> {
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: this.PASSWORD_HISTORY_LIMIT,
    });
    for (const record of history) {
      if (await bcrypt.compare(newPassword, record.password_hash)) {
        return true;
      }
    }
    return false;
  }

  async recordPasswordChange(
    userId: number,
    newPassword: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.passwordHistory.create({
      data: {
        userId: userId,
        passwordHash: hash,
      },
    });
    // Trim history
    const records = await this.prisma.passwordHistory.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      skip: this.PASSWORD_HISTORY_LIMIT,
    });
    for (const rec of records) {
      await this.prisma.passwordHistory.delete({ where: { id: rec.id } });
    }
  }

  async handleFailedLoginAttempt(
    userId: number,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return;
      const attempts = (user.failedLoginAttempts || 0) + 1;
      let lockedUntil = user.lockedUntil;
      if (attempts >= this.MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION * 60 * 1000);
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: lockedUntil,
        },
      });
      // Log
      console.log(`Failed login for user ${userId} from IP ${ip}`);
    });
  }

  async registerSuccessfulLogin(
    userId: number,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        last_login_at: new Date(),
        last_login_ip: ip,
        last_login_user_agent: userAgent?.substring(0, 1000),
      },
    });
  }

  async logoutFromAllDevices(userId: number): Promise<void> {
    // Delete all tokens (assuming using personal_access_tokens)
    await this.prisma.personal_access_tokens.deleteMany({
      where: { tokenable_id: userId, tokenable_type: 'App\\Models\\User' },
    });
  }

  async trackSessionActivity(
    userId: number,
    tokenId: string,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    await this.prisma.user_session.upsert({
      where: {
        user_id_token_id: { userId: userId, token_id: tokenId },
      },
      update: {
        ip_address: ip,
        user_agent: userAgent,
        last_activity_at: new Date(),
      },
      create: {
        userId: userId,
        token_id: tokenId,
        ip_address: ip,
        user_agent: userAgent,
        last_activity_at: new Date(),
      },
    });
  }
}
