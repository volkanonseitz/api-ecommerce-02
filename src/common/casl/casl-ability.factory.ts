import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Action } from './action.enum';
import { AuthUser, UserSubject } from '../../types/auth-user.type';

type Subjects = 'User';

type Conditions = {
  id?: number | { $eq?: number; $ne?: number };
};

export type AppAbility = MongoAbility<[Action, Subjects], Conditions>;

const PERMISSION = {
  SUPER_ADMIN: 'super_admin',
  STORE_OWNER: 'store_owner',
  STAFF: 'staff',
  CUSTOMER: 'customer',
} as const;

@Injectable()
export class CaslAbilityFactory {
  defineAbilityFor(actor: AuthUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    const isSuperAdmin = actor.permissions.includes(PERMISSION.SUPER_ADMIN);

    const isStoreOwner = actor.permissions.includes(PERMISSION.STORE_OWNER);

    if (isSuperAdmin) {
      can(Action.ViewAny, 'User');
    }

    can(Action.View, 'User', {
      id: actor.id,
    });

    if (isSuperAdmin) {
      can(Action.View, 'User');
    }

    if (isSuperAdmin) {
      can(Action.Create, 'User');
    }

    can(Action.Update, 'User', {
      id: actor.id,
    });

    if (isSuperAdmin) {
      can(Action.Update, 'User');
    }

    if (isSuperAdmin) {
      can(Action.Delete, 'User', {
        id: { $ne: actor.id },
      });

      can(Action.ToggleActive, 'User', {
        id: { $ne: actor.id },
      });

      can(Action.ToggleAdmin, 'User', {
        id: { $ne: actor.id },
      });
    }

    can(Action.ViewShopAssignment, 'User', {
      id: actor.id,
    });

    if (isSuperAdmin || isStoreOwner) {
      can(Action.ViewShopAssignment, 'User');
    }

    can(Action.ChangePassword, 'User', {
      id: actor.id,
    });

    can(Action.ViewSessions, 'User', {
      id: actor.id,
    });

    can(Action.RevokeSessions, 'User', {
      id: actor.id,
    });

    can(Action.UpdateSecuritySettings, 'User', {
      id: actor.id,
    });

    if (isSuperAdmin) {
      can(Action.ChangePassword, 'User');
      can(Action.ViewSessions, 'User');
      can(Action.RevokeSessions, 'User');
      can(Action.UpdateSecuritySettings, 'User');
      can(Action.ViewAuditLogs, 'User');
    }

    return build();
  }

  authorize(actor: AuthUser, action: Action, target: UserSubject): void {
    const ability = this.defineAbilityFor(actor);

    const allowed = ability.rulesFor(action, 'User').some((rule) => {
      if (!rule.conditions) {
        return true;
      }

      const idCondition = (
        rule.conditions as { id?: number | { $ne?: number } }
      ).id;

      if (typeof idCondition === 'number') {
        return idCondition === target.id;
      }

      if (idCondition?.$ne !== undefined) {
        return idCondition.$ne !== target.id;
      }

      return false;
    });

    if (!allowed) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }
  }
}
