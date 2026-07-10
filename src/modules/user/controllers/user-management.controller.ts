import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { UserCommandService } from '../services/user-command.service';
import { UserQueryService } from '../services/user-query.service';
import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
import { ToggleUserActiveAction } from '../actions/toggle-user-active.action';
import { ToggleAdminPrivilegeAction } from '../actions/toggle-admin-privilege.action';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Permissions('super_admin')
export class UserManagementController {
  constructor(
    private userCommandService: UserCommandService,
    private userQueryService: UserQueryService,
    private toggleUserActiveAction: ToggleUserActiveAction,
    private toggleAdminPrivilegeAction: ToggleAdminPrivilegeAction,
  ) {}

  @Get()
  async index(@Query('page') page = 1, @Query('limit') limit = 15) {
    const result = await this.userQueryService.paginatedVendors({
      isActive: true,
      limit: Number(limit),
      page: Number(page),
    });
    return {
      statusCode: 200,
      message: 'Daftar user berhasil diambil.',
      data: result.data,
      meta: {
        currentPage: result.page,
        totalPages: Math.ceil(result.total / result.limit),
        totalItems: result.total,
        itemsPerPage: result.limit,
      },
    };
  }

  @Get(':id')
  async show(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: Number(id) },
      include: {
        profile: true,
        address: true,
        shops: true,
        managed_shop: true,
      },
    });
    return { statusCode: 200, message: 'User detail', data: user };
  }

  @Post()
  async store(@Body() createDto: AdminCreateUserDto) {
    const user = await this.userCommandService.createByAdmin(createDto);
    return { statusCode: 201, message: 'User created', data: user };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: AdminUpdateUserDto) {
    const user = await this.userCommandService.updateByAdmin(
      Number(id),
      updateDto,
    );
    return { statusCode: 200, message: 'User updated', data: user };
  }

  @Delete(':id')
  async destroy(@Param('id') id: string) {
    await this.prisma.user.delete({ where: { id: Number(id) } });
    return { statusCode: 200, message: 'User deleted' };
  }

  @Post('ban')
  async ban(@Body('id') userId: number) {
    const user = await this.toggleUserActiveAction.execute(userId, false);
    return { statusCode: 200, message: 'User banned', data: user };
  }

  @Post('activate')
  async activate(@Body('id') userId: number) {
    const user = await this.toggleUserActiveAction.execute(userId, true);
    return { statusCode: 200, message: 'User activated', data: user };
  }

  @Post('toggle-admin')
  async toggleAdmin(@Body('user_id') userId: number) {
    const isNowAdmin = await this.toggleAdminPrivilegeAction.execute(userId);
    return {
      statusCode: 200,
      message: isNowAdmin ? 'Admin granted' : 'Admin revoked',
    };
  }
}
