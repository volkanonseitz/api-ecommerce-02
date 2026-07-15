import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailVerificationModule } from './modules/auth/email-verification.module';
import { UsersModule } from './modules/users/users.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAccessGuard } from './common/guards/jwt-access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    EmailVerificationModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // Global guard: semua route wajib access token KECUALI yang ditandai
    // @Public() (login/register/social-login/refresh) — padanan middleware
    // `auth:sanctum` yang dipasang ke hampir semua route di Laravel lama.
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    // Global filter: menyeragamkan semua error jadi {success:false,code,message,errors}.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
