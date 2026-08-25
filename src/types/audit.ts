export type AuditStatus =
  | 'in_progress'
  | 'closed'
  | 'cancelled'

export type AuditItemResult =
  | 'pending'
  | 'found'
  | 'missing'
  | 'divergent'
  | 'extra'

export type AuditScanResult =
  | 'found'
  | 'divergent'
  | 'extra'
  | 'unknown_code'

export type AuditScanMethod =
  | 'qr'
  | 'manual'
  | 'file'

export interface AuditCycleRecord {
  id: string
  audit_code: string
  title: string
  unit_id: string
  environment_id: string | null
  status: AuditStatus
  notes: string | null
  started_at: string
  closed_at: string | null
  created_by: string | null
  closed_by: string | null
  created_at: string
  updated_at: string
}

export interface AuditItemRecord {
  id: string
  audit_id: string
  asset_id: string
  expected: boolean
  expected_unit_id: string | null
  expected_environment_id: string | null
  observed_unit_id: string | null
  observed_environment_id: string | null
  result: AuditItemResult
  last_scanned_at: string | null
  last_scanned_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AuditScanEventRecord {
  id: string
  audit_id: string
  asset_id: string | null
  scanned_value: string
  scan_method: AuditScanMethod
  result: AuditScanResult
  observed_unit_id: string | null
  observed_environment_id: string | null
  notes: string | null
  scanned_by: string | null
  scanned_at: string
}

export interface AuditScanResponse {
  result: AuditScanResult
  asset_id?: string
  asset_code: string
  known_asset: boolean
  expected?: boolean
}
