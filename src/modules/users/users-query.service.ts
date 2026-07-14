import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const USER_WITH_RELATIONS = { profile: true, address: true } as const;

/**
 * Operasi BACA seputar User — padanan UserQueryService.php (CQRS ringan,
 * dipisah dari UsersCommandService supaya query listing/report tidak
 * bercampur dengan operasi yang mengubah state).
 *
 * CATATAN: method lama `getAdminUsers()` (cache 15 menit) dan
 * `paginatedVendors()` / `hasShopAuthority()` sengaja TIDAK diporting di
 * sini karena menyentuh domain Shop yang belum dimigrasikan modulnya —
 * tambahkan lagi persis dengan pola di bawah begitu modul Shop sudah ada.
 */
@Injectable()
export class UsersQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async paginate(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: USER_WITH_RELATIONS,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);

    return { items, totalItems };
  }

  async findByIdOrFail(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_WITH_RELATIONS,
    });
    if (!user) throw new NotFoundException('User tidak ditemukan.');
    return user;
  }

  async findMe(userId: number) {
    return this.findByIdOrFail(userId);
  }
}
