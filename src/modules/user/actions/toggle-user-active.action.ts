import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class ToggleUserActiveAction {
  constructor(private prisma: PrismaService) {}

  async execute(userId: number, active: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: active },
      });
      if (!active) {
        // Nonaktifkan shop dan produk
        const shops = await tx.shops.findMany({
          where: { owner_id: userId },
          select: { id: true },
        });
        const shopIds = shops.map((s) => s.id);
        if (shopIds.length > 0) {
          await tx.shops.updateMany({
            where: { id: { in: shopIds } },
            data: { isActive: false },
          });
          await tx.products.updateMany({
            where: { shop_id: { in: shopIds } },
            data: { status: 'draft' },
          });
        }
      }
      return tx.user.findUnique({ where: { id: userId } });
    });
  }
}
