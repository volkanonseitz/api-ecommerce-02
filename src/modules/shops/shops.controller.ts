import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ShopsCommandService } from './shops-command.service';
import { ShopsQueryService } from './shops-query.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ApproveShopDto } from './dto/approve-shop.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { FollowShopDto } from './dto/follow-shop.dto';
import { NearbyShopDto } from './dto/nearby-shop.dto';
import { ShopMaintenanceDto } from './dto/shop-maintenance.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { OwnershipTransferService } from '../ownership-transfers/ownership-transfer.service';
import { ApiResponse } from '../../common/utils/response.util';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CheckPolicies } from '../../common/decorators/check-policies.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PoliciesGuard } from '../../common/guards/policies.guard';
import { OptionalJwtAccessGuard } from '../../common/guards/optional-jwt-access.guard';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { Action } from '../../common/casl/action.enum';
import type { AuthUser } from '../../types/auth-user.type';
import { toShopResource } from './shop.mapper';

@UseGuards(PoliciesGuard)
@Controller('shops')
export class ShopsController {
  constructor(
    private readonly commandService: ShopsCommandService,
    private readonly queryService: ShopsQueryService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly ownershipTransferService: OwnershipTransferService,
  ) {}

  // ---------------------------------------------------------------- GET ----

  @Public()
  @Get()
  async index(
    @Res() res: Response,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
  ) {
    const { items, totalItems } = await this.queryService.paginate(page, limit);
    const data = items.map((shop) =>
      toShopResource(shop, null, this.caslAbilityFactory),
    );
    return ApiResponse.paginated(
      res,
      data,
      ApiResponse.buildMeta(totalItems, page, limit),
      'Daftar toko berhasil diambil.',
    );
  }

  @Public()
  @Get('nearby')
  async nearByShop(@Query() dto: NearbyShopDto, @Res() res: Response) {
    const shops = await this.queryService.findNearby(dto.lat, dto.lng);
    return ApiResponse.success(res, shops, 'Toko terdekat berhasil diambil.');
  }

  @Get('my/owned')
  async myShops(@CurrentUser() actor: AuthUser, @Res() res: Response) {
    const shops = await this.queryService.findOwnedByUser(actor.id);
    const data = shops.map((shop) =>
      toShopResource(shop, actor, this.caslAbilityFactory),
    );
    return ApiResponse.success(res, data, 'Toko milik Anda berhasil diambil.');
  }

  @Get('my/followed')
  async userFollowedShops(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
  ) {
    const shops = await this.queryService.followedShops(actor.id, limit);
    const data = shops.map((shop) =>
      toShopResource(shop, actor, this.caslAbilityFactory),
    );
    return ApiResponse.success(
      res,
      data,
      'Toko yang Anda follow berhasil diambil.',
    );
  }

  @Get('my/followed/popular-products')
  async followedShopsPopularProducts(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const products = await this.queryService.followedShopsPopularProducts(
      actor.id,
      limit,
    );
    return ApiResponse.success(
      res,
      products,
      'Produk populer dari toko yang Anda follow berhasil diambil.',
    );
  }

  @Get('follow-status')
  async userFollowedShop(
    @CurrentUser() actor: AuthUser,
    @Query('shop_id', ParseIntPipe) shopId: number,
    @Res() res: Response,
  ) {
    const isFollowing = await this.queryService.isFollowing(actor.id, shopId);
    return ApiResponse.success(
      res,
      isFollowing,
      'Status follow berhasil diambil.',
    );
  }

  @CheckPolicies((ability) => ability.can(Action.ViewAny, 'Shop'))
  @Get('admin/new-or-inactive')
  async newOrInActiveShops(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
    @Query('is_active', new DefaultValuePipe(false), ParseBoolPipe)
    isActive: boolean,
  ) {
    const shops = await this.queryService.findNewOrInactive(isActive, limit);
    const data = shops.map((shop) =>
      toShopResource(shop, actor, this.caslAbilityFactory),
    );
    return ApiResponse.success(
      res,
      data,
      'Toko baru/tidak aktif berhasil diambil.',
    );
  }

  @Public()
  @UseGuards(OptionalJwtAccessGuard)
  @Get(':identifier')
  async show(
    @Param('identifier') identifier: string,
    @OptionalCurrentUser() actor: AuthUser | null,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(identifier, actor?.id);
    return ApiResponse.success(
      res,
      toShopResource(shop, actor, this.caslAbilityFactory),
      'Detail toko berhasil diambil.',
    );
  }

  // --------------------------------------------------------------- POST ----

  @CheckPolicies((ability) => ability.can(Action.Create, 'Shop'))
  @Post()
  async store(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateShopDto,
    @Res() res: Response,
  ) {
    const shop = await this.commandService.create(actor.id, dto);
    return ApiResponse.success(
      res,
      toShopResource(shop, actor, this.caslAbilityFactory),
      'Shop created',
      HttpStatus.CREATED,
    );
  }

  @Post('follow')
  async handleFollowShop(
    @CurrentUser() actor: AuthUser,
    @Body() dto: FollowShopDto,
    @Res() res: Response,
  ) {
    const isFollowing = await this.commandService.toggleFollow(
      actor.id,
      dto.shop_id,
    );
    return ApiResponse.success(
      res,
      isFollowing,
      'Status follow berhasil diperbarui.',
    );
  }

  @Post('transfer-ownership')
  async transferShopOwnership(
    @CurrentUser() actor: AuthUser,
    @Body() dto: TransferOwnershipDto,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(String(dto.shop_id));
    this.caslAbilityFactory.authorize(actor, Action.TransferOwnership, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    if (
      !(await this.ownershipTransferService.hasPermission(
        actor.id,
        dto.shop_id,
      ))
    ) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }

    await this.ownershipTransferService.createTransfer(
      {
        shop_id: dto.shop_id,
        vendor_id: dto.vendor_id,
        message: dto.message,
        vendorMessage: dto.vendorMessage,
      },
      actor.id,
    );

    return ApiResponse.success(res, null, 'Ownership transfer initiated');
  }

  @Post(':id/approve')
  async approveShop(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveShopDto,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(String(id));
    this.caslAbilityFactory.authorize(actor, Action.Approve, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    const approved = await this.commandService.approve(id, dto);
    return ApiResponse.success(
      res,
      toShopResource(approved, actor, this.caslAbilityFactory),
      'Shop approved',
    );
  }

  @Post(':id/disapprove')
  async disApproveShop(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(String(id));
    this.caslAbilityFactory.authorize(actor, Action.Approve, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    const disapproved = await this.commandService.disapprove(id);
    return ApiResponse.success(
      res,
      toShopResource(disapproved, actor, this.caslAbilityFactory),
      'Shop disapproved',
    );
  }

  @Post(':id/staff')
  async addStaff(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddStaffDto,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(String(id));
    this.caslAbilityFactory.authorize(actor, Action.ManageStaff, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    const staff = await this.commandService.addStaff(id, dto);
    return ApiResponse.success(
      res,
      { success: true, staff },
      'Staff added',
      HttpStatus.CREATED,
    );
  }

  @Post(':id/maintenance')
  async shopMaintenanceEvent(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShopMaintenanceDto,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(String(id));
    this.caslAbilityFactory.authorize(actor, Action.ToggleMaintenance, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    if (dto.enable) {
      await this.commandService.enableMaintenance(id);
    } else {
      await this.commandService.disableMaintenance(id);
    }

    return ApiResponse.success(res, true, 'Maintenance status updated');
  }

  // -------------------------------------------------------------- PATCH ----

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopDto,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(String(id));
    this.caslAbilityFactory.authorize(actor, Action.Update, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    const updated = await this.commandService.update(id, dto);
    return ApiResponse.success(
      res,
      toShopResource(updated, actor, this.caslAbilityFactory),
      'Shop updated',
    );
  }

  // ------------------------------------------------------------- DELETE ----

  @Delete('staff/:staffId')
  async deleteStaff(
    @CurrentUser() actor: AuthUser,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Res() res: Response,
  ) {
    const staff = await this.queryService.findStaffOrFail(staffId);
    if (!staff.shopId) {
      return ApiResponse.error(
        res,
        'Staff tidak terikat ke toko manapun.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const shop = await this.queryService.findByIdOrSlug(String(staff.shopId));
    this.caslAbilityFactory.authorize(actor, Action.ManageStaff, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    await this.commandService.removeStaff(staffId);
    return ApiResponse.success(res, true, 'Staff removed');
  }

  @Delete(':id')
  async destroy(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const shop = await this.queryService.findByIdOrSlug(String(id));
    this.caslAbilityFactory.authorize(actor, Action.Delete, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
    });

    await this.commandService.delete(id);
    return ApiResponse.success(res, null, 'Shop deleted successfully');
  }
}
