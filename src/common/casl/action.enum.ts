/**
 * Daftar action CASL untuk subject 'User'.
 * Satu-satu dipetakan dari method di App\Modules\User\Policies\UserPolicy
 * (Laravel) supaya aturan "siapa boleh apa" tetap sama persis.
 */
export enum Action {
  ViewAny = 'viewAny',
  View = 'view',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  ToggleActive = 'toggleActive',
  ToggleAdmin = 'toggleAdmin',
  ViewShopAssignment = 'viewShopAssignment',
  ChangePassword = 'changePassword',
  ViewSessions = 'viewSessions',
  RevokeSessions = 'revokeSessions',
  ViewAuditLogs = 'viewAuditLogs',
  UpdateSecuritySettings = 'updateSecuritySettings',
}
