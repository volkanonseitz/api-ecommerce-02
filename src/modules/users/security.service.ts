import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { evaluatePasswordStrength } from '../../common/decorators/is-strong-password.decorator';

const PASSWORD_HISTORY_LIMIT = 5;

/**
 * Padanan App\Modules\User\Services\UserSecurityService.php.
 * enforceRateLimit() TIDAK di sini -> lihat common/services/rate-limiter.service.ts
 * (dipakai di AuthController, bukan spesifik ke satu user).
 */
@Injectable()
export class UsersSecurityService {
  constructor(private readonly prisma: PrismaService) {}

  validatePasswordStrength(password: string): string[] {
    return evaluatePasswordStrength(password, {
      minLength: 12,
      requireSpecialChar: true,
      forbidRepeatingChars: true,
    });
  }

  async isPasswordInHistory(userId: number, newPassword: string): Promise<boolean> {
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_LIMIT,
    });

    for (const entry of history) {
      if (await bcrypt.compare(newPassword, entry.passwordHash)) {
        return true;
      }
    }
    return false;
  }

  async recordPasswordChange(userId: number, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 12);

    await this.prisma.passwordHistory.create({
      data: { userId, passwordHash: hash },
    });

    // Trim history: sisakan PASSWORD_HISTORY_LIMIT entri terbaru saja.
    const stale = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: PASSWORD_HISTORY_LIMIT,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.passwordHistory.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }
  }

  /** Padanan logoutFromAllDevices() — hapus semua baris user_sessions milik user. */
  async logoutFromAllDevices(userId: number): Promise<void> {
    await this.prisma.userSession.deleteMany({ where: { userId } });
  }

  async listActiveSessions(userId: number) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        tokenId: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        createdAt: true,
      },
    });
  }

  async revokeSession(userId: number, sessionDbId: number, currentSessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionDbId, userId },
    });
    if (!session) {
      return { found: false as const };
    }
    if (session.tokenId === currentSessionId) {
      return { found: true as const, isCurrent: true as const };
    }
    await this.prisma.userSession.delete({ where: { id: session.id } });
    return { found: true as const, isCurrent: false as const };
  }
}
