import { AuthUser } from '../../types/auth-user.type';
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
  const ability = caslAbilityFactory.defineAbilityFor(requester);
  const canViewShopAssignment = ability
    .rulesFor(Action.ViewShopAssignment, 'User')
    .some((rule) => {
      if (!rule.conditions) {
        return true;
      }

      const idCondition = (
        rule.conditions as { id?: number | { $ne?: number } }
      ).id;

      if (typeof idCondition === 'number') {
        return idCondition === user.id;
      }

      return false;
    });

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
