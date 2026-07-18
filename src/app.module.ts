import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailVerificationModule } from './modules/auth/email-verification.module';
import { UsersModule } from './modules/users/users.module';
import { ShopsModule } from './modules/shops/shops.module';
import { OwnershipTransferModule } from './modules/ownership-transfers/ownership-transfer.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAccessGuard } from './common/guards/jwt-access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    MailModule,
    EmailVerificationModule,
    AuthModule,
    UsersModule,
    OwnershipTransferModule,
    ShopsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
