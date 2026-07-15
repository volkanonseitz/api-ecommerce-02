import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import type { StringValue } from 'ms';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailerService } from '../../mail/mailer.service';
import { renderVerifyEmailTemplate } from '../../mail/templates/verify-email.template';

interface VerifyEmailTokenPayload {
  sub: number;
  hash: string; // sha1(email), padanan `sha1($notifiable->getEmailForVerification())` Laravel
}

/**
 * Padanan Illuminate\Auth\Notifications\VerifyEmail + VerifyEmailNotification.php
 * lama. Laravel default membuat "signed URL" sementara (temporarySignedRoute)
 * yang ditandatangani pakai APP_KEY dan berisi {id, hash, expires, signature}
 * sebagai beberapa query param terpisah.
 *
 * Di sini disederhanakan jadi SATU token JWT (berisi {sub, hash} + expiry
 * bawaan JWT) — properti keamanannya setara (signed, time-limited, tidak
 * bisa dipalsukan tanpa secret), tapi lebih sederhana untuk API-only
 * service seperti ini (tidak perlu route bernama + rekonstruksi signature).
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  private hashEmail(email: string): string {
    return createHash('sha1').update(email).digest('hex');
  }

  private get expiresInMinutes(): number {
    return Number(this.config.get('EMAIL_VERIFICATION_EXPIRES_MINUTES') ?? 60);
  }

  private async generateToken(userId: number, email: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, hash: this.hashEmail(email) } satisfies VerifyEmailTokenPayload,
      {
        secret: this.config.getOrThrow<string>('EMAIL_VERIFICATION_SECRET'),
        expiresIn: `${this.expiresInMinutes}m` as StringValue,
      },
    );
  }

  private buildVerificationUrl(token: string): string {
    // Kalau ada frontend terpisah yang menangani halaman verifikasi,
    // set EMAIL_VERIFICATION_REDIRECT_URL ke halaman itu (mis.
    // https://app.example.com/verify-email) — dia tinggal membaca query
    // ?token=... lalu memanggil endpoint verify di bawah lewat fetch/XHR.
    // Kalau tidak diset, link mengarah langsung ke endpoint API ini
    // (browser akan menampilkan JSON hasil verifikasi).
    const base =
      this.config.get<string>('EMAIL_VERIFICATION_REDIRECT_URL') ??
      `${this.config.get<string>('APP_URL') ?? 'http://localhost:3000'}/api/auth/email/verify`;
    const url = new URL(base);
    url.searchParams.set('token', token);
    return url.toString();
  }

  /** Padanan `$user->sendEmailVerificationNotification()` (dipicu event Registered / resend). */
  async sendVerificationEmail(user: { id: number; email: string; name: string }): Promise<void> {
    const token = await this.generateToken(user.id, user.email);
    const url = this.buildVerificationUrl(token);

    await this.mailer.send({
      to: user.email,
      subject: 'Please verify your email',
      html: renderVerifyEmailTemplate({
        userName: user.name,
        verifyUrl: url,
        appName: this.config.get<string>('APP_NAME') ?? 'App',
        expiresInMinutes: this.expiresInMinutes,
      }),
    });
  }

  /** Padanan VerifyEmailController (route `verification.verify` bawaan Laravel). */
  async verify(token: string): Promise<{ alreadyVerified: boolean }> {
    let payload: VerifyEmailTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<VerifyEmailTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('EMAIL_VERIFICATION_SECRET'),
      });
    } catch {
      throw new BadRequestException('Link verifikasi tidak valid atau sudah kedaluwarsa.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new BadRequestException('Link verifikasi tidak valid.');
    }

    // Kalau email sudah diganti setelah link dikirim, hash tidak akan cocok
    // lagi -> link lama otomatis tidak berlaku (padanan perilaku Laravel).
    if (this.hashEmail(user.email) !== payload.hash) {
      throw new BadRequestException('Link verifikasi tidak valid untuk email saat ini.');
    }

    if (user.emailVerifiedAt) {
      return { alreadyVerified: true };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return { alreadyVerified: false };
  }
}
