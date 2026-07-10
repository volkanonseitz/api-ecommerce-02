import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateUserAction } from '../../actions/create-user.action';
import { UpdateUserAction } from '../actions/update-user.action';
import { AdminUpdateUserAction } from '../actions/admin-update-user.action';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UserCommandService {
  constructor(
    private prisma: PrismaService,
    private createUserAction: CreateUserAction,
    private updateUserAction: UpdateUserAction,
    private adminUpdateUserAction: AdminUpdateUserAction,
  ) {}

  async createByAdmin(data: any): Promise<any> {
    return this.createUserAction.execute(data);
  }

  async updateSelf(userId: number, data: UpdateUserDto): Promise<any> {
    return this.updateUserAction.execute(userId, data);
  }

  async updateByAdmin(userId: number, data: any): Promise<any> {
    return this.adminUpdateUserAction.execute(userId, data);
  }

  async updateEmail(userId: number, newEmail: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        email_verified_at: null,
      },
    });
    // Kirim notifikasi verifikasi (gunakan event atau queue)
  }
}
