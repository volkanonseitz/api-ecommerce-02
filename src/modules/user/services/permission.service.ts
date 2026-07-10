import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  async hasPermission(
    userId: number,
    permissionName: string,
  ): Promise<boolean> {
    const count = await this.prisma.model_has_permissions.count({
      where: {
        model_id: userId,
        model_type: 'App\\Models\\User',
        permission: { name: permissionName },
      },
    });
    return count > 0;
  }

  async getPermissions(userId: number): Promise<string[]> {
    const records = await this.prisma.model_has_permissions.findMany({
      where: { model_id: userId, model_type: 'App\\Models\\User' },
      include: { permission: true },
    });
    return records.map((r) => r.permission.name);
  }

  async assignPermission(userId: number, permissionName: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { name: permissionName },
    });
    if (!permission) throw new Error('Permission not found');
    await this.prisma.model_has_permissions.create({
      data: {
        permission_id: permission.id,
        model_id: userId,
        model_type: 'App\\Models\\User',
      },
    });
  }

  async revokePermission(userId: number, permissionName: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { name: permissionName },
    });
    if (!permission) throw new Error('Permission not found');
    await this.prisma.model_has_permissions.deleteMany({
      where: {
        permission_id: permission.id,
        model_id: userId,
        model_type: 'App\\Models\\User',
      },
    });
  }
}
