// src/modules/user/actions/admin-update-user.action.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';

type UpdateData = {
  name?: string;
  email?: string;
  shop_id?: number;
};

@Injectable()
export class AdminUpdateUserAction {
  constructor(private prisma: PrismaService) {}

  async execute(userId: number, data: AdminUpdateUserDto) {
    return await this.prisma.$transaction(async (tx) => {
      const updateData: UpdateData = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.shop_id !== undefined) updateData.shop_id = data.shop_id;

      if (Object.keys(updateData).length > 0) {
        await tx.users.update({
          where: { id: userId },
          data: updateData,
        });
      }

      return await tx.users.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          address: true,
          shops: true,
          managed_shop: true,
        },
      });
    });
  }
}
