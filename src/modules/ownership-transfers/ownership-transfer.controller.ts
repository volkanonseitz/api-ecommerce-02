import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { OwnershipTransferService } from './ownership-transfer.service';
import { CreateOwnershipTransferDto } from './dto/create-ownership-transfer.dto';
import { UpdateOwnershipTransferStatusDto } from './dto/update-ownership-transfer-status.dto';
import { ApiResponse } from '../../common/utils/response.util';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CheckPolicies } from '../../common/decorators/check-policies.decorator';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { Action } from '../../common/casl/action.enum';
import type { AuthUser } from '../../types/auth-user.type';
import { toOwnershipTransferResource } from './ownership-transfer.mapper';

@Controller('ownership-transfers')
export class OwnershipTransferController {
  constructor(
    private readonly transferService: OwnershipTransferService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  @CheckPolicies((ability) => ability.can(Action.ViewAny, 'OwnershipTransfer'))
  @Get()
  async index(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
    @Query('type') type: 'from' | 'to' | undefined,
  ) {
    const { items, totalItems } =
      await this.transferService.getTransferHistories(
        actor.id,
        type,
        page,
        limit,
      );
    const data = items.map((t) =>
      toOwnershipTransferResource(t, actor, this.caslAbilityFactory),
    );
    return ApiResponse.paginated(
      res,
      data,
      ApiResponse.buildMeta(totalItems, page, limit),
      'Riwayat ownership transfer berhasil diambil.',
    );
  }

  @CheckPolicies((ability) => ability.can(Action.Create, 'OwnershipTransfer'))
  @Post()
  async store(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateOwnershipTransferDto,
    @Res() res: Response,
  ) {
    if (!(await this.transferService.hasPermission(actor.id, dto.shop_id))) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }

    const transfer = await this.transferService.createTransfer(dto, actor.id);
    return ApiResponse.success(
      res,
      toOwnershipTransferResource(transfer, actor, this.caslAbilityFactory),
      'Ownership transfer initiated',
      HttpStatus.CREATED,
    );
  }

  @Get(':transactionIdentifier')
  async show(
    @CurrentUser() actor: AuthUser,
    @Param('transactionIdentifier') transactionIdentifier: string,
    @Query('request_view_type') viewType: string | undefined,
    @Res() res: Response,
  ) {
    const transfer = await this.transferService.getTransferDetail(
      transactionIdentifier,
      viewType,
    );
    this.caslAbilityFactory.authorize(actor, Action.View, 'OwnershipTransfer', {
      id: transfer.id,
      fromId: transfer.fromId,
      toId: transfer.toId,
    });

    return ApiResponse.success(
      res,
      toOwnershipTransferResource(transfer, actor, this.caslAbilityFactory),
      'Detail ownership transfer',
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOwnershipTransferStatusDto,
    @Res() res: Response,
  ) {
    const transfer = await this.transferService.findByIdOrFail(id);
    this.caslAbilityFactory.authorize(
      actor,
      Action.Update,
      'OwnershipTransfer',
      {
        id: transfer.id,
        fromId: transfer.fromId,
        toId: transfer.toId,
      },
    );

    const updated = await this.transferService.updateTransferStatus(
      id,
      dto.status,
      actor.id,
    );
    return ApiResponse.success(
      res,
      toOwnershipTransferResource(updated, actor, this.caslAbilityFactory),
      'Ownership transfer updated',
    );
  }

  @Delete(':id')
  async destroy(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const transfer = await this.transferService.findByIdOrFail(id);
    this.caslAbilityFactory.authorize(
      actor,
      Action.Delete,
      'OwnershipTransfer',
      {
        id: transfer.id,
        fromId: transfer.fromId,
        toId: transfer.toId,
      },
    );

    await this.transferService.deleteTransfer(id, actor.id);
    return ApiResponse.success(
      res,
      null,
      'Transfer record deleted successfully',
    );
  }
}
