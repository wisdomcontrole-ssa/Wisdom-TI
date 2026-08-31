import { supabase } from '../lib/supabase'
import type {
  AssetExternalIdentifier,
  AssetSmartCore,
  AssetSmartProfile,
  AssetSmartSearchResult,
  ExternalIdentifierType,
  ExternalOrganization,
  OwnershipType,
  PurchaseDocument,
  PurchaseDocumentType,
} from '../types/asset-smart'

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

export async function listExternalOrganizations() {
  const { data, error } = await client()
    .from('external_organizations')
    .select(
      'id, name, acronym, city, state, country, notes, active',
    )
    .eq('active', true)
    .order('name')

  throwIfError(error)
  return (data ?? []) as ExternalOrganization[]
}

export async function ensureExternalOrganization(input: {
  name: string
  acronym?: string
  city?: string
  state?: string
  country?: string
  notes?: string
}) {
  const { data, error } = await client().rpc(
    'ensure_external_organization',
    {
      p_name: input.name.trim(),
      p_acronym: input.acronym?.trim() || null,
      p_city: input.city?.trim() || null,
      p_state: input.state?.trim() || null,
      p_country: input.country?.trim() || 'Brasil',
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)
  return String(data)
}

export async function setAssetSmartCore(input: {
  assetId: string
  productNumber?: string
  serviceTag?: string
  electricalRating?: string
  acquiredAt?: string
  warrantyExpiresAt?: string
  ownershipType: OwnershipType
  ownerOrganizationId?: string | null
}) {
  const { data, error } = await client().rpc(
    'set_asset_smart_core',
    {
      p_asset_id: input.assetId,
      p_product_number:
        input.productNumber?.trim() || null,
      p_service_tag:
        input.serviceTag?.trim() || null,
      p_electrical_rating:
        input.electricalRating?.trim() || null,
      p_acquired_at: input.acquiredAt || null,
      p_warranty_expires_at:
        input.warrantyExpiresAt || null,
      p_ownership_type: input.ownershipType,
      p_owner_organization_id:
        input.ownershipType === 'own'
          ? null
          : input.ownerOrganizationId ?? null,
    },
  )

  throwIfError(error)
  return data
}

export async function addAssetExternalIdentifier(input: {
  assetId: string
  organizationId: string
  identifierType: ExternalIdentifierType
  identifierValue: string
  notes?: string
}) {
  const { data, error } = await client().rpc(
    'add_asset_external_identifier',
    {
      p_asset_id: input.assetId,
      p_organization_id: input.organizationId,
      p_identifier_type: input.identifierType,
      p_identifier_value: input.identifierValue.trim(),
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)
  return String(data)
}

export async function retireAssetExternalIdentifier(
  identifierId: string,
  reason: string,
) {
  const { error } = await client().rpc(
    'retire_asset_external_identifier',
    {
      p_identifier_id: identifierId,
      p_reason: reason.trim(),
    },
  )

  throwIfError(error)
}

export async function addPurchaseDocumentToAsset(input: {
  assetId: string
  documentType: PurchaseDocumentType
  number: string
  series?: string
  accessKey?: string
  issuerName?: string
  issuerTaxId?: string
  issueDate?: string
  evidenceId?: string | null
  notes?: string
}) {
  const { data, error } = await client().rpc(
    'add_purchase_document_to_asset',
    {
      p_asset_id: input.assetId,
      p_document_type: input.documentType,
      p_number: input.number.trim(),
      p_series: input.series?.trim() || null,
      p_access_key: input.accessKey?.trim() || null,
      p_issuer_name: input.issuerName?.trim() || null,
      p_issuer_tax_id: input.issuerTaxId?.trim() || null,
      p_issue_date: input.issueDate || null,
      p_evidence_id: input.evidenceId ?? null,
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)
  return String(data)
}

export async function recordAssetLabelRead(input: {
  assetId: string
  evidenceId?: string | null
  rawText: string
  barcodes: string[]
  detectedData: Record<string, unknown>
  confidence: Record<string, unknown>
}) {
  const { data, error } = await client().rpc(
    'record_asset_label_read',
    {
      p_asset_id: input.assetId,
      p_evidence_id: input.evidenceId ?? null,
      p_engine: 'paddleocr',
      p_engine_version: 'PP-OCRv5',
      p_raw_text: input.rawText,
      p_barcode_values: input.barcodes,
      p_detected_data: input.detectedData,
      p_confidence: input.confidence,
    },
  )

  throwIfError(error)
  return String(data)
}

export async function searchSmartAssets(query: string) {
  const { data, error } = await client().rpc(
    'search_assets_smart',
    {
      p_query: query.trim(),
    },
  )

  throwIfError(error)
  return (data ?? []) as AssetSmartSearchResult[]
}

export async function getAssetSmartProfile(
  assetId: string,
): Promise<AssetSmartProfile> {
  const [
    coreResult,
    organizationsResult,
    identifiersResult,
    linksResult,
  ] = await Promise.all([
    client()
      .from('assets')
      .select(
        'id, asset_code, manufacturer, model, serial_number, product_number, service_tag, electrical_rating, acquired_at, warranty_expires_at, ownership_type, owner_organization_id',
      )
      .eq('id', assetId)
      .single(),
    client()
      .from('external_organizations')
      .select(
        'id, name, acronym, city, state, country, notes, active',
      )
      .eq('active', true)
      .order('name'),
    client()
      .from('asset_external_identifiers')
      .select(
        'id, asset_id, organization_id, identifier_type, identifier_value, notes, active, created_at',
      )
      .eq('asset_id', assetId)
      .eq('active', true)
      .order('created_at', { ascending: false }),
    client()
      .from('asset_purchase_documents')
      .select('purchase_document_id')
      .eq('asset_id', assetId)
      .is('unlinked_at', null),
  ])

  throwIfError(coreResult.error)
  throwIfError(organizationsResult.error)
  throwIfError(identifiersResult.error)
  throwIfError(linksResult.error)

  const organizations =
    (organizationsResult.data ?? []) as ExternalOrganization[]

  const organizationMap = new Map(
    organizations.map((item) => [item.id, item]),
  )

  const identifiers =
    ((identifiersResult.data ?? []) as AssetExternalIdentifier[])
      .map((item) => ({
        ...item,
        organization:
          organizationMap.get(item.organization_id),
      }))

  const documentIds = (linksResult.data ?? [])
    .map(
      (item) =>
        item.purchase_document_id as string,
    )
    .filter(Boolean)

  let purchaseDocuments: PurchaseDocument[] = []

  if (documentIds.length > 0) {
    const { data, error } = await client()
      .from('purchase_documents')
      .select(
        'id, document_type, number, series, access_key, issuer_name, issuer_tax_id, issue_date, evidence_id, notes, created_at',
      )
      .in('id', documentIds)
      .order('issue_date', { ascending: false })

    throwIfError(error)
    purchaseDocuments = (data ?? []) as PurchaseDocument[]
  }

  return {
    core: coreResult.data as AssetSmartCore,
    organizations,
    identifiers,
    purchaseDocuments,
  }
}
