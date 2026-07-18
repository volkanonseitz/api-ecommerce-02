import { ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import {
  ProductStatus,
  ProductVisibilityStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RbacService } from '../../common/services/rbac.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ApproveShopDto } from './dto/approve-shop.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import {
  SHOP_MAINTENANCE_EVENT,
  ShopMaintenanceEventPayload,
} from './shop.events';

const SHOP_WITH_RELATIONS = {
  owner: { include: { profile: true } },
  categories: { include: { category: true } },
} as const;

const DEFAULT_COMMISSION_RATE = 10.0; // padanan Shop::getDefaultCommissionRate()

/**
 * Operasi TULIS seputar Shop — padanan gabungan seluruh class di
 * App\Modules\Shop\Actions (Laravel). Otorisasi (siapa boleh manggil method
 * mana) dicek di controller lewat CaslAbilityFactory, BUKAN di sini.
 */
@Injectable()
export class ShopsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly events: EventEmitter2,
  ) {}

  /** Padanan CreateShopAction. */
  async create(ownerId: number, dto: CreateShopDto) {
    const shop = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shop.create({
        data: {
          ownerId,
          name: dto.name,
          slug: await this.generateUniqueSlug(dto.name),
          description: dto.description,
          coverImage: dto.cover_image,
          settings: dto.settings,
          address: dto.address,
        },
      });

      if (dto.categories && dto.categories.length > 0) {
        await tx.categoryShop.createMany({
          data: dto.categories.map((categoryId) => ({
            shopId: created.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return this.prisma.shop.findUniqueOrThrow({
      where: { id: shop.id },
      include: SHOP_WITH_RELATIONS,
    });
  }

  /** Padanan UpdateShopAction. */
  async update(shopId: number, dto: UpdateShopDto) {
    await this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.cover_image !== undefined)
        updateData.coverImage = dto.cover_image;
      if (dto.settings !== undefined) updateData.settings = dto.settings;
      if (dto.address !== undefined) updateData.address = dto.address;

      if (Object.keys(updateData).length > 0) {
        await tx.shop.update({ where: { id: shopId }, data: updateData });
      }

      if (dto.categories !== undefined) {
        await tx.categoryShop.deleteMany({ where: { shopId } });
        if (dto.categories.length > 0) {
          await tx.categoryShop.createMany({
            data: dto.categories.map((categoryId) => ({ shopId, categoryId })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      include: SHOP_WITH_RELATIONS,
    });
  }

  /** Padanan DeleteShopAction. */
  async delete(shopId: number): Promise<void> {
    await this.prisma.shop.delete({ where: { id: shopId } });
  }

  /**
   * Padanan ApproveShopAction. `is_active` HANYA bisa diubah lewat method ini
   * (dan disapprove()) — konsisten dengan catatan keamanan di Shop.php lama.
   */
  async approve(shopId: number, dto: ApproveShopDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.shop.update({ where: { id: shopId }, data: { isActive: true } });
      await tx.product.updateMany({
        where: { shopId },
        data: { status: ProductStatus.publish },
      });

      const existingBalance = await tx.balance.findUnique({
        where: { shopId },
      });
      const isCustomCommission = dto.is_custom_commission ?? false;
      const adminCommissionRate = isCustomCommission
        ? (dto.admin_commission_rate ?? 0)
        : DEFAULT_COMMISSION_RATE;

      if (existingBalance) {
        await tx.balance.update({
          where: { shopId },
          data: { adminCommissionRate, isCustomCommission },
        });
      } else {
        await tx.balance.create({
          data: { shopId, adminCommissionRate, isCustomCommission },
        });
      }
    });

    return this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      include: { ...SHOP_WITH_RELATIONS, balance: true },
    });
  }

  /** Padanan DisapproveShopAction. */
  async disapprove(shopId: number) {
    await this.prisma.$transaction([
      this.prisma.shop.update({
        where: { id: shopId },
        data: { isActive: false },
      }),
      this.prisma.product.updateMany({
        where: { shopId },
        data: { status: ProductStatus.draft },
      }),
    ]);

    return this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      include: SHOP_WITH_RELATIONS,
    });
  }

  /** Padanan AddStaffAction. */
  async addStaff(shopId: number, dto: AddStaffDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const staff = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: passwordHash,
        shopId,
        emailVerifiedAt: new Date(),
      },
    });

    await this.rbac.grantPermission(staff.id, 'customer');
    await this.rbac.grantPermission(staff.id, 'staff');
    await this.rbac.assignRole(staff.id, 'staff');

    return staff;
  }

  /** Padanan RemoveStaffAction. */
  async removeStaff(staffId: number): Promise<void> {
    await this.prisma.user.delete({ where: { id: staffId } });
  }

  /** Padanan ToggleFollowShopAction. */
  async toggleFollow(userId: number, shopId: number): Promise<boolean> {
    const existing = await this.prisma.userShop.findFirst({
      where: { userId, shopId },
    });

    if (existing) {
      await this.prisma.userShop.delete({ where: { id: existing.id } });
      return false;
    }

    await this.prisma.userShop.create({ data: { userId, shopId } });
    return true;
  }

  /** Padanan EnableShopMaintenanceAction. */
  async enableMaintenance(shopId: number): Promise<void> {
    await this.prisma.product.updateMany({
      where: { shopId },
      data: { visibility: ProductVisibilityStatus.visibility_private },
    });
    this.events.emit(SHOP_MAINTENANCE_EVENT, {
      shopId,
      action: 'start',
    } satisfies ShopMaintenanceEventPayload);
  }

  /** Padanan DisableShopMaintenanceAction. */
  async disableMaintenance(shopId: number): Promise<void> {
    await this.prisma.product.updateMany({
      where: { shopId },
      data: { visibility: ProductVisibilityStatus.visibility_public },
    });
    this.events.emit(SHOP_MAINTENANCE_EVENT, {
      shopId,
      action: 'disable',
    } satisfies ShopMaintenanceEventPayload);
  }

  /** Padanan Shop::generateUniqueSlug() (dipanggil dari model boot() lama). */
  private async generateUniqueSlug(
    name: string,
    ignoreId?: number,
  ): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const count = await this.prisma.shop.count({
      where: { slug: base, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    });

    return count > 0 ? `${base}-${count + 1}` : base;
  }
}
