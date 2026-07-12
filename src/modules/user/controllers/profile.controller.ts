import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Request,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserCommandService } from '../services/user-command.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ChangePasswordAction } from '../actions/change-password.action';
import type { Request as ExpressRequest } from 'express';
import { PrismaService } from '../../../../prisma/prisma.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private userCommandService: UserCommandService,
    private changePasswordAction: ChangePasswordAction,
    private prisma: PrismaService,
  ) {}

  @Get('me')
  async me(@Request() req: ExpressRequest) {
    const user = req.user as any;
    // Load relasi
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: true,
        wallet: true,
        address: true,
        shops: { include: { balance: true } },
        managed_shop: { include: { balance: true } },
      },
    });
    // Tambahkan last order
    // ...

    return {
      statusCode: 200,
      message: 'Profile data',
      data: fullUser,
    };
  }

  @Put()
  async update(
    @Body() updateDto: UpdateUserDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const updated = await this.userCommandService.updateSelf(
      user.id,
      updateDto,
    );
    return {
      statusCode: 200,
      message: 'User updated',
      data: updated,
    };
  }

  @Post('change-password')
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const success = await this.changePasswordAction.execute(
      user.id,
      changePasswordDto.old_password,
      changePasswordDto.new_password,
    );
    if (!success) {
      return { statusCode: 400, message: 'Password lama tidak sesuai.' };
    }
    // Revoke semua token lain
    // ...
    return { statusCode: 200, message: 'Password changed' };
  }

  @Patch('email')
  async updateEmail(
    @Body('email') email: string,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    await this.userCommandService.updateEmail(user.id, email);
    return {
      statusCode: 200,
      message: 'Email updated, please verify your new email',
    };
  }
}
