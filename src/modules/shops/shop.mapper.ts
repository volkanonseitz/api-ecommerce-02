import type { AuthUser } from '../../types/auth-user.type';
import { Action } from '../../common/casl/action.enum';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { toUserResource, UserWithRelations } from '../users/user.mapper';

export interface ShopBalanceView {
  adminCommissionRate: number | null;
  totalEarnings: number;
  withdrawnAmount: number;
  currentBalance: number;
  isCustomCommission: boolean;
}

export interface ShopCategoryView {
  id: number;
  name: string;
  slug: string;
}

export interface ShopCategoryLink {
  category: ShopCategoryView;
}

export interface ShopWithRelations {
  id: number;
  ownerId: number;
  name: string;
  slug: string;
  description: string | null;
  coverImage: unknown;
  logo: unknown;
  isActive: boolean;
  address: unknown;
  settings: unknown;
  notifications: unknown;
  createdAt: Date;
  updatedAt: Date;
  owner?: UserWithRelations | null;
  categories?: ShopCategoryLink[];
  balance?: ShopBalanceView | null;
  ordersCount?: number;
  productsCount?: number;
  /**
   * Dihitung sekali oleh query service (bukan di sini) — padanan
   * `$shop->staffs()->whereKey($user->id)->exists()` di
   * ShopPolicy::viewBalance() lama. Lihat catatan di ShopSubject
   * (types/auth-user.type.ts).
   */
  requesterIsStaff?: boolean;
}

/**
 * Padanan App\Modules\Shop\Http\Resources\ShopResource.php.
 * `balance` dua lapis proteksi seperti versi lama: (1) query service hanya
 * eager-load balance kalau requester berpotensi berhak (optimasi), (2) di
 * sini dicek ULANG lewat CASL Action.ViewBalance sebagai lapis pertahanan
 * kedua — kalau ada kode lain yang tidak sengaja ikut nge-load relasi
 * balance, field ini TETAP tidak bocor ke yang tidak berhak.
 */
export function toShopResource(
  shop: ShopWithRelations,
  requester: AuthUser | null,
  caslAbilityFactory: CaslAbilityFactory,
) {
  const canViewBalance =
    requester !== null &&
    caslAbilityFactory.can(requester, Action.ViewBalance, 'Shop', {
      id: shop.id,
      ownerId: shop.ownerId,
      isStaff: shop.requesterIsStaff ?? false,
    });

  return {
    id: shop.id,
    owner_id: shop.ownerId,
    owner:
      shop.owner !== undefined
        ? shop.owner && requester
          ? toUserResource(shop.owner, requester, caslAbilityFactory)
          : shop.owner
        : undefined,
    name: shop.name,
    slug: shop.slug,
    description: shop.description,
    cover_image: shop.coverImage,
    logo: shop.logo,
    is_active: shop.isActive,
    address: shop.address,
    settings: shop.settings,
    notifications: shop.notifications,
    created_at: shop.createdAt,
    updated_at: shop.updatedAt,
    ...(shop.balance !== undefined && canViewBalance
      ? { balance: shop.balance }
      : {}),
    ...(shop.categories !== undefined
      ? { categories: shop.categories.map((link) => link.category) }
      : {}),
    ...(shop.ordersCount !== undefined
      ? { orders_count: shop.ordersCount }
      : {}),
    ...(shop.productsCount !== undefined
      ? { products_count: shop.productsCount }
      : {}),
  };
}
