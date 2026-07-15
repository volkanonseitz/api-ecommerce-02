import type { AuthUser } from '../../types/auth-user.type';
import { Action } from '../../common/casl/action.enum';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';

export interface UserWithRelations {
  id: number;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  shopId: number | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: unknown;
}

/**
 * Padanan App\Modules\User\Http\Resources\UserResource.php.
 * `shopId` hanya disertakan kalau requester berhak (Action.ViewShopAssignment),
 * persis seperti `$this->when(...)` di Resource lama — mencegah information
 * disclosure ke pihak yang tidak berhak.
 */
export function toUserResource(
  user: UserWithRelations,
  requester: AuthUser,
  caslAbilityFactory: CaslAbilityFactory,
) {
  const canViewShopAssignment = caslAbilityFactory.can(requester, Action.ViewShopAssignment, { id: user.id });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.emailVerifiedAt !== null,
    is_active: user.isActive,
    ...(canViewShopAssignment ? { shop_id: user.shopId } : {}),
    profile: user.profile ?? undefined,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}
