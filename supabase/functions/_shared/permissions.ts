/* eslint-disable */

import type {
  SupabaseClient,
} from 'npm:@supabase/supabase-js@2'

export async function getPermissionSet(
  client: SupabaseClient,
  userId: string,
) {
  const { data: profile, error: profileError } =
    await client
      .from('profiles')
      .select('role_id, active')
      .eq('id', userId)
      .single()

  if (
    profileError ||
    !profile?.active ||
    !profile.role_id
  ) {
    throw new Error(
      'Perfil ou papel do usuario invalido.',
    )
  }

  const {
    data: rolePermissions,
    error: rolePermissionError,
  } = await client
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', profile.role_id)

  if (rolePermissionError) {
    throw new Error(
      'Nao foi possivel consultar permissoes.',
    )
  }

  const permissionIds = (
    rolePermissions ?? []
  ).map((item) => item.permission_id)

  if (permissionIds.length === 0) {
    return new Set<string>()
  }

  const { data: permissions, error } =
    await client
      .from('permissions')
      .select('code')
      .in('id', permissionIds)

  if (error) {
    throw new Error(
      'Nao foi possivel consultar permissoes.',
    )
  }

  return new Set(
    (permissions ?? []).map(
      (item) => item.code as string,
    ),
  )
}

function hasAny(
  permissions: Set<string>,
  codes: string[],
) {
  return codes.some((code) =>
    permissions.has(code),
  )
}

export function assertSettingsManage(
  permissions: Set<string>,
) {
  if (!permissions.has('settings.manage')) {
    throw new Error(
      'Sem permissao para administrar a integracao.',
    )
  }
}

export function assertEvidenceUpload(
  permissions: Set<string>,
  context: {
    categoryCode: string
    assetId?: string | null
    auditId?: string | null
    auditItemId?: string | null
    stockUnitId?: string | null
  },
) {
  if (permissions.has('settings.manage')) {
    return
  }

  if (context.auditId || context.auditItemId) {
    if (!permissions.has('audits.execute')) {
      throw new Error(
        'Sem permissao para anexar evidencia a auditoria.',
      )
    }

    return
  }

  if (context.stockUnitId) {
    if (
      !hasAny(permissions, [
        'stock.adjust',
        'stock.move',
      ])
    ) {
      throw new Error(
        'Sem permissao para anexar evidencia ao estoque.',
      )
    }

    return
  }

  if (context.assetId) {
    const required =
      context.categoryCode === 'disposal'
        ? ['assets.retire', 'assets.update']
        : ['assets.update']

    if (!hasAny(permissions, required)) {
      throw new Error(
        'Sem permissao para anexar evidencia ao patrimonio.',
      )
    }

    return
  }

  throw new Error(
    'Contexto da evidencia invalido.',
  )
}

export function assertEvidenceView(
  permissions: Set<string>,
  evidence: {
    uploaded_by: string
    asset_id?: string | null
    audit_id?: string | null
    audit_item_id?: string | null
    stock_unit_id?: string | null
  },
  userId: string,
) {
  if (
    permissions.has('settings.manage') ||
    permissions.has('logs.view') ||
    evidence.uploaded_by === userId
  ) {
    return
  }

  if (
    evidence.audit_id ||
    evidence.audit_item_id
  ) {
    if (!permissions.has('audits.view')) {
      throw new Error(
        'Sem permissao para visualizar a evidencia.',
      )
    }

    return
  }

  if (evidence.stock_unit_id) {
    if (!permissions.has('stock.view')) {
      throw new Error(
        'Sem permissao para visualizar a evidencia.',
      )
    }

    return
  }

  if (evidence.asset_id) {
    if (!permissions.has('assets.view')) {
      throw new Error(
        'Sem permissao para visualizar a evidencia.',
      )
    }

    return
  }

  throw new Error(
    'Sem permissao para visualizar a evidencia.',
  )
}

export function assertEvidenceManage(
  permissions: Set<string>,
  evidence: {
    asset_id?: string | null
    audit_id?: string | null
    audit_item_id?: string | null
    stock_unit_id?: string | null
    category_code: string
  },
) {
  assertEvidenceUpload(permissions, {
    categoryCode: evidence.category_code,
    assetId: evidence.asset_id,
    auditId: evidence.audit_id,
    auditItemId: evidence.audit_item_id,
    stockUnitId: evidence.stock_unit_id,
  })
}
