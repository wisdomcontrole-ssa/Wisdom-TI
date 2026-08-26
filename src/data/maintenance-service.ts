import { supabase } from '../lib/supabase'
import type {
  AssetDisposalRecord,
  AssetLifecycleEventRecord,
  DisposalMethod,
  DisposalReasonCategory,
  MaintenanceEventRecord,
  MaintenanceOrderRecord,
  MaintenancePartAction,
  MaintenancePartRecord,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
} from '../types/maintenance'

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

function unwrapRpcRow<T>(data: T | T[]) {
  return Array.isArray(data) ? data[0] : data
}

const orderSelect =
  'id, maintenance_code, asset_id, maintenance_type, priority, status, symptom, diagnosis, action_taken, assigned_to, external_service, provider_name, provider_reference, labor_cost, external_cost, other_cost, total_cost, asset_status_before, result_asset_status, unit_id_snapshot, environment_id_snapshot, opened_at, opened_by, started_at, started_by, completed_at, completed_by, cancelled_at, cancelled_by, cancel_reason, notes, created_at, updated_at'

export async function listMaintenanceOrders(assetId?: string) {
  let query = client()
    .from('maintenance_orders')
    .select(orderSelect)
    .order('opened_at', { ascending: false })
    .limit(1000)

  if (assetId) {
    query = query.eq('asset_id', assetId)
  }

  const { data, error } = await query
  throwIfError(error)

  return (data ?? []) as MaintenanceOrderRecord[]
}

export async function getMaintenanceOrder(id: string) {
  const { data, error } = await client()
    .from('maintenance_orders')
    .select(orderSelect)
    .eq('id', id)
    .single()

  throwIfError(error)
  return data as MaintenanceOrderRecord
}

export async function listMaintenanceParts(maintenanceId: string) {
  const { data, error } = await client()
    .from('maintenance_parts')
    .select(
      'id, maintenance_id, stock_unit_id, action, description, quantity, unit_cost, created_by, created_at, removed_at, removed_by, remove_reason',
    )
    .eq('maintenance_id', maintenanceId)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return (data ?? []) as MaintenancePartRecord[]
}

export async function listMaintenanceEvents(maintenanceId: string) {
  const { data, error } = await client()
    .from('maintenance_events')
    .select(
      'id, maintenance_id, event_type, reason, previous_data, new_data, actor_user_id, occurred_at',
    )
    .eq('maintenance_id', maintenanceId)
    .order('occurred_at', { ascending: false })

  throwIfError(error)
  return (data ?? []) as MaintenanceEventRecord[]
}

export async function listAssetLifecycleEvents(assetId: string) {
  const { data, error } = await client()
    .from('asset_lifecycle_events')
    .select(
      'id, asset_id, event_type, from_status, to_status, reference_type, reference_id, reason, actor_user_id, metadata, occurred_at',
    )
    .eq('asset_id', assetId)
    .order('occurred_at', { ascending: false })
    .limit(200)

  throwIfError(error)
  return (data ?? []) as AssetLifecycleEventRecord[]
}

export async function getAssetDisposal(assetId: string) {
  const { data, error } = await client()
    .from('asset_disposals')
    .select(
      'id, disposal_code, asset_id, reason_category, disposal_method, reason, destination, residual_value, previous_status, unit_id_snapshot, environment_id_snapshot, disposed_at, disposed_by, notes, created_at',
    )
    .eq('asset_id', assetId)
    .maybeSingle()

  throwIfError(error)
  return (data ?? null) as AssetDisposalRecord | null
}

export interface CreateMaintenanceOrderInput {
  assetId: string
  maintenanceType: MaintenanceType
  priority: MaintenancePriority
  symptom: string
  assignedTo?: string | null
  externalService?: boolean
  providerName?: string
  providerReference?: string
  notes?: string
}

export async function createMaintenanceOrder(
  input: CreateMaintenanceOrderInput,
) {
  const { data, error } = await client().rpc(
    'create_maintenance_order',
    {
      p_asset_id: input.assetId,
      p_maintenance_type: input.maintenanceType,
      p_priority: input.priority,
      p_symptom: input.symptom.trim(),
      p_assigned_to: input.assignedTo ?? null,
      p_external_service: input.externalService ?? false,
      p_provider_name: input.providerName?.trim() || null,
      p_provider_reference:
        input.providerReference?.trim() || null,
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)

  const row = unwrapRpcRow(data as Record<string, unknown> | Record<string, unknown>[])

  if (!row?.maintenance_id) {
    throw new Error('A manutenção foi criada sem retorno de identificação.')
  }

  return row as {
    maintenance_id: string
    maintenance_code: string
    status: MaintenanceStatus
  }
}

export interface UpdateMaintenanceOrderInput {
  maintenanceId: string
  status: Extract<
    MaintenanceStatus,
    'open' | 'in_progress' | 'waiting_parts' | 'external'
  >
  priority: MaintenancePriority
  symptom: string
  diagnosis?: string
  actionTaken?: string
  assignedTo?: string | null
  externalService?: boolean
  providerName?: string
  providerReference?: string
  laborCost?: number
  externalCost?: number
  otherCost?: number
  notes?: string
  reason?: string
}

export async function updateMaintenanceOrder(
  input: UpdateMaintenanceOrderInput,
) {
  const { data, error } = await client().rpc(
    'update_maintenance_order',
    {
      p_maintenance_id: input.maintenanceId,
      p_status: input.status,
      p_priority: input.priority,
      p_symptom: input.symptom.trim(),
      p_diagnosis: input.diagnosis?.trim() || null,
      p_action_taken: input.actionTaken?.trim() || null,
      p_assigned_to: input.assignedTo ?? null,
      p_external_service: input.externalService ?? false,
      p_provider_name: input.providerName?.trim() || null,
      p_provider_reference:
        input.providerReference?.trim() || null,
      p_labor_cost: input.laborCost ?? 0,
      p_external_cost: input.externalCost ?? 0,
      p_other_cost: input.otherCost ?? 0,
      p_notes: input.notes?.trim() || null,
      p_reason:
        input.reason?.trim() || 'Atualização da manutenção.',
    },
  )

  throwIfError(error)
  return unwrapRpcRow(data as MaintenanceOrderRecord | MaintenanceOrderRecord[]) as MaintenanceOrderRecord
}

export async function addMaintenancePart(input: {
  maintenanceId: string
  action: MaintenancePartAction
  description: string
  stockUnitId?: string | null
  quantity?: number
  unitCost?: number
}) {
  const { data, error } = await client().rpc(
    'add_maintenance_part',
    {
      p_maintenance_id: input.maintenanceId,
      p_action: input.action,
      p_description: input.description.trim(),
      p_stock_unit_id: input.stockUnitId ?? null,
      p_quantity: input.quantity ?? 1,
      p_unit_cost: input.unitCost ?? 0,
    },
  )

  throwIfError(error)
  return unwrapRpcRow(data as MaintenancePartRecord | MaintenancePartRecord[]) as MaintenancePartRecord
}

export async function removeMaintenancePart(
  maintenancePartId: string,
  reason: string,
) {
  const { data, error } = await client().rpc(
    'remove_maintenance_part',
    {
      p_maintenance_part_id: maintenancePartId,
      p_reason: reason.trim(),
    },
  )

  throwIfError(error)
  return unwrapRpcRow(data as MaintenancePartRecord | MaintenancePartRecord[]) as MaintenancePartRecord
}

export async function completeMaintenanceOrder(input: {
  maintenanceId: string
  actionTaken: string
  resultAssetStatus: 'active' | 'stock' | 'retired'
  diagnosis?: string
  notes?: string
}) {
  const { data, error } = await client().rpc(
    'complete_maintenance_order',
    {
      p_maintenance_id: input.maintenanceId,
      p_action_taken: input.actionTaken.trim(),
      p_result_asset_status: input.resultAssetStatus,
      p_diagnosis: input.diagnosis?.trim() || null,
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)
  return unwrapRpcRow(data as MaintenanceOrderRecord | MaintenanceOrderRecord[]) as MaintenanceOrderRecord
}

export async function cancelMaintenanceOrder(
  maintenanceId: string,
  reason: string,
) {
  const { data, error } = await client().rpc(
    'cancel_maintenance_order',
    {
      p_maintenance_id: maintenanceId,
      p_reason: reason.trim(),
    },
  )

  throwIfError(error)
  return unwrapRpcRow(data as MaintenanceOrderRecord | MaintenanceOrderRecord[]) as MaintenanceOrderRecord
}

export async function retireAsset(assetId: string, reason: string) {
  const { data, error } = await client().rpc('retire_asset', {
    p_asset_id: assetId,
    p_reason: reason.trim(),
  })

  throwIfError(error)
  return data
}

export async function disposeAsset(input: {
  assetId: string
  reasonCategory: DisposalReasonCategory
  disposalMethod: DisposalMethod
  reason: string
  destination?: string
  residualValue?: number | null
  notes?: string
}) {
  const { data, error } = await client().rpc('dispose_asset', {
    p_asset_id: input.assetId,
    p_reason_category: input.reasonCategory,
    p_disposal_method: input.disposalMethod,
    p_reason: input.reason.trim(),
    p_destination: input.destination?.trim() || null,
    p_residual_value: input.residualValue ?? null,
    p_notes: input.notes?.trim() || null,
  })

  throwIfError(error)
  return data
}