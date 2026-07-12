import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ChangePasswordAction {
  constructor(private prisma: PrismaService) {}

  async execute(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) return false;
    if (!(await bcrypt.compare(oldPassword, user.password))) return false;

    await this.prisma.users.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });

    // Revoke other tokens (kecuali yang sedang dipakai)
    // Kita bisa hapus semua token kecuali current token (dengan id tertentu)
    // Tapi kita tidak tahu current token id di sini, akan dihandle di controller.

    return true;
  }
}
