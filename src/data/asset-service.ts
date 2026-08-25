import { supabase } from '../lib/supabase'
import type {
  AssetMovementRecord,
  AssetRecord,
  AssetStatus,
  AssetTypeRecord,
  EnvironmentRecord,
  UnitRecord,
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

export async function listAssetTypes() {
  const { data, error } = await client()
    .from('asset_types')
    .select('id, code, name, description, active')
    .eq('active', true)
    .order('name')

  throwIfError(error)

  return (data ?? []) as AssetTypeRecord[]
}

export async function listUnits() {
  const { data, error } = await client()
    .from('units')
    .select(
      'id, code, name, description, address_text, active',
    )
    .order('name')

  throwIfError(error)

  return (data ?? []) as UnitRecord[]
}

export async function listEnvironments() {
  const { data, error } = await client()
    .from('environments')
    .select(
      'id, unit_id, code, name, environment_type, description, active',
    )
    .order('name')

  throwIfError(error)

  return (data ?? []) as EnvironmentRecord[]
}

export async function listAssets() {
  const { data, error } = await client()
    .from('assets')
    .select(
      'id, asset_code, asset_type_id, manufacturer, model, serial_number, hostname, os_name, status, current_unit_id, current_environment_id, notes, acquired_at, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(1000)

  throwIfError(error)

  return (data ?? []) as AssetRecord[]
}

export async function getAssetById(id: string) {
  const { data, error } = await client()
    .from('assets')
    .select(
      'id, asset_code, asset_type_id, manufacturer, model, serial_number, hostname, os_name, status, current_unit_id, current_environment_id, notes, acquired_at, created_at, updated_at',
    )
    .eq('id', id)
    .single()

  throwIfError(error)

  return data as AssetRecord
}

export async function getAssetByCode(code: string) {
  const { data, error } = await client()
    .from('assets')
    .select(
      'id, asset_code, asset_type_id, manufacturer, model, serial_number, hostname, os_name, status, current_unit_id, current_environment_id, notes, acquired_at, created_at, updated_at',
    )
    .eq('asset_code', code)
    .single()

  throwIfError(error)

  return data as AssetRecord
}

export async function listAssetMovements(assetId: string) {
  const { data, error } = await client()
    .from('asset_movements')
    .select(
      'id, asset_id, movement_type, from_unit_id, from_environment_id, to_unit_id, to_environment_id, reason, moved_by, moved_at',
    )
    .eq('asset_id', assetId)
    .order('moved_at', { ascending: false })

  throwIfError(error)

  return (data ?? []) as AssetMovementRecord[]
}

export async function listRecentMovements(limit = 6) {
  const { data, error } = await client()
    .from('asset_movements')
    .select(
      'id, asset_id, movement_type, from_unit_id, from_environment_id, to_unit_id, to_environment_id, reason, moved_by, moved_at',
    )
    .order('moved_at', { ascending: false })
    .limit(limit)

  throwIfError(error)

  return (data ?? []) as AssetMovementRecord[]
}

export interface CreateAssetInput {
  asset_type_id: string
  manufacturer?: string
  model?: string
  serial_number?: string
  hostname?: string
  os_name?: string
  status: AssetStatus
  current_unit_id?: string
  current_environment_id?: string
  notes?: string
  acquired_at?: string
}

export async function createAsset(input: CreateAssetInput) {
  const { data, error } = await client()
    .from('assets')
    .insert({
      asset_type_id: input.asset_type_id,
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serial_number?.trim() || null,
      hostname: input.hostname?.trim() || null,
      os_name: input.os_name?.trim() || null,
      status: input.status,
      current_unit_id: input.current_unit_id || null,
      current_environment_id:
        input.current_environment_id || null,
      notes: input.notes?.trim() || null,
      acquired_at: input.acquired_at || null,
    })
    .select(
      'id, asset_code, asset_type_id, manufacturer, model, serial_number, hostname, os_name, status, current_unit_id, current_environment_id, notes, acquired_at, created_at, updated_at',
    )
    .single()

  throwIfError(error)

  return data as AssetRecord
}

export interface UpdateAssetInput {
  asset_type_id: string
  manufacturer?: string
  model?: string
  serial_number?: string
  hostname?: string
  os_name?: string
  status: AssetStatus
  notes?: string
  acquired_at?: string
}

export async function updateAsset(
  assetId: string,
  input: UpdateAssetInput,
) {
  const { data, error } = await client()
    .from('assets')
    .update({
      asset_type_id: input.asset_type_id,
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serial_number?.trim() || null,
      hostname: input.hostname?.trim() || null,
      os_name: input.os_name?.trim() || null,
      status: input.status,
      notes: input.notes?.trim() || null,
      acquired_at: input.acquired_at || null,
    })
    .eq('id', assetId)
    .select(
      'id, asset_code, asset_type_id, manufacturer, model, serial_number, hostname, os_name, status, current_unit_id, current_environment_id, notes, acquired_at, created_at, updated_at',
    )
    .single()

  throwIfError(error)

  return data as AssetRecord
}

export async function moveAsset(
  assetId: string,
  toUnitId: string | null,
  toEnvironmentId: string | null,
  reason: string,
) {
  const { data, error } = await client().rpc('move_asset', {
    p_asset_id: assetId,
    p_to_unit_id: toUnitId,
    p_to_environment_id: toEnvironmentId,
    p_reason: reason.trim(),
  })

  throwIfError(error)

  return data as {
    asset_id: string
    asset_code: string
    unit_id: string | null
    environment_id: string | null
  }
}

export interface UnitInput {
  code: string
  name: string
  description?: string
  address_text?: string
  active?: boolean
}

export async function createUnit(input: UnitInput) {
  const { error } = await client().from('units').insert({
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    address_text: input.address_text?.trim() || null,
    active: input.active ?? true,
  })

  throwIfError(error)
}

export async function updateUnit(
  id: string,
  input: UnitInput,
) {
  const { error } = await client()
    .from('units')
    .update({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      address_text: input.address_text?.trim() || null,
      active: input.active ?? true,
    })
    .eq('id', id)

  throwIfError(error)
}

export interface EnvironmentInput {
  unit_id: string
  code: string
  name: string
  environment_type: string
  description?: string
  active?: boolean
}

export async function createEnvironment(
  input: EnvironmentInput,
) {
  const { error } = await client()
    .from('environments')
    .insert({
      unit_id: input.unit_id,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      environment_type: input.environment_type,
      description: input.description?.trim() || null,
      active: input.active ?? true,
    })

  throwIfError(error)
}

export async function updateEnvironment(
  id: string,
  input: EnvironmentInput,
) {
  const { error } = await client()
    .from('environments')
    .update({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      environment_type: input.environment_type,
      description: input.description?.trim() || null,
      active: input.active ?? true,
    })
    .eq('id', id)

  throwIfError(error)
}