export type MaintenanceType =
  | 'corrective'
  | 'preventive'
  | 'inspection'
  | 'upgrade'

export type MaintenancePriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'critical'

export type MaintenanceStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_parts'
  | 'external'
  | 'completed'
  | 'cancelled'

export type MaintenancePartAction =
  | 'installed'
  | 'removed'
  | 'consumed'
  | 'replaced'
  | 'other'

export type LifecycleEventType =
  | 'maintenance_opened'
  | 'maintenance_completed'
  | 'maintenance_cancelled'
  | 'retired'
  | 'disposed'

export type DisposalReasonCategory =
  | 'damage'
  | 'obsolete'
  | 'unrepairable'
  | 'lost'
  | 'donation'
  | 'sale'
  | 'recycling'
  | 'other'

export type DisposalMethod =
  | 'recycling'
  | 'donation'
  | 'sale'
  | 'destruction'
  | 'return'
  | 'other'

export interface MaintenanceOrderRecord {
  id: string
  maintenance_code: string
  asset_id: string
  maintenance_type: MaintenanceType
  priority: MaintenancePriority
  status: MaintenanceStatus
  symptom: string
  diagnosis: string | null
  action_taken: string | null
  assigned_to: string | null
  external_service: boolean
  provider_name: string | null
  provider_reference: string | null
  labor_cost: number
  external_cost: number
  other_cost: number
  total_cost: number
  asset_status_before: string
  result_asset_status: string | null
  unit_id_snapshot: string | null
  environment_id_snapshot: string | null
  opened_at: string
  opened_by: string
  started_at: string | null
  started_by: string | null
  completed_at: string | null
  completed_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MaintenancePartRecord {
  id: string
  maintenance_id: string
  stock_unit_id: string | null
  action: MaintenancePartAction
  description: string
  quantity: number
  unit_cost: number
  created_by: string
  created_at: string
  removed_at: string | null
  removed_by: string | null
  remove_reason: string | null
}

export interface MaintenanceEventRecord {
  id: string
  maintenance_id: string
  event_type:
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'part_added'
    | 'part_removed'
    | 'completed'
    | 'cancelled'
  reason: string | null
  previous_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  actor_user_id: string
  occurred_at: string
}

export interface AssetLifecycleEventRecord {
  id: string
  asset_id: string
  event_type: LifecycleEventType
  from_status: string | null
  to_status: string | null
  reference_type: string | null
  reference_id: string | null
  reason: string
  actor_user_id: string
  metadata: Record<string, unknown>
  occurred_at: string
}

export interface AssetDisposalRecord {
  id: string
  disposal_code: string
  asset_id: string
  reason_category: DisposalReasonCategory
  disposal_method: DisposalMethod
  reason: string
  destination: string | null
  residual_value: number | null
  previous_status: string
  unit_id_snapshot: string | null
  environment_id_snapshot: string | null
  disposed_at: string
  disposed_by: string
  notes: string | null
  created_at: string
}