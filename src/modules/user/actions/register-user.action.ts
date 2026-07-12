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
        await tx.profile.create({
          data: {
            userId: newUser.id,

            avatar: data.profile.avatar,
            bio: data.profile.bio,
            socials: data.profile.socials,
          },
        });
      }

      if (data.address) {
        await tx.address.create({
          data: {
            userId: newUser.id,

            title: 'Default',
            type: 'billing',
            streetAddress: data.address.street_address,
            city: data.address.city,
            state: data.address.state,
            zip: data.address.zip,
            country: data.address.country,
            phone: data.address.phone || null,
            isDefault: true,
          },
        });
      }

      await this.permissionService.assignPermission(
        newUser.id,
        permissionToGrant,
      );
      const role = await tx.role.findUnique({ where: { name: roleToAssign } });
      if (role) {
        // await tx.model_has_roles.create({ // Commented out due to missing model in Prisma Client
        //   data: {
        //     role_id: role.id,
        //     model_id: newUser.id,
        //     model_type: 'App\\Models\\User',
        //   },
        // });
      }
      return newUser;
    });

    return user;
  }
}
