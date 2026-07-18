import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { OrderStatus, WithdrawStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RbacService } from '../../common/services/rbac.service';
import { CreateOwnershipTransferDto } from './dto/create-ownership-transfer.dto';
import type { OrderInfoView } from './ownership-transfer.mapper';

export const OWNERSHIP_TRANSFER_STATUS_CONTROL_EVENT =
  'ownership-transfer.status-control';

const TRANSFER_INCLUDE = {
  from: { include: { profile: true } },
  to: { include: { profile: true } },
  shop: {
    include: {
      owner: { include: { profile: true } },
      categories: { include: { category: true } },
    },
  },
} as const;

const INCOMPLETE_ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.AT_LOCAL_FACILITY,
  OrderStatus.OUT_FOR_DELIVERY,
] as const;

@Injectable()
export class OwnershipTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly events: EventEmitter2,
  ) {}

  /** Padanan hasPermission(). */
  async hasPermission(
    userId: number | undefined,
    shopId?: number,
  ): Promise<boolean> {
    if (!userId) return false;

    if (await this.rbac.hasPermission(userId, 'super_admin')) {
      return true;
    }

    if (shopId) {
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
      return !!shop && shop.ownerId === userId;
    }

    return false;
  }

  /** Padanan getTransferHistoriesQuery(). */
  async getTransferHistories(
    actorId: number,
    type: 'from' | 'to' | undefined,
    page: number,
    limit: number,
  ) {
    const isSuperAdmin = await this.rbac.hasPermission(actorId, 'super_admin');
    const isStoreOwner = await this.rbac.hasPermission(actorId, 'store_owner');

    let where: { fromId?: number; toId?: number; deletedAt: null } = {
      deletedAt: null,
    };

    if (isSuperAdmin) {
      where = { deletedAt: null };
    } else if (isStoreOwner) {
      where =
        type === 'from'
          ? { fromId: actorId, deletedAt: null }
          : { toId: actorId, deletedAt: null };
    } else {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }

    const skip = (page - 1) * limit;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.ownershipTransfer.findMany({
        where,
        include: TRANSFER_INCLUDE,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ownershipTransfer.count({ where }),
    ]);

    return { items, totalItems };
  }

  /** Padanan getTransferDetail(). */
  async getTransferDetail(transactionIdentifier: string, viewType?: string) {
    const transfer = await this.prisma.ownershipTransfer.findFirst({
      where: { transactionIdentifier, deletedAt: null },
      include: TRANSFER_INCLUDE,
    });
    if (!transfer) {
      throw new NotFoundException('Ownership transfer tidak ditemukan.');
    }

    if (viewType !== 'detail') {
      return transfer;
    }

    const [orderInfo, balanceInfo, refundInfo, withdrawalInfo] =
      await Promise.all([
        this.getOrderInfo(transfer.shopId),
        this.getBalanceInfo(transfer.shopId),
        this.getRefundInfo(transfer.shopId),
        this.getWithdrawInfo(transfer.shopId),
      ]);

    return { ...transfer, orderInfo, balanceInfo, refundInfo, withdrawalInfo };
  }

  async findByIdOrFail(id: number) {
    const transfer = await this.prisma.ownershipTransfer.findFirst({
      where: { id, deletedAt: null },
      include: TRANSFER_INCLUDE,
    });
    if (!transfer) {
      throw new NotFoundException('Ownership transfer tidak ditemukan.');
    }
    return transfer;
  }

  /** Padanan createTransfer() — SELALU insert baru (bukan update-or-create). */
  async createTransfer(dto: CreateOwnershipTransferDto, fromUserId: number) {
    const created = await this.prisma.ownershipTransfer.create({
      data: {
        shopId: dto.shop_id,
        fromId: fromUserId,
        toId: dto.vendor_id,
        message: dto.message ?? null,
        createdById: fromUserId,
        transactionIdentifier: randomUUID(),
      },
    });

    return this.prisma.ownershipTransfer.findUniqueOrThrow({
      where: { id: created.id },
      include: TRANSFER_INCLUDE,
    });
  }

  /** Padanan updateTransferStatus(). */
  async updateTransferStatus(
    id: number,
    status: 'pending' | 'approved' | 'rejected',
    actorId: number,
  ) {
    if (!(await this.rbac.hasPermission(actorId, 'super_admin'))) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }

    const transfer = await this.prisma.ownershipTransfer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!transfer) {
      throw new NotFoundException('Ownership transfer tidak ditemukan.');
    }

    if (status === 'approved') {
      await this.validateTransferConditions(transfer.shopId);
    }

    const updated = await this.prisma.ownershipTransfer.update({
      where: { id },
      data: { status },
      include: TRANSFER_INCLUDE,
    });

    // Padanan event(new OwnershipTransferStatusControl($transfer)). Listener
    // yang benar-benar memindahkan shop.owner_id TIDAK ikut di-share — lihat
    // catatan di atas class ini.
    this.events.emit(OWNERSHIP_TRANSFER_STATUS_CONTROL_EVENT, {
      transferId: updated.id,
      status,
    });

    return updated;
  }

  /** Padanan validateTransferConditions(). */
  private async validateTransferConditions(shopId: number): Promise<void> {
    const [incompleteOrders, balance, withdraws] = await Promise.all([
      this.prisma.order.count({
        where: { shopId, orderStatus: { in: [...INCOMPLETE_ORDER_STATUSES] } },
      }),
      this.prisma.balance.findUnique({ where: { shopId } }),
      this.prisma.withdraw.findMany({ where: { shopId } }),
    ]);

    const currentBalance = balance?.currentBalance ?? 0;
    const pendingWithdrawals = withdraws.filter(
      (w) => w.status !== WithdrawStatus.approved,
    ).length;

    if (
      incompleteOrders > 0 ||
      currentBalance > 1.0 ||
      pendingWithdrawals > 0
    ) {
      throw new BadRequestException(
        'Toko belum bisa dipindahtangankan: masih ada order berjalan, saldo tersisa, atau penarikan dana yang belum selesai.',
      );
    }
  }

  /** Padanan deleteTransfer() — soft delete (kolom deletedAt tersedia di schema). */
  async deleteTransfer(id: number, actorId: number): Promise<void> {
    const transfer = await this.prisma.ownershipTransfer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!transfer) {
      throw new NotFoundException('Ownership transfer tidak ditemukan.');
    }

    if (!(await this.hasPermission(actorId, transfer.shopId))) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }

    await this.prisma.ownershipTransfer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async getOrderInfo(shopId: number): Promise<OrderInfoView> {
    const grouped = await this.prisma.order.groupBy({
      by: ['orderStatus'],
      where: {
        shopId,
        parentId: { not: null },
        createdAt: { lte: new Date() },
      },
      _count: true,
    });

    const countByStatus = new Map(
      grouped.map((g) => [g.orderStatus, g._count]),
    );

    return {
      pending: countByStatus.get(OrderStatus.PENDING) ?? 0,
      processing: countByStatus.get(OrderStatus.PROCESSING) ?? 0,
      complete: countByStatus.get(OrderStatus.COMPLETED) ?? 0,
      cancelled: countByStatus.get(OrderStatus.CANCELLED) ?? 0,
      refunded: countByStatus.get(OrderStatus.REFUNDED) ?? 0,
      failed: countByStatus.get(OrderStatus.FAILED) ?? 0,
      localFacility: countByStatus.get(OrderStatus.AT_LOCAL_FACILITY) ?? 0,
      outForDelivery: countByStatus.get(OrderStatus.OUT_FOR_DELIVERY) ?? 0,
    };
  }

  private async getBalanceInfo(shopId: number) {
    return this.prisma.balance.findUnique({ where: { shopId } });
  }

  private async getRefundInfo(shopId: number) {
    return this.prisma.refund.findMany({ where: { shopId } });
  }

  private async getWithdrawInfo(shopId: number) {
    return this.prisma.withdraw.findMany({ where: { shopId } });
  }
}
