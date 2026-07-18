import { Module } from '@nestjs/common';
import { OwnershipTransferController } from './ownership-transfer.controller';
import { OwnershipTransferService } from './ownership-transfer.service';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { RbacService } from '../../common/services/rbac.service';

@Module({
  controllers: [OwnershipTransferController],
  providers: [OwnershipTransferService, CaslAbilityFactory, RbacService],
  exports: [OwnershipTransferService],
})
export class OwnershipTransferModule {}
