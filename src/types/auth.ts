export interface AccessProfile {
  id: string
  fullName: string
  email: string
  active: boolean
}

export interface AccessRole {
  code: string
  name: string
}

export interface AccessContext {
  profile: AccessProfile
  role: AccessRole
  permissions: string[]
}

export type PermissionCode =
  | 'dashboard.view'
  | 'assets.view'
  | 'assets.create'
  | 'assets.update'
  | 'assets.move'
  | 'assets.retire'
  | 'stock.view'
  | 'stock.move'
  | 'stock.adjust'
  | 'audits.view'
  | 'audits.create'
  | 'audits.execute'
  | 'audits.close'
  | 'alerts.view'
  | 'alerts.manage'
  | 'locations.view'
  | 'locations.manage'
  | 'reports.view'
  | 'users.view'
  | 'users.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'logs.view'
