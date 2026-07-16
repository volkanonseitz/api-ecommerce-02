import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/** Padanan `protected string $guard_name = 'api';` di App\Models\User.php lama. */
const GUARD_NAME = 'api';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assignRole(userId: number, roleName: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { name: roleName, guardName: GUARD_NAME },
    });
    if (!role) {
      this.logger.warn(`Role "${roleName}" belum di-seed, dilewati.`);
      return;
    }
    await this.prisma.userRole.upsert({
      where: { roleId_userId: { roleId: role.id, userId } },
      create: { roleId: role.id, userId },
      update: {},
    });
  }

  async removeRole(userId: number, roleName: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { name: roleName, guardName: GUARD_NAME },
    });
    if (!role) return;
    await this.prisma.userRole
      .delete({ where: { roleId_userId: { roleId: role.id, userId } } })
      .catch(() => undefined);
  }

  async grantPermission(userId: number, permissionName: string): Promise<void> {
    const permission = await this.prisma.permission.findFirst({
      where: { name: permissionName, guardName: GUARD_NAME },
    });
    if (!permission) {
      this.logger.warn(
        `Permission "${permissionName}" belum di-seed, dilewati.`,
      );
      return;
    }
    await this.prisma.userPermission.upsert({
      where: { permissionId_userId: { permissionId: permission.id, userId } },
      create: { permissionId: permission.id, userId },
      update: {},
    });
  }

  async revokePermission(
    userId: number,
    permissionName: string,
  ): Promise<void> {
    const permission = await this.prisma.permission.findFirst({
      where: { name: permissionName, guardName: GUARD_NAME },
    });
    if (!permission) return;
    await this.prisma.userPermission
      .delete({
        where: { permissionId_userId: { permissionId: permission.id, userId } },
      })
      .catch(() => undefined);
  }

  async hasRole(userId: number, roleName: string): Promise<boolean> {
    const role = await this.prisma.role.findFirst({
      where: { name: roleName, guardName: GUARD_NAME },
    });
    if (!role) return false;
    const link = await this.prisma.userRole.findUnique({
      where: { roleId_userId: { roleId: role.id, userId } },
    });
    return !!link;
  }

  async hasAnyRole(userId: number, roleNames: string[]): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: { name: { in: roleNames }, guardName: GUARD_NAME },
      },
    });
    return count > 0;
  }

  async hasPermission(
    userId: number,
    permissionName: string,
  ): Promise<boolean> {
    const direct = await this.prisma.userPermission.count({
      where: {
        userId,
        permission: { name: permissionName, guardName: GUARD_NAME },
      },
    });
    if (direct > 0) return true;

    const viaRole = await this.prisma.userRole.count({
      where: {
        userId,
        role: {
          permissions: {
            some: {
              permission: { name: permissionName, guardName: GUARD_NAME },
            },
          },
        },
      },
    });
    return viaRole > 0;
  }

  /** Dipakai AuthController untuk merangkum role+permission di response login/register. */
  async getUserRoleAndPermissionNames(
    userId: number,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const [roleLinks, permissionLinks] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      }),
      this.prisma.userPermission.findMany({
        where: { userId },
        include: { permission: true },
      }),
    ]);
    return {
      roles: roleLinks.map((r) => r.role.name),
      permissions: permissionLinks.map((p) => p.permission.name),
    };
  }
}
