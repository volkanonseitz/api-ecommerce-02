import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { PermissionGuard } from '../guards/permission.guard';
import { UserSecurityService } from '../services/user-security.service';
import type { Request as ExpressRequest } from 'express';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class UserSecurityController {
  constructor(private securityService: UserSecurityService) {}

  @Post('change-password')
  async changePassword(@Body() body: any, @Request() req: ExpressRequest) {
    // sudah diimplementasikan di ProfileController
  }

  @Post('logout-all')
  async logoutFromAllDevices(@Request() req: ExpressRequest) {
    const user = req.user as any;
    await this.securityService.logoutFromAllDevices(user.id);
    return {
      statusCode: 200,
      message: 'Berhasil logout dari semua perangkat.',
    };
  }

  @Get('sessions')
  async viewActiveSessions(@Request() req: ExpressRequest) {
    const user = req.user as any;
    // Ambil dari personal_access_tokens
    const tokens = await this.prisma.personal_access_tokens.findMany({
      where: { tokenable_id: user.id, tokenable_type: 'App\\Models\\User' },
    });
    const sessions = tokens.map((t) => ({
      id: t.id,
      name: t.name,
      last_used_at: t.last_used_at,
      createdAt: t.created_at,
    }));
    return {
      statusCode: 200,
      message: 'Sesi aktif berhasil diambil.',
      data: sessions,
    };
  }

  @Delete('sessions/:sessionId')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const token = await this.prisma.personal_access_tokens.findFirst({
      where: {
        id: Number(sessionId),
        tokenable_id: user.id,
        tokenable_type: 'App\\Models\\User',
      },
    });
    if (!token) throw new Error('Session not found');
    // Cek apakah session saat ini
    // if (token.id === user.currentAccessToken?.id) { ... }
    await this.prisma.personal_access_tokens.delete({
      where: { id: token.id },
    });
    return { statusCode: 200, message: 'Sesi berhasil dicabut.' };
  }
}
