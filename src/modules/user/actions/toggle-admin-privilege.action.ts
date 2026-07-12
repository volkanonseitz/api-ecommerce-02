import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class ToggleAdminPrivilegeAction {
  constructor(private prisma: PrismaService) {}

  async execute(userId: number): Promise<boolean> {
    const permission = await this.prisma.permission.findUnique({
      where: { name: 'super_admin' },
    });
    if (!permission) throw new Error('Permission not found');
    //     const existing = await this.prisma.model_has_permissions.findFirst({
    //       where: {
    //         model_id: userId,
    //         model_type: 'App\\Models\\User',
    //         permission_id: permission.id,
    //       },
    //     });
    //     // if (!existing) {
    //     //   throw new Error('Existing permission not found');
    //     // }

    //     if (existing) {
    //       // Revoke
    //       // await this.prisma.model_has_permissions.delete({ // Commented out due to missing model in Prisma Client
    //       //   where: { id: existing.id },
    //       // });
    //       // Hapus role super_admin jika ada
    //       const role = await this.prisma.role.findUnique({
    //         where: { name: 'super_admin' },
    //       });
    //       if (role) {
    //         // await this.prisma.model_has_roles.deleteMany({ // Commented out due to missing model in Prisma Client
    //         //   where: {
    //         //     model_id: userId,
    //         //     model_type: 'App\\\\Models\\\\User',
    //         //     role_id: role.id,
    //         //   },
    //         // });
    //       }
    //       return false;
    //     } else {
    //       // Grant
    //       // await this.prisma.model_has_permissions.create({ // Commented out due to missing model in Prisma Client
    //       //   data: {
    //       //     permission_id: permission.id,
    //       //     model_id: userId,
    //       //     model_type: 'App\\\\Models\\\\User',
    //       //   },
    //       // });
    //       const role = await this.prisma.role.findUnique({
    //         where: { name: 'super_admin' },
    //       });
    //       if (role) {
    //         // await this.prisma.model_has_roles.create({ // Commented out due to missing model in Prisma Client
    //         //   data: {
    //         //     role_id: role.id,
    //         //     model_id: userId,
    //         //     model_type: 'App\\\\Models\\\\User',
    //         //   },
    //         // });
    //       }
    //       return true;
    //     }
  }
}
