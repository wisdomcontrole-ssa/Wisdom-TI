import { supabase } from '../lib/supabase'
import type {
  AdminUserRecord,
  AuditLogRecord,
  RoleRecord,
  SystemSettingRecord,
} from '../types/admin'

function client() {
  if (!supabase) {
    throw new Error('Supabase não está configurado.')
  }

  return supabase
}

function throwIfError(
  error: { message: string } | null,
) {
  if (error) {
    throw new Error(error.message)
  }
}

function normalizeRole(
  value: unknown,
): RoleRecord | null {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    const first = value[0]
    return first
      ? (first as RoleRecord)
      : null
  }

  return value as RoleRecord
}

export async function listRoles() {
  const { data, error } = await client()
    .from('roles')
    .select(
      'id, code, name, description, is_system',
    )
    .order('name')

  throwIfError(error)

  return (data ?? []) as RoleRecord[]
}

export async function listAdminUsers() {
  const { data, error } = await client()
    .from('profiles')
    .select(
      'id, full_name, email, role_id, active, last_seen_at, created_at, updated_at, roles(id, code, name, description, is_system)',
    )
    .order('full_name')

  throwIfError(error)

  return (data ?? []).map((row) => {
    const record = row as unknown as {
      id: string
      full_name: string
      email: string
      role_id: string
      active: boolean
      last_seen_at: string | null
      created_at: string
      updated_at: string
      roles: unknown
    }

    return {
      id: record.id,
      full_name: record.full_name,
      email: record.email,
      role_id: record.role_id,
      active: record.active,
      last_seen_at: record.last_seen_at,
      created_at: record.created_at,
      updated_at: record.updated_at,
      role: normalizeRole(record.roles),
    } satisfies AdminUserRecord
  })
}

async function invokeAdminUsers(
  body: Record<string, unknown>,
) {
  const { data, error } =
    await client().functions.invoke(
      'admin-users',
      { body },
    )

  throwIfError(error)

  const payload = data as {
    ok?: boolean
    user?: AdminUserRecord
    error?: string
  }

  if (!payload?.ok) {
    throw new Error(
      payload?.error ??
        'Operação administrativa recusada.',
    )
  }

  return payload
}

export async function inviteAdminUser(input: {
  fullName: string
  email: string
  roleId: string
}) {
  return invokeAdminUsers({
    action: 'invite',
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    role_id: input.roleId,
  })
}

export async function updateAdminUser(input: {
  userId: string
  fullName: string
  roleId: string
  active: boolean
}) {
  return invokeAdminUsers({
    action: 'update',
    user_id: input.userId,
    full_name: input.fullName.trim(),
    role_id: input.roleId,
    active: input.active,
  })
}

export async function listAuditLogs(
  limit = 500,
) {
  const { data, error } = await client()
    .from('audit_logs')
    .select(
      'id, actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata, created_at',
    )
    .order('created_at', {
      ascending: false,
    })
    .limit(limit)

  throwIfError(error)

  return (data ?? []) as AuditLogRecord[]
}

export async function listSystemSettings() {
  const { data, error } = await client()
    .from('system_settings')
    .select(
      'key, group_code, label, description, value, value_type, sensitive, updated_by, created_at, updated_at',
    )
    .order('group_code')
    .order('key')

  throwIfError(error)

  return (data ?? []) as SystemSettingRecord[]
}

export async function updateSystemSetting(
  key: string,
  value: unknown,
) {
  const { data, error } = await client().rpc(
    'update_system_setting',
    {
      p_key: key,
      p_value: value,
    },
  )

  throwIfError(error)

  return data as SystemSettingRecord
}
