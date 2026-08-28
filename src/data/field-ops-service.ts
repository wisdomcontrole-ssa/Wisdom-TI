import { supabase } from '../lib/supabase'
import type {
  AssetBindingView,
  EntryOrigin,
  ExpressAssetRecord,
  InventoryResolvedItem,
  LabelCatalogItem,
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

export async function resolveInventoryCode(
  value: string,
) {
  const { data, error } = await client().rpc(
    'resolve_inventory_code',
    {
      p_code: value.trim(),
    },
  )

  throwIfError(error)
  return data as InventoryResolvedItem
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
  throwIfError(typesResult.error)
  throwIfError(stockResult.error)
  throwIfError(productsResult.error)
  throwIfError(genericResult.error)
  throwIfError(classicResult.error)
  throwIfError(assetLinksResult.error)

  return {
    assets: (assetsResult.data ?? []) as AssetRecord[],
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
        status: stock.status,
      }
    }),
  ]

  return {
    ...catalog,
    items,
  }
}
