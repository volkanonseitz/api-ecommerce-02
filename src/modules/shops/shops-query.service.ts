import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Balance } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RbacService } from '../../common/services/rbac.service';

const SHOP_OWNER_INCLUDE = { owner: { include: { profile: true } } } as const;
const SHOP_COUNTS = {
  _count: { select: { orders: true, products: true } },
} as const;

/**
 * Operasi BACA seputar Shop — padanan App\Modules\Shop\Services\ShopQueryService.php.
 */
@Injectable()
export class ShopsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async paginate(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.shop.findMany({
        include: { ...SHOP_OWNER_INCLUDE, ...SHOP_COUNTS },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shop.count(),
    ]);
    return { items, totalItems };
  }

  /**
   * Padanan findByIdOrSlug(). `balance` hanya di-eager-load kalau requester
   * berpotensi berhak (optimasi query) — keputusan FINAL tetap di
   * shop.mapper.ts lewat CASL (defense in depth, sama seperti versi lama).
   */
  async findByIdOrSlug(identifier: string, requesterId?: number) {
    const where = /^\d+$/.test(identifier)
      ? { id: Number(identifier) }
      : { slug: identifier };

    const shop = await this.prisma.shop.findFirst({
      where,
      include: {
        categories: { include: { category: true } },
        ...SHOP_OWNER_INCLUDE,
        ...SHOP_COUNTS,
      },
    });
    if (!shop) {
      throw new NotFoundException('Toko tidak ditemukan.');
    }

    let requesterIsStaff = false;
    let balance: Balance | null = null;

    if (requesterId) {
      const isOwner = shop.ownerId === requesterId;
      requesterIsStaff = isOwner
        ? false
        : (await this.prisma.user.count({
            where: { id: requesterId, shopId: shop.id },
          })) > 0;
      const isSuperAdmin = await this.rbac.hasPermission(
        requesterId,
        'super_admin',
      );

      if (isOwner || requesterIsStaff || isSuperAdmin) {
        balance = await this.prisma.balance.findUnique({
          where: { shopId: shop.id },
        });
      }
    }

    return { ...shop, balance, requesterIsStaff };
  }

  async findNewOrInactive(isActive: boolean, perPage: number) {
    return this.prisma.shop.findMany({
      where: { isActive },
      include: { ...SHOP_OWNER_INCLUDE, ...SHOP_COUNTS },
      take: perPage,
    });
  }

  /**
   * Padanan findNearby() — pakai raw query karena butuh formula haversine
   * (jarak antar koordinat) yang tidak direpresentasikan Prisma Client API.
   * Parameter tetap lewat template `Prisma.sql` (bukan concat string) supaya
   * aman dari SQL injection, sama seperti parameter binding `?` di query
   * builder Laravel yang lama.
   */
  async findNearby(lat: number, lng: number, maxDistanceKmOverride?: number) {
    const maxDistanceKm =
      maxDistanceKmOverride ?? (await this.getMaxShopDistanceSetting());

    return this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT shops.*,
        6371 * acos(
          cos(radians(${lat})) * cos(radians(json_unquote(json_extract(settings, '$.location.lat'))))
          * cos(radians(json_unquote(json_extract(settings, '$.location.lng'))) - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(json_unquote(json_extract(settings, '$.location.lat'))))
        ) AS distance
      FROM shops
      WHERE is_active = true
        AND json_extract(settings, '$.location.lat') IS NOT NULL
        AND json_extract(settings, '$.location.lng') IS NOT NULL
      HAVING distance < ${maxDistanceKm}
      ORDER BY distance ASC
    `);
  }

  private async getMaxShopDistanceSetting(): Promise<number> {
    const setting = await this.prisma.setting.findFirst({
      where: { language: 'en' },
    });
    const options =
      (setting?.options as Record<string, unknown> | undefined) ?? {};
    const value = options.maxShopDistance;
    return typeof value === 'number' ? value : 1000;
  }

  /** Padanan `$request->user()->shops` (relasi hasMany owner_id, dipakai di myShops()). */
  async findOwnedByUser(userId: number) {
    return this.prisma.shop.findMany({
      where: { ownerId: userId },
      include: { ...SHOP_OWNER_INCLUDE, ...SHOP_COUNTS },
      orderBy: { id: 'desc' },
    });
  }

  /** Dipakai deleteStaff() untuk resolve toko dari staff (padanan `$staff->managed_shop`). */
  async findStaffOrFail(staffId: number) {
    const staff = await this.prisma.user.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new NotFoundException('Staff tidak ditemukan.');
    }
    return staff;
  }

  async isFollowing(userId: number, shopId: number): Promise<boolean> {
    const count = await this.prisma.userShop.count({
      where: { userId, shopId },
    });
    return count > 0;
  }

  async followedShops(userId: number, perPage: number) {
    const links = await this.prisma.userShop.findMany({
      where: { userId },
      take: perPage,
      include: { shop: { include: { ...SHOP_OWNER_INCLUDE, ...SHOP_COUNTS } } },
    });
    return links.map((l) => l.shop);
  }

  async followedShopsPopularProducts(userId: number, limit: number) {
    const followed = await this.prisma.userShop.findMany({
      where: { userId },
      select: { shopId: true },
    });
    const shopIds = followed.map((f) => f.shopId);
    if (shopIds.length === 0) return [];

    const products = await this.prisma.product.findMany({
      where: { shopId: { in: shopIds } },
      include: { shop: true, _count: { select: { orderProducts: true } } },
      take: limit,
    });

    // Diurutkan manual berdasar jumlah order (padanan orderByDesc('orders_count')
    // di query builder lama) karena Prisma tidak bisa order by relation _count langsung.
    return products.sort(
      (a, b) => b._count.orderProducts - a._count.orderProducts,
    );
  }
}
