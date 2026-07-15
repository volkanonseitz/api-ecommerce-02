import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  subject,
} from '@casl/ability';
import { Action } from './action.enum';
import type { AuthUser, UserSubject } from '../../types/auth-user.type';

// @casl/ability v7: rulesFor(action, subjectType) hanya menerima TIPE subject
// (string), bukan lagi instance objek — makanya generic kedua di sini sengaja
// dipersempit jadi literal 'User' saja (bukan union dengan tipe objek), biar
// cocok dengan constraint tersebut. Konsekuensinya: memanggil `ability.can()`
// langsung dengan hasil `subject('User', obj)` akan ditolak TypeScript karena
// tipe objek yang di-brand itu bukan `'User'` secara literal — padahal di
// runtime bentuknya tetap benar (subject() cuma menambahkan tag tersembunyi).
// Makanya di helper `matches()` di bawah, hasil subject() di-cast eksplisit
// setelah dibungkus — BUKAN reimplementasi mesin evaluasi CASL sendiri
// (menghindari bug: rule priority, `cannot()`, operator kompleks, dst tetap
// ditangani oleh CASL asli, bukan oleh kode kita).
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

/**
 * Padanan 1:1 dari App\Modules\User\Policies\UserPolicy (Laravel).
 * Setiap method policy lama -> satu blok rule `can(...)` di sini, supaya
 * review keamanan bisa membandingkan baris-per-baris dengan versi lama.
 */
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

  /**
   * Dipakai internal (authorize() + user.mapper.ts) supaya evaluasi kondisi
   * (id sama dengan actor, id BUKAN actor, dst) selalu lewat mesin CASL asli
   * — bukan ditulis ulang manual. Cast di baris terakhir HANYA menenangkan
   * TypeScript (lihat catatan di atas type AppAbility); nilai run-time yang
   * dikirim ke CASL tetap objek asli yang sudah ditandai subject('User', ...).
   */
  can(actor: AuthUser, action: Action, target: UserSubject): boolean {
    const ability = this.defineAbilityFor(actor);
    const taggedTarget = subject('User', target) as unknown as 'User';
    return ability.can(action, taggedTarget);
  }

  /**
   * Padanan `$this->authorize($action, $target)` di Laravel controller.
   * Melempar 403 ForbiddenException kalau tidak berhak (defense in depth,
   * dipanggil eksplisit di controller/service setelah entity target di-fetch).
   */
  authorize(actor: AuthUser, action: Action, target: UserSubject): void {
    if (!this.can(actor, action, target)) {
      throw new ForbiddenException('Anda tidak berhak melakukan aksi ini.');
    }
  }
}
