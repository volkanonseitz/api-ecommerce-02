import { SetMetadata } from '@nestjs/common';
import { AppAbility } from '../casl/casl-ability.factory';

export type PolicyHandlerFn = (ability: AppAbility) => boolean;
export type PolicyHandler = PolicyHandlerFn;

export const CHECK_POLICIES_KEY = 'check_policies';

/**
 * Untuk rule yang TIDAK butuh target entity (mis. viewAny, create) —
 * dievaluasi langsung oleh PoliciesGuard sebelum controller jalan.
 * Untuk rule yang butuh target (view/update/delete/dst by :id), tetap
 * panggil `caslAbilityFactory.authorize(actor, action, target)` di dalam
 * controller/service setelah entity di-fetch (persis seperti
 * `$this->authorize('update', $user)` di Laravel).
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
