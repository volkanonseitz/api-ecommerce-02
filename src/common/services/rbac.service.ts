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
    const viaRole = await this.prisma.userRole.count({
      where: {
        userId,
        role: {
          permissions: {
            some: {
              permission: {
                name: permissionName,
                guardName: GUARD_NAME,
              },
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
    const roleLinks = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const roles = roleLinks.map((r) => r.role.name);

    const permissions = [
      ...new Set(
        roleLinks.flatMap((r) =>
          r.role.permissions.map((p) => p.permission.name),
        ),
      ),
    ];

    return { roles, permissions };
  }
}
