import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocialLoginService } from './social-login.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { RbacService } from '../../common/services/rbac.service';
import { RateLimiterService } from '../../common/services/rate-limiter.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    HttpModule.register({ timeout: 8000, maxRedirects: 3 }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SocialLoginService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    RbacService,
    RateLimiterService,
  ],
  exports: [RbacService],
})
export class AuthModule {}
