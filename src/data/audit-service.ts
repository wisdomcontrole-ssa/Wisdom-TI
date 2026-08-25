import { supabase } from '../lib/supabase'
import type {
  AuditCycleRecord,
  AuditItemRecord,
  AuditScanEventRecord,
  AuditScanMethod,
  AuditScanResponse,
} from '../types/audit'

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

export async function listAuditCycles() {
  const { data, error } = await client()
    .from('audit_cycles')
    .select(
      'id, audit_code, title, unit_id, environment_id, status, notes, started_at, closed_at, created_by, closed_by, created_at, updated_at',
    )
    .order('started_at', { ascending: false })
    .limit(500)

  throwIfError(error)

  return (data ?? []) as AuditCycleRecord[]
}

export async function getAuditCycle(id: string) {
  const { data, error } = await client()
    .from('audit_cycles')
    .select(
      'id, audit_code, title, unit_id, environment_id, status, notes, started_at, closed_at, created_by, closed_by, created_at, updated_at',
    )
    .eq('id', id)
    .single()

  throwIfError(error)

  return data as AuditCycleRecord
}

export async function listAuditItems(auditId: string) {
  const { data, error } = await client()
    .from('audit_items')
    .select(
      'id, audit_id, asset_id, expected, expected_unit_id, expected_environment_id, observed_unit_id, observed_environment_id, result, last_scanned_at, last_scanned_by, notes, created_at, updated_at',
    )
    .eq('audit_id', auditId)
    .order('created_at')

  throwIfError(error)

  return (data ?? []) as AuditItemRecord[]
}

export async function listAuditScanEvents(
  auditId: string,
) {
  const { data, error } = await client()
    .from('audit_scan_events')
    .select(
      'id, audit_id, asset_id, scanned_value, scan_method, result, observed_unit_id, observed_environment_id, notes, scanned_by, scanned_at',
    )
    .eq('audit_id', auditId)
    .order('scanned_at', { ascending: false })
    .limit(200)

  throwIfError(error)

  return (data ?? []) as AuditScanEventRecord[]
}

export async function createPhysicalAudit(input: {
  title: string
  unitId: string
  environmentId: string | null
  notes?: string
}) {
  const { data, error } = await client().rpc(
    'create_physical_audit',
    {
      p_title: input.title.trim(),
      p_unit_id: input.unitId,
      p_environment_id: input.environmentId,
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)

  return data as {
    audit_id: string
    audit_code: string
    expected_count: number
    status: 'in_progress'
  }
}

export async function registerAuditScan(input: {
  auditId: string
  scannedValue: string
  observedUnitId: string | null
  observedEnvironmentId: string | null
  scanMethod: AuditScanMethod
  notes?: string
}) {
  const { data, error } = await client().rpc(
    'register_audit_scan',
    {
      p_audit_id: input.auditId,
      p_scanned_value: input.scannedValue.trim(),
      p_observed_unit_id: input.observedUnitId,
      p_observed_environment_id:
        input.observedEnvironmentId,
      p_scan_method: input.scanMethod,
      p_notes: input.notes?.trim() || null,
    },
  )

  throwIfError(error)

  return data as AuditScanResponse
}

export async function updateAuditItemNote(
  auditItemId: string,
  notes: string,
) {
  const { error } = await client().rpc(
    'update_audit_item_note',
    {
      p_audit_item_id: auditItemId,
      p_notes: notes.trim(),
    },
  )

  throwIfError(error)
}

export async function closePhysicalAudit(
  auditId: string,
  notes?: string,
) {
  const { data, error } = await client().rpc(
    'close_physical_audit',
    {
      p_audit_id: auditId,
      p_notes: notes?.trim() || null,
    },
  )

  throwIfError(error)

  return data as {
    audit_id: string
    audit_code: string
    status: 'closed'
    found: number
    missing: number
    divergent: number
    extra: number
    unknown: number
  }
}

export async function cancelPhysicalAudit(
  auditId: string,
  reason: string,
) {
  const { error } = await client().rpc(
    'cancel_physical_audit',
    {
      p_audit_id: auditId,
      p_reason: reason.trim(),
    },
  )

  throwIfError(error)
}
