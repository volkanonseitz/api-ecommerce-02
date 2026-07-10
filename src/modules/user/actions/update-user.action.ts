import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UpdateUserAction {
  constructor(private prisma: PrismaService) {}

  async execute(userId: number, data: UpdateUserDto) {
    return this.prisma.$transaction(async (tx) => {
      // Update address
      if (data.address) {
        for (const addr of data.address) {
          if (addr.id) {
            await tx.address.updateMany({
              where: { id: addr.id, customerId: userId },
              data: {
                title: addr.title,
                type: addr.type,
                address: {
                  street_address: addr.street_address,
                  city: addr.city,
                  state: addr.state,
                  zip: addr.zip,
                  country: addr.country,
                },
                default: addr.is_default,
              },
            });
          } else {
            await tx.address.create({
              data: {
                customerId: userId,
                title: addr.title || 'Default',
                type: addr.type || 'billing',
                address: {
                  street_address: addr.street_address,
                  city: addr.city,
                  state: addr.state,
                  zip: addr.zip,
                  country: addr.country,
                },
                default: addr.is_default || false,
              },
            });
          }
        }
      }

      // Update profile
      if (data.profile) {
        await tx.user_profile.upsert({
          where: { customerId: userId },
          update: {
            bio: data.profile.bio,
            avatar: data.profile.avatar,
            contact: data.profile.contact,
          },
          create: {
            customerId: userId,
            bio: data.profile.bio,
            avatar: data.profile.avatar,
            contact: data.profile.contact,
          },
        });
      }

      // Update user
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.email) updateData.email = data.email;
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: updateData,
        });
      }

      return tx.user.findUnique({
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
