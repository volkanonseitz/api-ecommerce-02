import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, type RequestMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { RateLimiterService } from '../../common/services/rate-limiter.service';
import { ApiResponse } from '../../common/utils/response.util';
import { TooManyAttemptsException } from '../../common/exceptions/app.exceptions';
import { RbacService } from '../../common/services/rbac.service';
import { EmailVerificationService } from './email-verification.service';
import { UsersQueryService } from '../users/users-query.service';
import type { AuthUser } from '../../types/auth-user.type';
import type { RefreshTokenSubject } from './strategies/jwt-refresh.strategy';

function meta(req: Request, ip: string): RequestMeta {
  return { ip, userAgent: req.headers['user-agent'] ?? 'Unknown' };
}

/**
 * Padanan App\Modules\User\Http\Controllers\AuthController.php.
 * Thin controller: validasi (lewat DTO + ValidationPipe global) -> Service
 * -> ApiResponse, tidak ada query Prisma langsung di sini.
 *
 * PERBEDAAN SENGAJA dari versi lama: field `token` tunggal (Sanctum)
 * berubah jadi `accessToken` + `refreshToken` (JWT dua token), sesuai
 * requirement migrasi. `sessionId` menggantikan `session_id` (dulu ID
 * personal_access_token, sekarang UUID baris user_sessions).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: RateLimiterService,
    private readonly rbac: RbacService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly usersQueryService: UsersQueryService,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.rateLimiter.hit(ip, dto.email)) {
      throw new TooManyAttemptsException();
    }

    const user = await this.authService.attemptLogin(
      dto.email,
      dto.password,
      meta(req, ip),
    );
    const tokens = await this.authService.issueTokenPair(
      user.id,
      meta(req, ip),
    );
    const { roles, permissions } =
      await this.rbac.getUserRoleAndPermissionNames(user.id);

    return ApiResponse.success(
      res,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
        permissions,
        role: roles[0] ?? null,
        emailVerified: true,
      },
      'Login successful',
    );
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.authService.register(dto);
    const tokens = await this.authService.issueTokenPair(
      user.id,
      meta(req, ip),
    );
    const { roles, permissions } =
      await this.rbac.getUserRoleAndPermissionNames(user.id);

    return ApiResponse.success(
      res,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
        permissions,
        role: roles[0] ?? null,
      },
      'Registration successful',
      HttpStatus.CREATED,
    );
  }

  @Public()
  @Post('social-login')
  async socialLogin(
    @Body() dto: SocialLoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = await this.authService.socialLogin(
      dto.provider,
      dto.access_token,
      meta(req, ip),
    );
    const tokens = await this.authService.issueTokenPair(
      user.id,
      meta(req, ip),
    );
    const { roles, permissions } =
      await this.rbac.getUserRoleAndPermissionNames(user.id);

    return ApiResponse.success(
      res,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
        permissions,
        role: roles[0] ?? null,
      },
      'Social login successful',
    );
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(
    @CurrentUser() subject: unknown,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { userId, sessionDbId } = subject as RefreshTokenSubject;
    const tokens = await this.authService.rotateTokenPair(
      userId,
      sessionDbId,
      meta(req, ip),
    );

    return ApiResponse.success(
      res,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
      },
      'Token refreshed',
    );
  }

  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Res() res: Response) {
    await this.authService.logout(user.id, user.sessionId);
    return ApiResponse.success(res, true, 'Logged out');
  }

  /**
   * Padanan route `verification.verify` bawaan Laravel. Publik (link dari
   * email, tidak ada access token saat diklik) — validitas dijamin oleh
   * JWT bertanda tangan + expiry di dalam token itu sendiri, lihat
   * EmailVerificationService.
   */
  @Public()
  @Get('email/verify')
  async verifyEmail(@Query() dto: VerifyEmailDto, @Res() res: Response) {
    const result = await this.emailVerificationService.verify(dto.token);
    return ApiResponse.success(
      res,
      null,
      result.alreadyVerified
        ? 'Email sudah terverifikasi sebelumnya.'
        : 'Email berhasil diverifikasi.',
    );
  }

  /** Padanan tombol "resend verification email" (fitur tambahan, tidak ada di kode lama). */
  @Post('email/resend')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
  ) {
    const user = await this.usersQueryService.findByIdOrFail(actor.id);
    if (user.emailVerifiedAt) {
      return ApiResponse.success(res, null, 'Email sudah terverifikasi.');
    }
    await this.emailVerificationService.sendVerificationEmail(user);
    return ApiResponse.success(
      res,
      null,
      'Email verifikasi telah dikirim ulang.',
    );
  }
}
