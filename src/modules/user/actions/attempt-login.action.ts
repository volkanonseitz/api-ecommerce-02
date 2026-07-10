import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UserSecurityService } from '../services/user-security.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AttemptLoginAction {
  constructor(
    private prisma: PrismaService,
    private securityService: UserSecurityService,
  ) {}

  async execute(
    email: string,
    password: string,
    ip: string,
    userAgent: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Timing attack mitigation
      await bcrypt.compare('dummy', '$2y$10$' + '0'.repeat(53));
      return { status: 'invalid' };
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return { status: 'locked', lockedUntil: user.lockedUntil };
    }

    if (!user.isActive || !(await bcrypt.compare(password, user.password))) {
      await this.securityService.handleFailedLoginAttempt(
        user.id,
        ip,
        userAgent,
      );
      return { status: 'invalid' };
    }

    if (!user.emailVerifiedAt) {
      return { status: 'unverified', user };
    }

    // Sukses
    await this.securityService.registerSuccessfulLogin(user.id, ip, userAgent);
    return { status: 'success', user };
  }
}
