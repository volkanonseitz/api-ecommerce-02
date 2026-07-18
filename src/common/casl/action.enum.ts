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

  // Shop
  ManageStaff = 'manageStaff',
  TransferOwnership = 'transferOwnership',
  ToggleMaintenance = 'toggleMaintenance',
  ApproveShop = 'approve',
  ViewBalance = 'viewBalance',
}
