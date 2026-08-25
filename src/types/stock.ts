export type StockCondition =
  | 'new'
  | 'used'
  | 'refurbished'
  | 'damaged'

export type StockStatus =
  | 'in_stock'
  | 'reserved'
  | 'installed'
  | 'maintenance'
  | 'disposed'

export interface StockProductRecord {
  id: string
  code: string
  name: string
  category: string
  track_serial: boolean
  can_install: boolean
  active: boolean
  description: string | null
}

export interface StockUnitRecord {
  id: string
  stock_code: string
  product_id: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  condition: StockCondition
  status: StockStatus
  specs: Record<string, unknown>
  current_unit_id: string | null
  current_environment_id: string | null
  installed_asset_id: string | null
  supplier_name: string | null
  purchase_reference: string | null
  acquired_at: string | null
  warranty_until: string | null
  cost_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StockMovementRecord {
  id: string
  stock_unit_id: string
  movement_type: string
  from_status: string | null
  to_status: string | null
  from_unit_id: string | null
  from_environment_id: string | null
  to_unit_id: string | null
  to_environment_id: string | null
  from_asset_id: string | null
  to_asset_id: string | null
  reason: string
  actor_user_id: string | null
  occurred_at: string
}

export interface AssetComponentRecord {
  id: string
  asset_id: string
  stock_unit_id: string
  installed_at: string
  installed_by: string | null
  install_reason: string
  removed_at: string | null
  removed_by: string | null
  removal_reason: string | null
}
