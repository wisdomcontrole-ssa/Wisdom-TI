export type EntryOrigin =
  | 'purchase'
  | 'donation'
  | 'used'
  | 'transfer'
  | 'other'

export type RegistrationState =
  | 'complete'
  | 'express_pending'

export type InventoryResolvedKind =
  | 'asset'
  | 'stock_unit'
  | 'unknown'

export interface InventoryResolvedItem {
  kind: InventoryResolvedKind
  id: string | null
  code: string
  short_code: string | null
  status: string | null
  display_name: string | null
  registration_state?: RegistrationState | null
  installed_asset_id?: string | null
}

export interface ExpressAssetRecord {
  id: string
  asset_code: string
  asset_type_id: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  hostname: string | null
  os_name: string | null
  status: string
  current_unit_id: string | null
  current_environment_id: string | null
  notes: string | null
  acquired_at: string | null
  registration_state: RegistrationState
  entry_origin: EntryOrigin | null
  created_at: string
  updated_at: string
}

export interface M12StockUnit {
  id: string
  stock_code: string
  short_code: string
  product_id: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  condition: string
  status: string
  current_unit_id: string | null
  current_environment_id: string | null
  installed_asset_id: string | null
  notes: string | null
}

export interface M12StockProduct {
  id: string
  code: string
  name: string
  category: string
  can_install: boolean
}

export interface M12GenericBinding {
  id: string
  asset_id: string
  stock_unit_id: string
  relation_type: string
  linked_at: string
  linked_by: string
  link_reason: string
  unlinked_at: string | null
  unlinked_by: string | null
  unlink_reason: string | null
}

export interface M12ClassicBinding {
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

export interface M12AssetLink {
  id: string
  parent_asset_id: string
  child_asset_id: string
  relation_type: string
  linked_at: string
  linked_by: string
  link_reason: string
  removed_at: string | null
  removed_by: string | null
  removal_reason: string | null
}

export interface AssetBindingView {
  key: string
  kind: 'stock' | 'asset'
  source: 'm12' | 'classic' | 'asset_link'
  itemId: string
  linkId: string
  relationType: string
  code: string
  shortCode: string | null
  name: string
  serial: string | null
}

export interface LabelAsset {
  kind: 'asset'
  id: string
  code: string
  shortCode: null
  typeName: string
  title: string
  serial: string | null
  status: string
}

export interface LabelStockUnit {
  kind: 'stock'
  id: string
  code: string
  shortCode: string
  typeName: string
  title: string
  serial: string | null
  status: string
}

export type LabelCatalogItem =
  | LabelAsset
  | LabelStockUnit
