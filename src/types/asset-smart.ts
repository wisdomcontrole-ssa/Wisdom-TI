export type OwnershipType =
  | 'own'
  | 'ceded'
  | 'loaned'
  | 'commodatum'
  | 'leased'
  | 'third_party'
  | 'other'

export type ExternalIdentifierType =
  | 'patrimony'
  | 'tombamento'
  | 'internal_serial'
  | 'contract'
  | 'other'

export type PurchaseDocumentType =
  | 'invoice'
  | 'receipt'
  | 'term'
  | 'other'

export interface ExternalOrganization {
  id: string
  name: string
  acronym: string | null
  city: string | null
  state: string | null
  country: string
  notes: string | null
  active: boolean
}

export interface AssetSmartCore {
  id: string
  asset_code: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  product_number: string | null
  service_tag: string | null
  electrical_rating: string | null
  acquired_at: string | null
  warranty_expires_at: string | null
  ownership_type: OwnershipType
  owner_organization_id: string | null
}

export interface AssetExternalIdentifier {
  id: string
  asset_id: string
  organization_id: string
  identifier_type: ExternalIdentifierType
  identifier_value: string
  notes: string | null
  active: boolean
  created_at: string
  organization?: ExternalOrganization
}

export interface PurchaseDocument {
  id: string
  document_type: PurchaseDocumentType
  number: string
  series: string | null
  access_key: string | null
  issuer_name: string | null
  issuer_tax_id: string | null
  issue_date: string | null
  evidence_id: string | null
  notes: string | null
  created_at: string
}

export interface AssetSmartProfile {
  core: AssetSmartCore
  organizations: ExternalOrganization[]
  identifiers: AssetExternalIdentifier[]
  purchaseDocuments: PurchaseDocument[]
}

export interface AssetSmartSearchResult {
  id: string
  asset_code: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  service_tag: string | null
  product_number: string | null
  ownership_type: OwnershipType
  external_identifiers: Array<{
    value: string
    type: string
    organization: string
  }>
  purchase_documents: Array<{
    number: string
    series: string | null
    access_key: string | null
    issuer_name: string | null
  }>
}

export type SuggestionConfidence =
  | 'high'
  | 'medium'
  | 'low'

export interface LabelSuggestion {
  value: string
  score: number
  confidence: SuggestionConfidence
  source: string
  requiresReview: boolean
}

export interface AssetLabelAnalysis {
  engine: 'paddleocr'
  engineVersion: 'PP-OCRv5'
  rawText: string
  barcodes: string[]
  fields: {
    manufacturer?: LabelSuggestion
    model?: LabelSuggestion
    serialNumber?: LabelSuggestion
    serviceTag?: LabelSuggestion
    productNumber?: LabelSuggestion
    electricalRating?: LabelSuggestion
  }
  metrics?: {
    totalMs?: number
    detectedBoxes?: number
    recognizedCount?: number
  }
}

export interface ReviewedLabelData {
  manufacturer: string
  model: string
  serialNumber: string
  serviceTag: string
  productNumber: string
  electricalRating: string
}
