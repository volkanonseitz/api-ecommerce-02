import type { AuthUser } from '../../types/auth-user.type';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { toUserResource, UserWithRelations } from '../users/user.mapper';
import { ShopWithRelations, toShopResource } from '../shops/shop.mapper';

export interface OrderInfoView {
  pending: number;
  processing: number;
  complete: number;
  cancelled: number;
  refunded: number;
  failed: number;
  localFacility: number;
  outForDelivery: number;
}

export interface OwnershipTransferWithRelations {
  id: number;
  transactionIdentifier: string;
  message: string | null;
  createdById: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  from?: UserWithRelations;
  to?: UserWithRelations;
  shop?: ShopWithRelations;
  orderInfo?: OrderInfoView;
  balanceInfo?: unknown;
  refundInfo?: unknown[];
  withdrawalInfo?: unknown[];
}

/**
 * Padanan App\Modules\OwnershipTransfer\Http\Resources\OwnershipTransferResource.php.
 * `order_info`/`balance_info`/`refund_info`/`withdrawal_info` hanya muncul kalau
 * di-set oleh service (view_type=detail) — persis `whenLoaded` di versi lama.
 */
export function toOwnershipTransferResource(
  transfer: OwnershipTransferWithRelations,
  requester: AuthUser,
  caslAbilityFactory: CaslAbilityFactory,
) {
  return {
    id: transfer.id,
    transaction_identifier: transfer.transactionIdentifier,
    previous_owner: transfer.from
      ? toUserResource(transfer.from, requester, caslAbilityFactory)
      : undefined,
    current_owner: transfer.to
      ? toUserResource(transfer.to, requester, caslAbilityFactory)
      : undefined,
    message: transfer.message,
    created_by: transfer.createdById,
    status: transfer.status,
    shop: transfer.shop
      ? toShopResource(transfer.shop, requester, caslAbilityFactory)
      : undefined,
    order_info: transfer.orderInfo,
    balance_info: transfer.balanceInfo,
    refund_info: transfer.refundInfo,
    withdrawal_info: transfer.withdrawalInfo,
    created_at: transfer.createdAt,
    updated_at: transfer.updatedAt,
  };
}
