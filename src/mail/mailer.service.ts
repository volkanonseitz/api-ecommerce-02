import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Padanan Laravel Mail/Notification transport (`->via(['mail'])` +
 * `MailMessage`). Nodemailer dikonfigurasi lewat SMTP env — isi dengan
 * Mailtrap/SES/Sendgrid SMTP/dst sesuai provider yang dipakai production.
 *
 * Kalau SMTP_HOST belum diisi (mis. saat development lokal tanpa mail
 * server), email di-log ke console saja supaya alur register/verifikasi
 * tetap bisa dites tanpa mailer sungguhan.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.fromAddress = this.config.get<string>('MAIL_FROM_ADDRESS') ?? 'no-reply@example.com';
    this.fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'App';

    if (!host) {
      this.logger.warn('SMTP_HOST belum diset — email akan di-log ke console, tidak benar-benar dikirim.');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT') ?? 587),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: this.config.get('SMTP_USER')
        ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
        : undefined,
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV MAIL] To: ${options.to} | Subject: ${options.subject}\n${options.html}`);
      return;
    }

    await this.transporter.sendMail({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}
