import { supabase } from '../lib/supabase'
import type {
  MaintenancePriority,
} from '../types/maintenance'

export type MaintenanceRequestStatus =
  | 'submitted'
  | 'received'
  | 'waiting_asset'
  | 'converted'
  | 'resolved'
  | 'cancelled'

export type MaintenanceIdentifierKind =
  | 'wisdom'
  | 'patrimony'
  | 'serial'
  | 'other'
  | 'unknown'

export interface MaintenanceRequestRecord {
  id: string
  request_code: string
  status: MaintenanceRequestStatus
  requester_name: string
  requester_contact: string
  origin_organization: string | null
  origin_unit: string | null
  origin_environment: string | null
  equipment_items: string[]
  received_items: string[]
  identifier_kind: MaintenanceIdentifierKind
  known_identifier: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  problem_category: string
  answers: Record<string, string>
  self_service_checks: string[]
  self_service_completed: boolean
  summary_text: string
  requester_notes: string | null
  triage_flow_version: number
  triage_snapshot: Record<string, unknown>
  asset_id: string | null
  maintenance_id: string | null
  submitted_at: string
  received_at: string | null
  received_by: string | null
  converted_at: string | null
  converted_by: string | null
  created_at: string
  updated_at: string
}

function client() {
  if (!supabase) {
    throw new Error(
      'Supabase não está configurado.',
    )
  }

  return supabase
}

function throwIfError(
  error: { message: string } | null,
) {
  if (error) {
    throw new Error(error.message)
  }
}

const requestSelect =
  'id, request_code, status, requester_name, requester_contact, origin_organization, origin_unit, origin_environment, equipment_items, received_items, identifier_kind, known_identifier, manufacturer, model, serial_number, problem_category, answers, self_service_checks, self_service_completed, summary_text, requester_notes, triage_flow_version, triage_snapshot, asset_id, maintenance_id, submitted_at, received_at, received_by, converted_at, converted_by, created_at, updated_at'

export async function createPublicMaintenanceRequest(
  input: {
    requesterName: string
    requesterContact: string
    originOrganization?: string
    originUnit: string
    originEnvironment?: string
    equipmentItems: string[]
    identifierKind: MaintenanceIdentifierKind
    knownIdentifier?: string
    manufacturer?: string
    model?: string
    serialNumber?: string
    problemCategory: string
    answers: Record<string, string>
    completedChecks: string[]
    summaryText: string
    requesterNotes?: string
    triageFlowVersion: number
    formElapsedMs: number
    website?: string
  },
) {
  const { data, error } = await client().rpc(
    'create_public_maintenance_request',
    {
      p_payload: {
        requester_name:
          input.requesterName.trim(),
        requester_contact:
          input.requesterContact.trim(),
        origin_organization:
          input.originOrganization?.trim() ||
          null,
        origin_unit:
          input.originUnit.trim(),
        origin_environment:
          input.originEnvironment?.trim() ||
          null,
        equipment_items:
          input.equipmentItems,
        identifier_kind:
          input.identifierKind,
        known_identifier:
          input.knownIdentifier?.trim() ||
          null,
        manufacturer:
          input.manufacturer?.trim() || null,
        model:
          input.model?.trim() || null,
        serial_number:
          input.serialNumber?.trim() || null,
        problem_category:
          input.problemCategory,
        answers: input.answers,
        self_service_checks:
          input.completedChecks,
        self_service_completed: true,
        summary_text:
          input.summaryText.trim(),
        requester_notes:
          input.requesterNotes?.trim() ||
          null,
        triage_flow_version:
          input.triageFlowVersion,
        form_elapsed_ms:
          Math.max(0, input.formElapsedMs),
        website: input.website ?? '',
      },
    },
  )

  throwIfError(error)

  const result = data as {
    request_id?: string
    request_code?: string
    status?: MaintenanceRequestStatus
    asset_recognized?: boolean
  }

  if (
    !result?.request_id ||
    !result?.request_code
  ) {
    throw new Error(
      'O chamado foi enviado sem protocolo.',
    )
  }

  return {
    requestId: result.request_id,
    requestCode: result.request_code,
    status:
      result.status ?? 'submitted',
    assetRecognized:
      Boolean(result.asset_recognized),
  }
}

export async function listMaintenanceRequests() {
  const { data, error } = await client()
    .from('maintenance_requests')
    .select(requestSelect)
    .order('submitted_at', {
      ascending: false,
    })
    .limit(1000)

  throwIfError(error)

  return (data ??
    []) as MaintenanceRequestRecord[]
}

export async function receiveMaintenanceRequest(
  requestId: string,
  receivedItems: string[],
) {
  const { data, error } = await client().rpc(
    'receive_maintenance_request',
    {
      p_request_id: requestId,
      p_received_items:
        receivedItems,
    },
  )

  throwIfError(error)
  return data as MaintenanceRequestRecord
}

export async function linkMaintenanceRequestAsset(
  requestId: string,
  assetId: string,
) {
  const { data, error } = await client().rpc(
    'link_maintenance_request_asset',
    {
      p_request_id: requestId,
      p_asset_id: assetId,
    },
  )

  throwIfError(error)
  return data as MaintenanceRequestRecord
}

export async function convertMaintenanceRequest(
  requestId: string,
  priority: MaintenancePriority,
) {
  const { data, error } = await client().rpc(
    'convert_maintenance_request',
    {
      p_request_id: requestId,
      p_priority: priority,
      p_assign_to_me: true,
    },
  )

  throwIfError(error)

  const result = data as {
    maintenance_id?: string
    maintenance_code?: string
  }

  if (!result?.maintenance_id) {
    throw new Error(
      'A ordem de manutenção não foi criada.',
    )
  }

  return {
    maintenanceId:
      result.maintenance_id,
    maintenanceCode:
      result.maintenance_code ?? '',
  }
}