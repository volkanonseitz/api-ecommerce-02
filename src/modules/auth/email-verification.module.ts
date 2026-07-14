import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmailVerificationService } from './email-verification.service';

/**
 * @Global() supaya EmailVerificationService bisa dipakai lintas modul
 * (AuthService.register(), UsersCommandService.updateEmail()) tanpa perlu
 * import silang antara AuthModule <-> UsersModule.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}
