import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsersCommandService } from './users-command.service';
import { UsersQueryService } from './users-query.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import {
  TargetUserByIdDto,
  TargetUserByUserIdDto,
} from './dto/target-user.dto';
import { ApiResponse } from '../../common/utils/response.util';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CheckPolicies } from '../../common/decorators/check-policies.decorator';
import { PoliciesGuard } from '../../common/guards/policies.guard';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { Action } from '../../common/casl/action.enum';
import type { AuthUser } from '../../types/auth-user.type';
import { toUserResource } from './user.mapper';

@UseGuards(PoliciesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly commandService: UsersCommandService,
    private readonly queryService: UsersQueryService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  @CheckPolicies((ability) => ability.can(Action.ViewAny, 'User'))
  @Get()
  async index(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
  ) {
    const { items, totalItems } = await this.queryService.paginate(page, limit);
    const data = items.map((u) =>
      toUserResource(u, actor, this.caslAbilityFactory),
    );
    return ApiResponse.paginated(
      res,
      data,
      ApiResponse.buildMeta(totalItems, page, limit),
      'Daftar user berhasil diambil.',
    );
  }

  @Get(':id')
  async show(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const target = await this.queryService.findByIdOrFail(id);
    this.caslAbilityFactory.authorize(actor, Action.View, { id: target.id });

    return ApiResponse.success(
      res,
      toUserResource(target, actor, this.caslAbilityFactory),
      'User detail',
    );
  }

  @CheckPolicies((ability) => ability.can(Action.Create, 'User'))
  @Post()
  async store(
    @CurrentUser() actor: AuthUser,
    @Body() dto: AdminCreateUserDto,
    @Res() res: Response,
  ) {
    const user = await this.commandService.createByAdmin(dto);
    return ApiResponse.success(
      res,
      toUserResource(user, actor, this.caslAbilityFactory),
      'User created',
      HttpStatus.CREATED,
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
    @Res() res: Response,
  ) {
    const target = await this.queryService.findByIdOrFail(id);
    this.caslAbilityFactory.authorize(actor, Action.Update, { id: target.id });

    const updated = await this.commandService.updateByAdmin(id, dto);
    return ApiResponse.success(
      res,
      toUserResource(updated, actor, this.caslAbilityFactory),
      'User updated',
    );
  }

  @Delete(':id')
  async destroy(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const target = await this.queryService.findByIdOrFail(id);
    this.caslAbilityFactory.authorize(actor, Action.Delete, { id: target.id });

    await this.commandService.deleteUser(id);
    return ApiResponse.success(res, null, 'User deleted');
  }

  @Post('ban')
  async ban(
    @CurrentUser() actor: AuthUser,
    @Body() dto: TargetUserByIdDto,
    @Res() res: Response,
  ) {
    const target = await this.queryService.findByIdOrFail(dto.id);
    this.caslAbilityFactory.authorize(actor, Action.ToggleActive, {
      id: target.id,
    });

    const banned = await this.commandService.toggleActive(dto.id, false);
    return ApiResponse.success(
      res,
      toUserResource(banned, actor, this.caslAbilityFactory),
      'User banned',
    );
  }

  @Post('activate')
  async activate(
    @CurrentUser() actor: AuthUser,
    @Body() dto: TargetUserByIdDto,
    @Res() res: Response,
  ) {
    const target = await this.queryService.findByIdOrFail(dto.id);
    this.caslAbilityFactory.authorize(actor, Action.ToggleActive, {
      id: target.id,
    });

    const activated = await this.commandService.toggleActive(dto.id, true);
    return ApiResponse.success(
      res,
      toUserResource(activated, actor, this.caslAbilityFactory),
      'User activated',
    );
  }

  @Post('toggle-admin')
  async toggleAdmin(
    @CurrentUser() actor: AuthUser,
    @Body() dto: TargetUserByUserIdDto,
    @Res() res: Response,
  ) {
    const target = await this.queryService.findByIdOrFail(dto.user_id);
    this.caslAbilityFactory.authorize(actor, Action.ToggleAdmin, {
      id: target.id,
    });

    const isNowAdmin = await this.commandService.toggleAdmin(dto.user_id);
    return ApiResponse.success(
      res,
      true,
      isNowAdmin ? 'Admin granted' : 'Admin revoked',
    );
  }
}
