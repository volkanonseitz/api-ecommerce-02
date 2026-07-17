import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RbacService } from '../../common/services/rbac.service';
import { UsersSecurityService } from './security.service';
import { EmailVerificationService } from '../auth/email-verification.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Prisma } from '../../../generated/prisma/client';

const USER_WITH_RELATIONS = { profile: true, address: true } as const;

@Injectable()
export class UsersCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly security: UsersSecurityService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  /** Padanan CreateUserAction (dipanggil UserManagementController::store). */
  async createByAdmin(dto: AdminCreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: passwordHash,
          shopId: dto.shop_id ?? null,
          emailVerifiedAt: new Date(),
        },
      });

      if (dto.profile) {
        await tx.userProfile.create({
          data: {
            customerId: created.id,
            avatar: dto.profile.avatar
              ? { original: dto.profile.avatar }
              : undefined,
            bio: dto.profile.bio,
            socials: dto.profile.socials as Prisma.InputJsonValue,
          },
        });
      }

      if (dto.address) {
        await tx.address.create({
          data: {
            customerId: created.id,
            title: 'Utama',
            type: 'home',
            address: {
              street_address: dto.address.street_address,
              city: dto.address.city,
              state: dto.address.state,
              zip: dto.address.zip,
              country: dto.address.country,
            },
          },
        });
      }

      return created;
    });

    await this.security.recordPasswordChange(user.id, dto.password);

    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: USER_WITH_RELATIONS,
    });
  }

  /** Padanan UpdateUserAction (ProfileController::update — user update dirinya sendiri). */
  async updateSelf(userId: number, dto: UpdateProfileDto) {
    if (dto.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: userId } },
      });
      if (clash) throw new ConflictException('Email sudah digunakan.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.address) {
        for (const addr of dto.address) {
          if (addr.id) {
            // where id + customerId sekaligus -> mencegah IDOR (user lain tidak
            // bisa update alamat milik user ini walau tahu ID-nya).
            await tx.address.updateMany({
              where: { id: addr.id, customerId: userId },
              data: {
                address: {
                  street_address: addr.street_address,
                  city: addr.city,
                  state: addr.state,
                  zip: addr.zip,
                  country: addr.country,
                },
              },
            });
          } else {
            await tx.address.create({
              data: {
                customerId: userId,
                title: 'Utama',
                type: 'home',
                address: {
                  street_address: addr.street_address,
                  city: addr.city,
                  state: addr.state,
                  zip: addr.zip,
                  country: addr.country,
                },
              },
            });
          }
        }
      }

      if (dto.profile) {
        if (dto.profile.id) {
          await tx.userProfile.updateMany({
            where: { id: dto.profile.id, customerId: userId },
            data: {
              bio: dto.profile.bio,
              avatar: dto.profile.avatar
                ? { original: dto.profile.avatar }
                : undefined,
            },
          });
        } else {
          await tx.userProfile.upsert({
            where: { customerId: userId },
            create: {
              customerId: userId,
              bio: dto.profile.bio,
              avatar: dto.profile.avatar
                ? { original: dto.profile.avatar }
                : undefined,
            },
            update: {
              bio: dto.profile.bio,
              avatar: dto.profile.avatar
                ? { original: dto.profile.avatar }
                : undefined,
            },
          });
        }
      }

      const updateData: { name?: string; email?: string } = {};
      if (dto.name) updateData.name = dto.name;
      if (dto.email) updateData.email = dto.email;
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({ where: { id: userId }, data: updateData });
      }
    });

    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: USER_WITH_RELATIONS,
    });
  }

  /** Padanan AdminUpdateUserAction — bedanya shop_id BOLEH diubah di sini. */
  async updateByAdmin(targetId: number, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User tidak ditemukan.');

    if (dto.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: targetId } },
      });
      if (clash) throw new ConflictException('Email sudah digunakan.');
    }

    const updateData: {
      name?: string;
      email?: string;
      shopId?: number | null;
    } = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.shop_id !== undefined) updateData.shopId = dto.shop_id;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: targetId },
        data: updateData,
      });
    }

    return this.prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      include: USER_WITH_RELATIONS,
    });
  }

  async updateEmail(userId: number, newEmail: string): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: { email: newEmail, id: { not: userId } },
    });
    if (clash) throw new ConflictException('Email sudah digunakan.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { email: newEmail, emailVerifiedAt: null },
    });

    // Padanan `$user->sendEmailVerificationNotification()` yang otomatis
    // terpanggil di Laravel saat email berubah (event Registered/Updated).
    await this.emailVerificationService
      .sendVerificationEmail(updated)
      .catch(() => undefined);
  }

  /**
   * Konsolidasi ChangePasswordAction + UserSecurityController::changePassword
   * (di versi lama ada dua endpoint terpisah dengan logika yang tumpang
   * tindih — di sini digabung jadi satu alur lengkap: cek password lama,
   * cek histori, simpan histori, cabut sesi lain).
   */
  async changePassword(
    userId: number,
    currentSessionId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.password || !(await bcrypt.compare(oldPassword, user.password))) {
      throw new BadRequestException('Password lama tidak sesuai.');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException(
        'Password baru tidak boleh sama dengan password lama.',
      );
    }

    if (await this.security.isPasswordInHistory(userId, newPassword)) {
      throw new BadRequestException(
        'Password baru tidak boleh sama dengan password sebelumnya.',
      );
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newHash },
    });
    await this.security.recordPasswordChange(userId, newPassword);

    // Cabut semua sesi LAIN (bukan sesi yang sedang dipakai) setelah ganti password.
    await this.prisma.userSession.deleteMany({
      where: { userId, tokenId: { not: currentSessionId } },
    });
  }

  /** Padanan ToggleUserActiveAction. */
  async toggleActive(targetId: number, active: boolean) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User tidak ditemukan.');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { isActive: active },
      });

      if (!active) {
        const shops = await tx.shop.findMany({
          where: { ownerId: targetId },
          select: { id: true },
        });
        const shopIds = shops.map((s) => s.id);
        if (shopIds.length > 0) {
          await tx.shop.updateMany({
            where: { id: { in: shopIds } },
            data: { isActive: false },
          });
          await tx.product.updateMany({
            where: { shopId: { in: shopIds } },
            data: { status: 'draft' },
          });
        }
        // Nonaktifkan juga akun -> cabut semua sesi aktif (dipaksa logout).
        await tx.userSession.deleteMany({ where: { userId: targetId } });
      }
    });

    return this.prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      include: USER_WITH_RELATIONS,
    });
  }

  /** Padanan ToggleAdminPrivilegeAction. */
  async toggleAdmin(targetId: number): Promise<boolean> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User tidak ditemukan.');

    const isCurrentlyAdmin = await this.rbac.hasPermission(
      targetId,
      'super_admin',
    );

    if (isCurrentlyAdmin) {
      await this.rbac.removeRole(targetId, 'super_admin');
    } else {
      await this.rbac.assignRole(targetId, 'super_admin');
    }

    return !isCurrentlyAdmin;
  }

  async deleteUser(targetId: number): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User tidak ditemukan.');
    await this.prisma.user.delete({ where: { id: targetId } });
  }
}
