import { supabase } from '../lib/supabase'
import type {
  AssetComponentRecord,
  StockCondition,
  StockMovementRecord,
  StockProductRecord,
  StockStatus,
  StockUnitRecord,
} from '../types/stock'

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

export async function listStockProducts() {
  const { data, error } = await client()
    .from('stock_products')
    .select(
      'id, code, name, category, track_serial, can_install, active, description',
    )
    .eq('active', true)
    .order('name')

  throwIfError(error)
  return (data ?? []) as StockProductRecord[]
}

export async function listStockUnits() {
  const { data, error } = await client()
    .from('stock_units')
    .select(
      'id, stock_code, product_id, manufacturer, model, serial_number, condition, status, specs, current_unit_id, current_environment_id, installed_asset_id, supplier_name, purchase_reference, acquired_at, warranty_until, cost_amount, notes, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(2000)

  throwIfError(error)
  return (data ?? []) as StockUnitRecord[]
}

export async function getStockUnitById(id: string) {
  const { data, error } = await client()
    .from('stock_units')
    .select(
      'id, stock_code, product_id, manufacturer, model, serial_number, condition, status, specs, current_unit_id, current_environment_id, installed_asset_id, supplier_name, purchase_reference, acquired_at, warranty_until, cost_amount, notes, created_at, updated_at',
    )
    .eq('id', id)
    .single()

  throwIfError(error)
  return data as StockUnitRecord
}

export async function listStockMovements(stockUnitId: string) {
  const { data, error } = await client()
    .from('stock_movements')
    .select(
      'id, stock_unit_id, movement_type, from_status, to_status, from_unit_id, from_environment_id, to_unit_id, to_environment_id, from_asset_id, to_asset_id, reason, actor_user_id, occurred_at',
    )
    .eq('stock_unit_id', stockUnitId)
    .order('occurred_at', { ascending: false })

  throwIfError(error)
  return (data ?? []) as StockMovementRecord[]
}

export async function listAssetComponents(assetId: string) {
  const { data, error } = await client()
    .from('asset_components')
    .select(
      'id, asset_id, stock_unit_id, installed_at, installed_by, install_reason, removed_at, removed_by, removal_reason',
    )
    .eq('asset_id', assetId)
    .order('installed_at', { ascending: false })

  throwIfError(error)
  return (data ?? []) as AssetComponentRecord[]
}

export interface CreateStockUnitInput {
  product_id: string
  manufacturer?: string
  model?: string
  serial_number?: string
  condition: StockCondition
  current_unit_id?: string
  current_environment_id?: string
  supplier_name?: string
  purchase_reference?: string
  acquired_at?: string
  warranty_until?: string
  cost_amount?: number
  notes?: string
}

export async function createStockUnit(input: CreateStockUnitInput) {
  const { data, error } = await client()
    .from('stock_units')
    .insert({
      product_id: input.product_id,
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serial_number?.trim() || null,
      condition: input.condition,
      current_unit_id: input.current_unit_id || null,
      current_environment_id: input.current_environment_id || null,
      supplier_name: input.supplier_name?.trim() || null,
      purchase_reference: input.purchase_reference?.trim() || null,
      acquired_at: input.acquired_at || null,
      warranty_until: input.warranty_until || null,
      cost_amount: input.cost_amount ?? null,
      notes: input.notes?.trim() || null,
    })
    .select(
      'id, stock_code, product_id, manufacturer, model, serial_number, condition, status, specs, current_unit_id, current_environment_id, installed_asset_id, supplier_name, purchase_reference, acquired_at, warranty_until, cost_amount, notes, created_at, updated_at',
    )
    .single()

  throwIfError(error)
  return data as StockUnitRecord
}

export interface UpdateStockUnitInput {
  product_id: string
  manufacturer?: string
  model?: string
  serial_number?: string
  condition: StockCondition
  supplier_name?: string
  purchase_reference?: string
  acquired_at?: string
  warranty_until?: string
  cost_amount?: number
  notes?: string
}

export async function updateStockUnit(
  id: string,
  input: UpdateStockUnitInput,
) {
  const { data, error } = await client()
    .from('stock_units')
    .update({
      product_id: input.product_id,
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serial_number?.trim() || null,
      condition: input.condition,
      supplier_name: input.supplier_name?.trim() || null,
      purchase_reference: input.purchase_reference?.trim() || null,
      acquired_at: input.acquired_at || null,
      warranty_until: input.warranty_until || null,
      cost_amount: input.cost_amount ?? null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
    .select(
      'id, stock_code, product_id, manufacturer, model, serial_number, condition, status, specs, current_unit_id, current_environment_id, installed_asset_id, supplier_name, purchase_reference, acquired_at, warranty_until, cost_amount, notes, created_at, updated_at',
    )
    .single()

  throwIfError(error)
  return data as StockUnitRecord
}

export async function installStockUnit(
  stockUnitId: string,
  assetId: string,
  reason: string,
) {
  const { data, error } = await client().rpc('install_stock_unit', {
    p_stock_unit_id: stockUnitId,
    p_asset_id: assetId,
    p_reason: reason.trim(),
  })

  throwIfError(error)
  return data
}

export async function removeStockUnit(
  stockUnitId: string,
  toUnitId: string | null,
  toEnvironmentId: string | null,
  condition: StockCondition,
  reason: string,
) {
  const { data, error } = await client().rpc('remove_stock_unit', {
    p_stock_unit_id: stockUnitId,
    p_to_unit_id: toUnitId,
    p_to_environment_id: toEnvironmentId,
    p_condition: condition,
    p_reason: reason.trim(),
  })

  throwIfError(error)
  return data
}

export async function moveStockUnit(
  stockUnitId: string,
  toUnitId: string | null,
  toEnvironmentId: string | null,
  reason: string,
) {
  const { data, error } = await client().rpc('move_stock_unit', {
    p_stock_unit_id: stockUnitId,
    p_to_unit_id: toUnitId,
    p_to_environment_id: toEnvironmentId,
    p_reason: reason.trim(),
  })

  throwIfError(error)
  return data
}

export async function changeStockUnitStatus(
  stockUnitId: string,
  status: Exclude<StockStatus, 'installed'>,
  reason: string,
) {
  const { data, error } = await client().rpc(
    'change_stock_unit_status',
    {
      p_stock_unit_id: stockUnitId,
      p_status: status,
      p_reason: reason.trim(),
    },
  )

  throwIfError(error)
  return data
}
