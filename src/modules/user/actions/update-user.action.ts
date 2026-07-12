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
              where: { id: addr.id, customer_id: userId },
              data: {
                title: addr.title,
                type: addr.type,
                streetAddress: addr.street_address,
                city: addr.city,
                state: addr.state,
                zip: addr.zip,
                country: addr.country,
                phone: addr.phone,
                isDefault: addr.is_default,
              },
            });
          } else {
            await tx.address.create({
              data: {
                customer_id: userId,
                title: addr.title || 'Default',
                type: addr.type || 'billing',
                streetAddress: addr.street_address,
                city: addr.city,
                state: addr.state,
                zip: addr.zip,
                country: addr.country,
                phone: addr.phone,
                isDefault: addr.is_default || false,
              },
            });
          }
        }
      }

      // Update profile
      if (data.profile) {
        await tx.profile.upsert({
          where: { userId: userId },
          update: {
            bio: data.profile.bio,
            avatar: data.profile.avatar,
            contact: data.profile.contact,
          },
          create: {
            userId: userId,
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
        await tx.users.update({
          where: { id: userId },
          data: updateData,
        });
      }

      return tx.users.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          address: true,
          // shops_owned: true, // Prisma Client does not expose 'shops_owned' directly.
          // shop: true, // Prisma Client does not expose 'shop' directly.
        },
      });
    });
  }
}
