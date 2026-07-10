import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Permission } from '@prisma/client'; // asumsikan enum permission

@Injectable()
export class UserQueryService {
  constructor(private prisma: PrismaService) {}

  async getAdminUsers(): Promise<any[]> {
    // Cache implement with cache-manager
    const adminPermission = await this.prisma.permission.findUnique({
      where: { name: 'super_admin' },
    });
    if (!adminPermission) return [];
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        model_has_permissions: {
          some: {
            permission_id: adminPermission.id,
            model_type: 'App\\Models\\User',
          },
        },
      },
      include: { profile: true },
    });
    return users;
  }

  async hasShopAuthority(userId: number, shopId?: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        model_has_permissions: { include: { permission: true } },
      },
    });
    if (!user) return false;
    const isSuperAdmin = user.model_has_permissions.some(
      (p) => p.permission.name === 'super_admin',
    );
    if (isSuperAdmin) return true;
    if (!shopId) return false;
    const shop = await this.prisma.shops.findUnique({ where: { id: shopId } });
    if (!shop || !shop.isActive) return false;
    const isOwner = shop.owner_id === userId;
    if (isOwner) return true;
    // Cek staff
    const isStaff = await this.prisma.user_shop.findFirst({
      where: { user_id: userId, shop_id: shopId },
    });
    return !!isStaff;
  }

  async paginatedVendors(params: {
    shopId?: number;
    exclude?: number;
    isActive: boolean;
    limit: number;
    page: number;
  }) {
    const adminIds = await this.prisma.user.findMany({
      where: {
        model_has_permissions: {
          some: {
            permission: { name: 'super_admin' },
            model_type: 'App\\Models\\User',
          },
        },
      },
      select: { id: true },
    });
    const adminIdList = adminIds.map((u) => u.id);
    const where: any = {
      isActive: params.isActive,
      model_has_permissions: {
        some: {
          permission: { name: 'store_owner' },
          model_type: 'App\\Models\\User',
        },
      },
      id: { notIn: adminIdList },
    };
    if (params.exclude) {
      where.id = { ...where.id, not: params.exclude };
    }
    const total = await this.prisma.user.count({ where });
    const users = await this.prisma.user.findMany({
      where,
      include: { profile: true, address: true },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    });
    return {
      data: users,
      total,
      page: params.page,
      limit: params.limit,
    };
  }
}
