import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PermissionService } from '../services/permission.service';
import { RegisterUserDto } from '../dto/register-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RegisterUserAction {
  constructor(
    private prisma: PrismaService,
    private permissionService: PermissionService,
  ) {}

  async execute(data: RegisterUserDto, requestedPermission: string | null) {
    // Hanya izinkan store_owner jika diminta
    const permissionToGrant =
      requestedPermission === 'store_owner' ? 'store_owner' : 'customer';
    const roleToAssign =
      permissionToGrant === 'store_owner' ? 'store_owner' : 'customer';

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await bcrypt.hash(data.password, 10),
        },
      });

      if (data.profile) {
        await tx.user_profiles.create({
          data: {
            customerId: newUser.id,
            avatar: data.profile.avatar,
            bio: data.profile.bio,
            socials: data.profile.socials,
          },
        });
      }

      if (data.address) {
        await tx.address.create({
          data: {
            customerId: newUser.id,
            title: 'Default',
            type: 'billing',
            address: data.address,
            default: true,
          },
        });
      }

      // Assign permission & role
      await this.permissionService.assignPermission(
        newUser.id,
        permissionToGrant,
      );
      const role = await tx.role.findUnique({ where: { name: roleToAssign } });
      if (role) {
        await tx.model_has_roles.create({
          data: {
            role_id: role.id,
            model_id: newUser.id,
            model_type: 'App\\Models\\User',
          },
        });
      }

      return newUser;
    });

    // Kirim event Registered (untuk verifikasi email)
    // Bisa menggunakan event emitter
    // ...

    // Queue signup points
    // ...

    return user;
  }
}
