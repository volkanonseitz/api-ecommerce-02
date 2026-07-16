import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../decorators/check-policies.decorator';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import type { AuthUser } from '../../types/auth-user.type';

type AuthenticatedRequest = Request & { user?: AuthUser };

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) ?? [];

    if (policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }

    const ability = this.caslAbilityFactory.defineAbilityFor(user);
    const allowed = policyHandlers.every((handler) => handler(ability));

    if (!allowed) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }

    return true;
  }
}
