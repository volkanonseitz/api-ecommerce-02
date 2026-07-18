import { Module } from '@nestjs/common';
import { ShopsController } from './shops.controller';
import { ShopsCommandService } from './shops-command.service';
import { ShopsQueryService } from './shops-query.service';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { RbacService } from '../../common/services/rbac.service';
import { PoliciesGuard } from '../../common/guards/policies.guard';
import { OptionalJwtAccessGuard } from '../../common/guards/optional-jwt-access.guard';
import { OwnershipTransferModule } from '../ownership-transfers/ownership-transfer.module';

@Module({
  imports: [OwnershipTransferModule],
  controllers: [ShopsController],
  providers: [
    ShopsCommandService,
    ShopsQueryService,
    CaslAbilityFactory,
    RbacService,
    PoliciesGuard,
    OptionalJwtAccessGuard,
  ],
})
export class ShopsModule {}
