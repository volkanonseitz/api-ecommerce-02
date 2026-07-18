import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  subject,
} from '@casl/ability';
import { Action } from './action.enum';
import type {
  AuthUser,
  OwnershipTransferSubject,
  ShopSubject,
  UserSubject,
} from '../../types/auth-user.type';

type NumberCondition = number | { $eq?: number; $ne?: number };

type Conditions = {
  id?: NumberCondition;
  ownerId?: NumberCondition;
  fromId?: NumberCondition;
  toId?: NumberCondition;
  isStaff?: boolean;
};

export type UserSubjectType = 'User';
export type ShopSubjectType = 'Shop';
export type OwnershipTransferSubjectType = 'OwnershipTransfer';
export type AppAbility = MongoAbility<
  [Action, UserSubjectType | ShopSubjectType | OwnershipTransferSubjectType],
  Conditions
>;

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

    // ================= User (UserPolicy) ====================================
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

    // ================= Shop (ShopPolicy) =====================================
    // ---- viewAny / view: publik (listing & detail toko terbuka untuk semua) --
    can(Action.ViewAny, 'Shop');
    can(Action.View, 'Shop');

    // ---- create(actor): hasPermissionTo(STORE_OWNER) --------------------------
    if (isStoreOwner) {
      can(Action.Create, 'Shop');
    }

    // ---- update/delete/manageStaff/transferOwnership/toggleMaintenance:
    //      isSuperAdmin() OR isOwner() -- isOwner = STORE_OWNER permission
    //      DAN ownerId === actor.id (dua syarat, persis seperti Policy lama) --
    if (isStoreOwner) {
      can(Action.Update, 'Shop', { ownerId: actor.id });
      can(Action.Delete, 'Shop', { ownerId: actor.id });
      can(Action.ManageStaff, 'Shop', { ownerId: actor.id });
      can(Action.TransferOwnership, 'Shop', { ownerId: actor.id });
      can(Action.ToggleMaintenance, 'Shop', { ownerId: actor.id });
    }
    if (isSuperAdmin) {
      can(Action.Update, 'Shop');
      can(Action.Delete, 'Shop');
      can(Action.ManageStaff, 'Shop');
      can(Action.TransferOwnership, 'Shop');
      can(Action.ToggleMaintenance, 'Shop');
    }

    // ---- approve: hanya super_admin --------------------------------------------
    if (isSuperAdmin) {
      can(Action.ApproveShop, 'Shop');
    }

    // ---- viewBalance: super_admin OR isOwner OR staff toko tsb -----------------
    // `isStaff` dihitung di service layer sebelum target dilempar ke sini
    // (lihat catatan di ShopSubject, types/auth-user.type.ts).
    if (isStoreOwner) {
      can(Action.ViewBalance, 'Shop', { ownerId: actor.id });
    }
    can(Action.ViewBalance, 'Shop', { isStaff: true });
    if (isSuperAdmin) {
      can(Action.ViewBalance, 'Shop');
    }

    // ================= OwnershipTransfer (OwnershipTransferPolicy) ===========
    // ---- viewAny: SUPER_ADMIN OR STORE_OWNER -----------------------------------
    if (isSuperAdmin || isStoreOwner) {
      can(Action.ViewAny, 'OwnershipTransfer');
    }

    // ---- view: SUPER_ADMIN OR pihak terkait (from/to) --------------------------
    can(Action.View, 'OwnershipTransfer', { fromId: actor.id });
    can(Action.View, 'OwnershipTransfer', { toId: actor.id });
    if (isSuperAdmin) {
      can(Action.View, 'OwnershipTransfer');
    }

    // ---- create: STORE_OWNER OR SUPER_ADMIN ------------------------------------
    if (isStoreOwner || isSuperAdmin) {
      can(Action.Create, 'OwnershipTransfer');
    }

    // ---- update (approve/reject): HANYA SUPER_ADMIN ----------------------------
    if (isSuperAdmin) {
      can(Action.Update, 'OwnershipTransfer');
    }

    // ---- delete: SUPER_ADMIN OR pembuat request (from) -------------------------
    can(Action.Delete, 'OwnershipTransfer', { fromId: actor.id });
    if (isSuperAdmin) {
      can(Action.Delete, 'OwnershipTransfer');
    }

    return build();
  }

  /**
   * Dipakai internal (authorize() + *.mapper.ts) supaya evaluasi kondisi
   * selalu lewat mesin CASL asli — bukan ditulis ulang manual. Cast di baris
   * terakhir HANYA menenangkan TypeScript (lihat catatan di atas type
   * AppAbility); nilai run-time yang dikirim ke CASL tetap objek asli yang
   * sudah ditandai subject(...).
   */
  can(
    actor: AuthUser,
    action: Action,
    subjectType: UserSubjectType,
    target: UserSubject,
  ): boolean;
  can(
    actor: AuthUser,
    action: Action,
    subjectType: ShopSubjectType,
    target: ShopSubject,
  ): boolean;
  can(
    actor: AuthUser,
    action: Action,
    subjectType: OwnershipTransferSubjectType,
    target: OwnershipTransferSubject,
  ): boolean;
  can(
    actor: AuthUser,
    action: Action,
    subjectType:
      UserSubjectType | ShopSubjectType | OwnershipTransferSubjectType,
    target: UserSubject | ShopSubject | OwnershipTransferSubject,
  ): boolean {
    const ability = this.defineAbilityFor(actor);
    const taggedTarget = subject(
      subjectType,
      target,
    ) as unknown as UserSubjectType &
      ShopSubjectType &
      OwnershipTransferSubjectType;
    return ability.can(action, taggedTarget);
  }

  /**
   * Padanan `$this->authorize($action, $target)` di Laravel controller.
   * Melempar 403 ForbiddenException kalau tidak berhak (defense in depth,
   * dipanggil eksplisit di controller/service setelah entity target di-fetch).
   */
  authorize(
    actor: AuthUser,
    action: Action,
    subjectType: UserSubjectType,
    target: UserSubject,
  ): void;
  authorize(
    actor: AuthUser,
    action: Action,
    subjectType: ShopSubjectType,
    target: ShopSubject,
  ): void;
  authorize(
    actor: AuthUser,
    action: Action,
    subjectType: OwnershipTransferSubjectType,
    target: OwnershipTransferSubject,
  ): void;
  authorize(
    actor: AuthUser,
    action: Action,
    subjectType:
      UserSubjectType | ShopSubjectType | OwnershipTransferSubjectType,
    target: UserSubject | ShopSubject | OwnershipTransferSubject,
  ): void {
    let allowed: boolean;
    if (subjectType === 'User') {
      allowed = this.can(actor, action, 'User', target as UserSubject);
    } else if (subjectType === 'Shop') {
      allowed = this.can(actor, action, 'Shop', target as ShopSubject);
    } else {
      allowed = this.can(
        actor,
        action,
        'OwnershipTransfer',
        target as OwnershipTransferSubject,
      );
    }

    if (!allowed) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }
  }
}
