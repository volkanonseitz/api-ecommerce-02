import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmailVerificationService } from './email-verification.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}
