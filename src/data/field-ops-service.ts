import { supabase } from '../lib/supabase'
import type {
  AssetBindingView,
  EntryOrigin,
  ExpressAssetRecord,
  InventoryResolvedItem,
  LabelCatalogItem,
  M12AssetIdentifier,
  M12AssetLink,
  M12ClassicBinding,
  M12GenericBinding,
  M12StockProduct,
  M12StockUnit,
} from '../types/field-ops'
import type {
  AssetRecord,
  AssetTypeRecord,
} from '../types/assets'

function client() {
  if (!supabase) {
    throw new Error('Supabase não está configurado.')
  }

  return supabase
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message)
  }
}

const expressSelect =
  'id, asset_code, asset_type_id, manufacturer, model, serial_number, hostname, os_name, status, current_unit_id, current_environment_id, notes, acquired_at, registration_state, entry_origin, created_at, updated_at'

export async function createExpressAsset(input: {
  assetTypeId: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  entryOrigin: EntryOrigin
  unitId?: string
  environmentId?: string
  notes?: string
}) {
  const { data, error } = await client().rpc(
    'create_express_asset',
    {
      p_asset_type_id: input.assetTypeId,
      p_serial_number:
        input.serialNumber?.trim() || null,
      p_manufacturer:
        input.manufacturer?.trim() || null,
      p_model: input.model?.trim() || null,
      p_entry_origin: input.entryOrigin,
      p_unit_id: input.unitId || null,
      p_environment_id:
        input.environmentId || null,
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)
  return data as ExpressAssetRecord
}

export async function listPendingExpressAssets() {
  const { data, error } = await client()
    .from('assets')
    .select(expressSelect)
    .eq('registration_state', 'express_pending')
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []) as ExpressAssetRecord[]
}

export async function getPendingExpressCount() {
  const { count, error } = await client()
    .from('assets')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('registration_state', 'express_pending')

  throwIfError(error)
  return count ?? 0
}

export async function completeExpressAsset(
  assetId: string,
) {
  const { data, error } = await client().rpc(
    'complete_express_asset',
    {
      p_asset_id: assetId,
    },
  )

  throwIfError(error)
  return data as ExpressAssetRecord
}

interface InventoryAssetLookupRow {
  id: string
  asset_code: string
  manufacturer: string | null
  model: string | null
  status: string
  registration_state?: string | null
}

interface InventoryStockLookupRow {
  id: string
  stock_code: string
  short_code: string | null
  status: string
  installed_asset_id: string | null
  manufacturer: string | null
  model: string | null
}

function normalizeInventoryLookup(value: string) {
  let clean = value.trim()

  if (!clean) return ''

  try {
    const url = new URL(clean)
    const path = decodeURIComponent(url.pathname)

    const assetMarker = '/ativo/'
    const identifyMarker = '/identificar/'

    if (path.toLowerCase().includes(assetMarker)) {
      clean = path.slice(
        path.toLowerCase().lastIndexOf(assetMarker) +
          assetMarker.length,
      )
    } else if (
      path.toLowerCase().includes(identifyMarker)
    ) {
      clean = path.slice(
        path.toLowerCase().lastIndexOf(identifyMarker) +
          identifyMarker.length,
      )
    }
  } catch {
    const normalized = clean.replaceAll('\\', '/')
    const upper = normalized.toUpperCase()

    for (const marker of ['/ATIVO/', '/IDENTIFICAR/']) {
      const index = upper.lastIndexOf(marker)

      if (index >= 0) {
        clean = normalized.slice(index + marker.length)
        break
      }
    }
  }

  return clean
    .split(/[?#]/, 1)[0]
    .replace(/^\/+|\/+$/g, '')
    .trim()
}

function escapeIlikePattern(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
}

function assetLookupToResolved(
  row: InventoryAssetLookupRow,
): InventoryResolvedItem {
  return {
    kind: 'asset',
    id: row.id,
    code: row.asset_code,
    short_code: null,
    status: row.status,
    display_name:
      [row.manufacturer, row.model]
        .filter(Boolean)
        .join(' ') || 'Ativo',
    registration_state:
      (row.registration_state ??
        null) as InventoryResolvedItem['registration_state'],
  }
}

function stockLookupToResolved(
  row: InventoryStockLookupRow,
): InventoryResolvedItem {
  return {
    kind: 'stock_unit',
    id: row.id,
    code: row.stock_code,
    short_code: row.short_code,
    status: row.status,
    display_name:
      [row.manufacturer, row.model]
        .filter(Boolean)
        .join(' ') || 'Item de estoque',
    installed_asset_id: row.installed_asset_id,
  }
}

async function lookupAssetById(assetId: string) {
  const { data, error } = await client()
    .from('assets')
    .select(
      'id, asset_code, manufacturer, model, status, registration_state',
    )
    .eq('id', assetId)
    .single()

  throwIfError(error)

  return assetLookupToResolved(
    data as unknown as InventoryAssetLookupRow,
  )
}

export async function resolveInventoryCode(
  value: string,
) {
  const clean = normalizeInventoryLookup(value)

  if (!clean) {
    return {
      kind: 'unknown',
      id: null,
      code: '',
      short_code: null,
      status: null,
      display_name: null,
    } satisfies InventoryResolvedItem
  }

  const internalCode = clean.toUpperCase()

  const { data: exactAssets, error: exactAssetError } =
    await client()
      .from('assets')
      .select(
        'id, asset_code, manufacturer, model, status, registration_state',
      )
      .eq('asset_code', internalCode)
      .limit(2)

  throwIfError(exactAssetError)

  const assetRows =
    (exactAssets ?? []) as unknown as InventoryAssetLookupRow[]

  if (assetRows.length === 1) {
    return assetLookupToResolved(assetRows[0])
  }

  const [stockCodeResult, shortCodeResult] =
    await Promise.all([
      client()
        .from('stock_units')
        .select(
          'id, stock_code, short_code, status, installed_asset_id, manufacturer, model',
        )
        .eq('stock_code', internalCode)
        .limit(2),
      client()
        .from('stock_units')
        .select(
          'id, stock_code, short_code, status, installed_asset_id, manufacturer, model',
        )
        .eq('short_code', internalCode)
        .limit(2),
    ])

  throwIfError(stockCodeResult.error)
  throwIfError(shortCodeResult.error)

  const stockById = new Map<string, InventoryStockLookupRow>()

  for (const row of [
    ...((stockCodeResult.data ?? []) as unknown as InventoryStockLookupRow[]),
    ...((shortCodeResult.data ?? []) as unknown as InventoryStockLookupRow[]),
  ]) {
    stockById.set(row.id, row)
  }

  if (stockById.size === 1) {
    return stockLookupToResolved(
      [...stockById.values()][0],
    )
  }

  const ilikeValue = escapeIlikePattern(clean)

  const {
    data: externalRowsData,
    error: externalRowsError,
  } = await client()
    .from('asset_external_identifiers')
    .select('asset_id, identifier_value')
    .eq('active', true)
    .ilike('identifier_value', ilikeValue)
    .limit(4)

  throwIfError(externalRowsError)

  const externalRows =
    (externalRowsData ?? []) as unknown as Array<{
      asset_id: string
      identifier_value: string
    }>

  const externalAssetIds = Array.from(
    new Set(externalRows.map((row) => row.asset_id)),
  )

  if (externalAssetIds.length > 1) {
    throw new Error(
      'Código de terceiro associado a mais de um ativo. Use o Código interno ou o número de série para evitar identificação incorreta.',
    )
  }

  if (externalAssetIds.length === 1) {
    return lookupAssetById(externalAssetIds[0])
  }

  const {
    data: serialRowsData,
    error: serialRowsError,
  } = await client()
    .from('assets')
    .select(
      'id, asset_code, manufacturer, model, status, registration_state',
    )
    .ilike('serial_number', ilikeValue)
    .limit(4)

  throwIfError(serialRowsError)

  const serialRows =
    (serialRowsData ?? []) as unknown as InventoryAssetLookupRow[]

  if (serialRows.length > 1) {
    throw new Error(
      'Número de série associado a mais de um ativo. Use o Código interno ou o Código de terceiro para confirmar o equipamento.',
    )
  }

  if (serialRows.length === 1) {
    return assetLookupToResolved(serialRows[0])
  }

  const {
    data: serviceTagRowsData,
    error: serviceTagRowsError,
  } = await client()
    .from('assets')
    .select(
      'id, asset_code, manufacturer, model, status, registration_state',
    )
    .ilike('service_tag', ilikeValue)
    .limit(4)

  throwIfError(serviceTagRowsError)

  const serviceTagRows =
    (serviceTagRowsData ?? []) as unknown as InventoryAssetLookupRow[]

  if (serviceTagRows.length > 1) {
    throw new Error(
      'Código de serviço do fabricante associado a mais de um ativo.',
    )
  }

  if (serviceTagRows.length === 1) {
    return assetLookupToResolved(serviceTagRows[0])
  }

  const {
    data: assetResolution,
    error: assetResolutionError,
  } = await client().rpc(
    'resolve_asset_by_code',
    {
      p_code: clean,
    },
  )

  throwIfError(assetResolutionError)

  const aliasResult = assetResolution as {
    asset_id?: string | null
  } | null

  if (aliasResult?.asset_id) {
    return lookupAssetById(aliasResult.asset_id)
  }

  const { data, error } = await client().rpc(
    'resolve_inventory_code',
    {
      p_code: clean,
    },
  )

  throwIfError(error)

  return (
    (data as InventoryResolvedItem) ?? {
      kind: 'unknown',
      id: null,
      code: clean,
      short_code: null,
      status: null,
      display_name: null,
    }
  )
}

export async function linkStockBinding(input: {
  stockUnitId: string
  assetId: string
  relationType: string
  reason: string
}) {
  const { data, error } = await client().rpc(
    'link_stock_unit_to_asset',
    {
      p_stock_unit_id: input.stockUnitId,
      p_asset_id: input.assetId,
      p_relation_type: input.relationType,
      p_reason: input.reason.trim(),
    },
  )

  throwIfError(error)
  return data
}

export async function unlinkStockBinding(input: {
  stockUnitId: string
  assetId: string
  reason: string
}) {
  const { data, error } = await client().rpc(
    'unlink_stock_unit_from_asset',
    {
      p_stock_unit_id: input.stockUnitId,
      p_asset_id: input.assetId,
      p_reason: input.reason.trim(),
    },
  )

  throwIfError(error)
  return data
}

export async function linkAssetBinding(input: {
  parentAssetId: string
  childAssetId: string
  relationType: string
  reason: string
}) {
  const { data, error } = await client().rpc(
    'link_asset_to_asset',
    {
      p_parent_asset_id: input.parentAssetId,
      p_child_asset_id: input.childAssetId,
      p_relation_type: input.relationType,
      p_reason: input.reason.trim(),
    },
  )

  throwIfError(error)
  return data
}

export async function unlinkAssetBinding(input: {
  parentAssetId: string
  childAssetId: string
  reason: string
}) {
  const { data, error } = await client().rpc(
    'unlink_asset_from_asset',
    {
      p_parent_asset_id: input.parentAssetId,
      p_child_asset_id: input.childAssetId,
      p_reason: input.reason.trim(),
    },
  )

  throwIfError(error)
  return data
}

export async function listInventoryCatalog() {
  const [
    assetsResult,
    assetIdentifiersResult,
    typesResult,
    stockResult,
    productsResult,
    genericResult,
    classicResult,
    assetLinksResult,
  ] = await Promise.all([
    client()
      .from('assets')
      .select(
        'id, asset_code, asset_type_id, manufacturer, model, serial_number, hostname, os_name, status, current_unit_id, current_environment_id, notes, acquired_at, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(2000),
    client()
      .from('asset_external_identifiers')
      .select(
        'id, asset_id, organization_id, identifier_type, identifier_value, active, created_at',
      )
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(4000),
    client()
      .from('asset_types')
      .select('id, code, name, description, active')
      .order('name'),
    client()
      .from('stock_units')
      .select(
        'id, stock_code, short_code, product_id, manufacturer, model, serial_number, condition, status, current_unit_id, current_environment_id, installed_asset_id, notes',
      )
      .order('created_at', { ascending: false })
      .limit(4000),
    client()
      .from('stock_products')
      .select('id, code, name, category, can_install')
      .order('name'),
    client()
      .from('asset_stock_bindings')
      .select(
        'id, asset_id, stock_unit_id, relation_type, linked_at, linked_by, link_reason, unlinked_at, unlinked_by, unlink_reason',
      )
      .is('unlinked_at', null),
    client()
      .from('asset_components')
      .select(
        'id, asset_id, stock_unit_id, installed_at, installed_by, install_reason, removed_at, removed_by, removal_reason',
      )
      .is('removed_at', null),
    client()
      .from('asset_links')
      .select(
        'id, parent_asset_id, child_asset_id, relation_type, linked_at, linked_by, link_reason, removed_at, removed_by, removal_reason',
      )
      .is('removed_at', null),
  ])

  throwIfError(assetsResult.error)
  throwIfError(assetIdentifiersResult.error)
  throwIfError(typesResult.error)
  throwIfError(stockResult.error)
  throwIfError(productsResult.error)
  throwIfError(genericResult.error)
  throwIfError(classicResult.error)
  throwIfError(assetLinksResult.error)

  return {
    assets: (assetsResult.data ?? []) as AssetRecord[],
    assetIdentifiers:
      (assetIdentifiersResult.data ?? []) as unknown as M12AssetIdentifier[],
    types: (typesResult.data ?? []) as AssetTypeRecord[],
    stockUnits:
      (stockResult.data ?? []) as M12StockUnit[],
    products:
      (productsResult.data ?? []) as M12StockProduct[],
    genericBindings:
      (genericResult.data ?? []) as M12GenericBinding[],
    classicBindings:
      (classicResult.data ?? []) as M12ClassicBinding[],
    assetLinks:
      (assetLinksResult.data ?? []) as M12AssetLink[],
  }
}

export async function listAssetBindings(
  assetId: string,
) {
  const catalog = await listInventoryCatalog()

  const stockMap = new Map(
    catalog.stockUnits.map((item) => [item.id, item]),
  )
  const productMap = new Map(
    catalog.products.map((item) => [item.id, item]),
  )
  const assetMap = new Map(
    catalog.assets.map((item) => [item.id, item]),
  )
  const typeMap = new Map(
    catalog.types.map((item) => [item.id, item]),
  )

  const genericStockIds = new Set(
    catalog.genericBindings
      .filter((item) => item.asset_id === assetId)
      .map((item) => item.stock_unit_id),
  )

  const rows: AssetBindingView[] = []

  for (const binding of catalog.genericBindings) {
    if (binding.asset_id !== assetId) continue

    const stock = stockMap.get(binding.stock_unit_id)
    if (!stock) continue

    const product = productMap.get(stock.product_id)

    rows.push({
      key: `m12:${binding.id}`,
      kind: 'stock',
      source: 'm12',
      itemId: stock.id,
      linkId: binding.id,
      relationType: binding.relation_type,
      code: stock.stock_code,
      shortCode: stock.short_code,
      name: product?.name ?? 'Item de estoque',
      serial: stock.serial_number,
    })
  }

  for (const binding of catalog.classicBindings) {
    if (
      binding.asset_id !== assetId ||
      genericStockIds.has(binding.stock_unit_id)
    ) {
      continue
    }

    const stock = stockMap.get(binding.stock_unit_id)
    if (!stock) continue

    const product = productMap.get(stock.product_id)

    rows.push({
      key: `classic:${binding.id}`,
      kind: 'stock',
      source: 'classic',
      itemId: stock.id,
      linkId: binding.id,
      relationType: 'component',
      code: stock.stock_code,
      shortCode: stock.short_code,
      name: product?.name ?? 'Componente',
      serial: stock.serial_number,
    })
  }

  for (const link of catalog.assetLinks) {
    if (link.parent_asset_id !== assetId) continue

    const child = assetMap.get(link.child_asset_id)
    if (!child) continue

    const type = typeMap.get(child.asset_type_id)

    rows.push({
      key: `asset:${link.id}`,
      kind: 'asset',
      source: 'asset_link',
      itemId: child.id,
      linkId: link.id,
      relationType: link.relation_type,
      code: child.asset_code,
      shortCode: null,
      name: type?.name ?? child.model ?? 'Ativo vinculado',
      serial: child.serial_number,
    })
  }

  return rows
}

export async function listLabelCatalog() {
  const catalog = await listInventoryCatalog()

  const typeMap = new Map(
    catalog.types.map((item) => [item.id, item]),
  )
  const productMap = new Map(
    catalog.products.map((item) => [item.id, item]),
  )

  const identifiersByAsset = new Map<
    string,
    M12AssetIdentifier[]
  >()

  for (const identifier of catalog.assetIdentifiers) {
    const rows =
      identifiersByAsset.get(identifier.asset_id) ?? []
    rows.push(identifier)
    identifiersByAsset.set(identifier.asset_id, rows)
  }

  function thirdPartyCodeFor(assetId: string) {
    const identifiers =
      identifiersByAsset.get(assetId) ?? []

    const priority = [
      'patrimony',
      'tombamento',
      'internal_serial',
      'other',
    ]

    for (const type of priority) {
      const match = identifiers.find(
        (identifier) =>
          identifier.identifier_type === type,
      )

      if (match) return match.identifier_value
    }

    return null
  }

  const items: LabelCatalogItem[] = [
    ...catalog.assets.map((asset) => {
      const type = typeMap.get(asset.asset_type_id)

      return {
        kind: 'asset' as const,
        id: asset.id,
        code: asset.asset_code,
        shortCode: null,
        typeName: type?.name ?? 'Ativo',
        title:
          [asset.manufacturer, asset.model, asset.hostname]
            .filter(Boolean)
            .join(' · ') ||
          type?.name ||
          'Ativo',
        serial: asset.serial_number,
        thirdPartyCode:
          thirdPartyCodeFor(asset.id),
        status: asset.status,
      }
    }),
    ...catalog.stockUnits.map((stock) => {
      const product = productMap.get(stock.product_id)

      return {
        kind: 'stock' as const,
        id: stock.id,
        code: stock.stock_code,
        shortCode: stock.short_code,
        typeName: product?.name ?? 'Item de estoque',
        title:
          [stock.manufacturer, stock.model]
            .filter(Boolean)
            .join(' · ') ||
          product?.category ||
          'Componente',
        serial: stock.serial_number,
        thirdPartyCode: null,
        status: stock.status,
      }
    }),
  ]

  return {
    ...catalog,
    items,
  }
}
