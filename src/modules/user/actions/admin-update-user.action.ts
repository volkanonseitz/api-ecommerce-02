// src/modules/user/actions/admin-update-user.action.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';

@Injectable()
export class AdminUpdateUserAction {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: number, data: AdminUpdateUserDto) {
    // Buat object update hanya dengan field yang dikirim
    const updateData: Partial<
      Pick<AdminUpdateUserDto, 'name' | 'email' | 'shop_id'>
    > = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.shop_id !== undefined) updateData.shop_id = data.shop_id;

    // Update hanya jika ada field yang diubah
    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Ambil data user terbaru dengan relasi
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        address: true,
        shops: true,
        managed_shop: true,
      },
    });
  }
}
