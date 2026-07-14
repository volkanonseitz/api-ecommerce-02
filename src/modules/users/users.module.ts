import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ProfileController } from './profile.controller';
import { SecurityController } from './security.controller';
import { UsersCommandService } from './users-command.service';
import { UsersQueryService } from './users-query.service';
import { UsersSecurityService } from './security.service';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { RbacService } from '../../common/services/rbac.service';
import { PoliciesGuard } from '../../common/guards/policies.guard';

@Module({
  controllers: [UsersController, ProfileController, SecurityController],
  providers: [
    UsersCommandService,
    UsersQueryService,
    UsersSecurityService,
    CaslAbilityFactory,
    RbacService,
    PoliciesGuard,
  ],
  exports: [UsersQueryService],
})
export class UsersModule {}
