/* eslint-disable */

import type {
  SupabaseClient,
} from 'npm:@supabase/supabase-js@2'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function optionalUuid(
  value: FormDataEntryValue | null,
) {
  if (typeof value !== 'string') {
    return null
  }

  const clean = value.trim()

  if (!clean) {
    return null
  }

  if (!uuidPattern.test(clean)) {
    throw new Error('UUID de contexto invalido.')
  }

  return clean
}

export interface EvidenceContext {
  assetId: string | null
  assetCode: string | null

  auditId: string | null
  auditCode: string | null

  auditItemId: string | null

  stockUnitId: string | null
  stockCode: string | null
}

async function getAsset(
  admin: SupabaseClient,
  id: string,
) {
  const { data, error } = await admin
    .from('assets')
    .select('id, asset_code')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error('Ativo nao encontrado.')
  }

  return data
}

async function getAudit(
  admin: SupabaseClient,
  id: string,
) {
  const { data, error } = await admin
    .from('audit_cycles')
    .select('id, audit_code')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error('Auditoria nao encontrada.')
  }

  return data
}

async function getStock(
  admin: SupabaseClient,
  id: string,
) {
  const { data, error } = await admin
    .from('stock_units')
    .select('id, stock_code')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error(
      'Item de estoque nao encontrado.',
    )
  }

  return data
}

export async function resolveEvidenceContext(
  admin: SupabaseClient,
  input: {
    assetId: string | null
    auditId: string | null
    auditItemId: string | null
    stockUnitId: string | null
  },
): Promise<EvidenceContext> {
  let assetId = input.assetId
  let auditId = input.auditId

  if (input.auditItemId) {
    const { data: item, error } = await admin
      .from('audit_items')
      .select('id, audit_id, asset_id')
      .eq('id', input.auditItemId)
      .single()

    if (error || !item) {
      throw new Error(
        'Item de auditoria nao encontrado.',
      )
    }

    if (
      auditId &&
      auditId !== item.audit_id
    ) {
      throw new Error(
        'Auditoria divergente do item informado.',
      )
    }

    if (
      assetId &&
      assetId !== item.asset_id
    ) {
      throw new Error(
        'Ativo divergente do item de auditoria.',
      )
    }

    auditId = item.audit_id
    assetId = item.asset_id
  }

  if (
    !assetId &&
    !auditId &&
    !input.stockUnitId
  ) {
    throw new Error(
      'Informe um ativo, auditoria ou item de estoque.',
    )
  }

  const context: EvidenceContext = {
    assetId,
    assetCode: null,
    auditId,
    auditCode: null,
    auditItemId: input.auditItemId,
    stockUnitId: input.stockUnitId,
    stockCode: null,
  }

  if (assetId) {
    const asset = await getAsset(admin, assetId)
    context.assetCode = asset.asset_code
  }

  if (auditId) {
    const audit = await getAudit(admin, auditId)
    context.auditCode = audit.audit_code
  }

  if (input.stockUnitId) {
    const stock = await getStock(
      admin,
      input.stockUnitId,
    )
    context.stockCode = stock.stock_code
  }

  return context
}

const categoryFolders: Record<string, string> = {
  registration: 'Cadastro',
  audit: 'Auditoria',
  movement: 'Movimentacao',
  maintenance: 'Manutencao',
  disposal: 'Descarte',
  stock: 'Estoque',
  other: 'Outros',
}

export function buildFolderRoute(
  context: EvidenceContext,
  categoryCode: string,
) {
  const category =
    categoryFolders[categoryCode] ?? 'Outros'

  if (context.assetCode) {
    return [
      'Ativos',
      context.assetCode,
      category,
    ]
  }

  if (context.auditCode) {
    return [
      'Auditorias',
      context.auditCode,
      category,
    ]
  }

  if (context.stockCode) {
    return [
      'Estoque',
      context.stockCode,
      category,
    ]
  }

  throw new Error(
    'Nao foi possivel determinar a pasta da evidencia.',
  )
}
