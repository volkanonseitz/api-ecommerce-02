import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsersSecurityService } from './security.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/response.util';
import type { AuthUser } from '../../types/auth-user.type';

/**
 * Padanan App\Modules\User\Http\Controllers\UserSecurityController.php
 * (khusus bagian manajemen sesi — changePassword sudah dikonsolidasikan
 * ke ProfileController, lihat catatan di sana).
 * Semua endpoint beroperasi atas akun requester sendiri (dari access token).
 */
@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: UsersSecurityService) {}

  @Post('logout-all-devices')
  async logoutFromAllDevices(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
  ) {
    await this.securityService.logoutFromAllDevices(actor.id);
    return ApiResponse.success(
      res,
      null,
      'Berhasil logout dari semua perangkat.',
    );
  }

  @Get('sessions')
  async viewActiveSessions(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
  ) {
    const sessions = await this.securityService.listActiveSessions(actor.id);
    return ApiResponse.success(res, sessions, 'Sesi aktif berhasil diambil.');
  }

  @Delete('sessions/:sessionId')
  async revokeSession(
    @CurrentUser() actor: AuthUser,
    @Param('sessionId', ParseIntPipe) sessionDbId: number,
    @Res() res: Response,
  ) {
    const result = await this.securityService.revokeSession(
      actor.id,
      sessionDbId,
      actor.sessionId,
    );

    if (!result.found) {
      throw new BadRequestException('Sesi tidak ditemukan.');
    }
    if (result.isCurrent) {
      throw new BadRequestException('Tidak bisa mencabut sesi saat ini.');
    }

    return ApiResponse.success(res, null, 'Sesi berhasil dicabut.');
  }
}
