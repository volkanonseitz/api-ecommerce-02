import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  subject,
} from '@casl/ability';
import { Action } from './action.enum';
import type { AuthUser, UserSubject } from '../../types/auth-user.type';

type Conditions = {
  id?: number | { $eq?: number; $ne?: number };
};

export type AppAbility = MongoAbility<[Action, 'User'], Conditions>;

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

    // ---- viewAny(actor): hasPermissionTo(SUPER_ADMIN) ----------------------
    if (isSuperAdmin) {
      can(Action.ViewAny, 'User');
    }

    // ---- view(actor, target): self OR super_admin ---------------------------
    can(Action.View, 'User', { id: actor.id });
    if (isSuperAdmin) {
      can(Action.View, 'User');
    }

    // ---- create(actor): hasPermissionTo(SUPER_ADMIN) -------------------------
    if (isSuperAdmin) {
      can(Action.Create, 'User');
    }

    // ---- update(actor, target): self OR super_admin --------------------------
    can(Action.Update, 'User', { id: actor.id });
    if (isSuperAdmin) {
      can(Action.Update, 'User');
    }

    // ---- delete(actor, target): actor.id !== target.id AND super_admin -------
    if (isSuperAdmin) {
      can(Action.Delete, 'User', { id: { $ne: actor.id } });
    }

    // ---- toggleActive / toggleAdmin: sama seperti delete ----------------------
    if (isSuperAdmin) {
      can(Action.ToggleActive, 'User', { id: { $ne: actor.id } });
      can(Action.ToggleAdmin, 'User', { id: { $ne: actor.id } });
    }

    // ---- viewShopAssignment: self OR super_admin OR store_owner ---------------
    can(Action.ViewShopAssignment, 'User', { id: actor.id });
    if (isSuperAdmin || isStoreOwner) {
      can(Action.ViewShopAssignment, 'User');
    }

    // ---- changePassword / viewSessions / revokeSessions / updateSecuritySettings:
    //      self OR super_admin -----------------------------------------------
    can(Action.ChangePassword, 'User', { id: actor.id });
    can(Action.ViewSessions, 'User', { id: actor.id });
    can(Action.RevokeSessions, 'User', { id: actor.id });
    can(Action.UpdateSecuritySettings, 'User', { id: actor.id });
    if (isSuperAdmin) {
      can(Action.ChangePassword, 'User');
      can(Action.ViewSessions, 'User');
      can(Action.RevokeSessions, 'User');
      can(Action.UpdateSecuritySettings, 'User');
    }

    // ---- viewAuditLogs: hanya super_admin --------------------------------------
    if (isSuperAdmin) {
      can(Action.ViewAuditLogs, 'User');
    }

    return build();
  }

  can(actor: AuthUser, action: Action, target: UserSubject): boolean {
    const ability = this.defineAbilityFor(actor);
    const taggedTarget = subject('User', target) as unknown as 'User';
    return ability.can(action, taggedTarget);
  }

  authorize(actor: AuthUser, action: Action, target: UserSubject): void {
    if (!this.can(actor, action, target)) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }
  }
}
