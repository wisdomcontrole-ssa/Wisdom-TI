export type AssetStatus =
  | 'active'
  | 'stock'
  | 'maintenance'
  | 'retired'
  | 'disposed'

export interface AssetTypeRecord {
  id: string
  code: string
  name: string
  description: string | null
  active: boolean
}

export interface UnitRecord {
  id: string
  code: string
  name: string
  description: string | null
  address_text: string | null
  active: boolean
}

export interface EnvironmentRecord {
  id: string
  unit_id: string
  code: string
  name: string
  environment_type: string
  description: string | null
  active: boolean
}

export interface AssetRecord {
  id: string
  asset_code: string
  asset_type_id: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  hostname: string | null
  os_name: string | null
  status: AssetStatus
  current_unit_id: string | null
  current_environment_id: string | null
  notes: string | null
  acquired_at: string | null
  created_at: string
  updated_at: string
}

export interface AssetMovementRecord {
  id: string
  asset_id: string
  movement_type: string
  from_unit_id: string | null
  from_environment_id: string | null
  to_unit_id: string | null
  to_environment_id: string | null
  reason: string
  moved_by: string | null
  moved_at: string
}