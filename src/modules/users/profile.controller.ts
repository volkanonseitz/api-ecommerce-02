import { Body, Controller, Get, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UsersCommandService } from './users-command.service';
import { UsersQueryService } from './users-query.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { ApiResponse } from '../../common/utils/response.util';
import type { AuthUser } from '../../types/auth-user.type';
import { toUserResource } from './user.mapper';

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly commandService: UsersCommandService,
    private readonly queryService: UsersQueryService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  @Get('me')
  async me(@CurrentUser() actor: AuthUser, @Res() res: Response) {
    const user = await this.queryService.findMe(actor.id);
    return ApiResponse.success(
      res,
      toUserResource(user, actor, this.caslAbilityFactory),
      'Profile data',
    );
  }

  @Patch()
  async update(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Res() res: Response,
  ) {
    const updated = await this.commandService.updateSelf(actor.id, dto);
    return ApiResponse.success(
      res,
      toUserResource(updated, actor, this.caslAbilityFactory),
      'User updated',
    );
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() actor: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res() res: Response,
  ) {
    await this.commandService.changePassword(
      actor.id,
      actor.sessionId,
      dto.old_password,
      dto.new_password,
    );
    return ApiResponse.success(res, null, 'Password berhasil diubah.');
  }

  @Patch('email')
  async updateEmail(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateEmailDto,
    @Res() res: Response,
  ) {
    await this.commandService.updateEmail(actor.id, dto.email);
    return ApiResponse.success(
      res,
      null,
      'Email updated, please verify your new email',
    );
  }
}
