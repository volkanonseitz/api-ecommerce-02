import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { UserSecurityService } from '../services/user-security.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { SocialLoginDto } from '../dto/social-login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionService } from '../services/permission.service';
import type { Request as ExpressRequest } from 'express';
import { PrismaService } from '../../../../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private securityService: UserSecurityService,
    private permissionService: PermissionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req: ExpressRequest) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Rate limiting
    const allowed = await this.securityService.enforceRateLimit(
      ip,
      loginDto.email,
    );
    if (!allowed) {
      return {
        statusCode: 429,
        message: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.',
      };
    }

    const result = await this.authService.attemptLogin(
      loginDto.email,
      loginDto.password,
      ip,
      userAgent,
    );

    if (result.status === 'invalid') {
      return { statusCode: 401, message: 'Email atau password tidak valid.' };
    }
    if (result.status === 'locked') {
      return {
        statusCode: 423,
        message: 'Akun dikunci sementara.',
        data: { lockedUntil: result.lockedUntil },
      };
    }
    if (result.status === 'unverified') {
      return {
        statusCode: 403,
        message: 'Silakan verifikasi email Anda terlebih dahulu.',
      };
    }

    // Sukses
    const tokenData = await this.authService.createToken(
      result.user.id,
      req.headers['user-agent'] || 'auth',
      ip,
      userAgent,
    );
    const permissions = await this.permissionService.getPermissions(
      result.user.id,
    );
    // Ambil role
    const role = await this.prisma.model_has_roles.findFirst({
      where: { model_id: result.user.id, model_type: 'App\\Models\\User' },
      include: { role: true },
    });

    return {
      statusCode: 200,
      message: 'Login successful',
      data: {
        token: tokenData.plainTextToken,
        permissions,
        email_verified: true,
        role: role?.role?.name || null,
        session_id: tokenData.tokenId,
      },
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterUserDto) {
    // Hanya store_owner yang diizinkan lewat public register
    let requestedPermission = registerDto.permission;
    if (requestedPermission === 'super_admin') {
      requestedPermission = null;
    }
    const user = await this.authService.register(
      registerDto,
      requestedPermission,
    );
    const tokenData = await this.authService.createToken(
      user.id,
      'register',
      '0.0.0.0',
      'register',
    );
    const permissions = await this.permissionService.getPermissions(user.id);
    const role = await this.prisma.model_has_roles.findFirst({
      where: { model_id: user.id, model_type: 'App\\Models\\User' },
      include: { role: true },
    });

    return {
      statusCode: 201,
      message: 'Registration successful',
      data: {
        token: tokenData.plainTextToken,
        permissions,
        role: role?.role?.name || null,
      },
    };
  }

  @Post('social-login')
  async socialLogin(@Body() socialLoginDto: SocialLoginDto) {
    const user = await this.authService.socialLogin(
      socialLoginDto.provider,
      socialLoginDto.access_token,
    );
    const tokenData = await this.authService.createToken(
      user.id,
      'social-login',
      '0.0.0.0',
      'social',
    );
    const permissions = await this.permissionService.getPermissions(user.id);
    const role = await this.prisma.model_has_roles.findFirst({
      where: { model_id: user.id, model_type: 'App\\Models\\User' },
      include: { role: true },
    });

    return {
      statusCode: 200,
      message: 'Social login successful',
      data: {
        token: tokenData.plainTextToken,
        permissions,
        role: role?.role?.name || null,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: ExpressRequest) {
    const user = req.user as any;
    if (user) {
      const tokenId = user.currentAccessToken?.id; // perlu tambahkan di request
      if (tokenId) {
        await this.authService.logout(user.id, tokenId);
      }
    }
    return { statusCode: 200, message: 'Logged out' };
  }
}
