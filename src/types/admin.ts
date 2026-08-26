export interface RoleRecord {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
}

export interface AdminUserRecord {
  id: string
  full_name: string
  email: string
  role_id: string
  active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
  role: RoleRecord | null
}

export interface AuditLogRecord {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  metadata: Record<string, unknown>
  created_at: string
}

export type SystemSettingValueType =
  | 'string'
  | 'number'
  | 'boolean'

export interface SystemSettingRecord {
  key: string
  group_code: string
  label: string
  description: string | null
  value: unknown
  value_type: SystemSettingValueType
  sensitive: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}
