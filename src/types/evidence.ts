export type EvidenceStatus =
  | 'active'
  | 'revoked'

export type EvidenceCaptureMethod =
  | 'camera'
  | 'gallery'
  | 'file'
  | 'system'

export type EvidenceCategoryCode =
  | 'registration'
  | 'audit'
  | 'movement'
  | 'maintenance'
  | 'disposal'
  | 'stock'
  | 'other'

export interface EvidenceRecord {
  id: string
  category_code: EvidenceCategoryCode
  asset_id: string | null
  audit_id: string | null
  audit_item_id: string | null
  stock_unit_id: string | null
  original_name: string
  stored_name: string
  mime_type: string
  byte_size: number
  sha256: string
  drive_file_id: string
  drive_folder_id: string
  capture_method: EvidenceCaptureMethod
  caption: string | null
  captured_at: string | null
  uploaded_by: string
  status: EvidenceStatus
  created_at: string
  revoked_at: string | null
  revoked_by: string | null
  revoke_reason: string | null
  metadata: Record<string, unknown> | null
}

export interface EvidenceContext {
  assetId?: string | null
  auditId?: string | null
  auditItemId?: string | null
  stockUnitId?: string | null
}

export interface UploadEvidenceInput {
  context: EvidenceContext
  file: File
  categoryCode: EvidenceCategoryCode
  captureMethod: EvidenceCaptureMethod
  caption?: string
  capturedAt?: string
}
