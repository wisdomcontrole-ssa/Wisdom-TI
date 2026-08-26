import { supabase } from '../lib/supabase'
import type { AssetRecord } from '../types/assets'
import type {
  AgentDeviceRecord,
  AgentDivergenceRecord,
  AgentEnrollmentResponse,
  AgentInventorySnapshotRecord,
  AlertStatus,
  InventoryExpectationRecord,
  SystemAlertRecord,
} from '../types/agent'

function client() {
  if (!supabase) throw new Error('Supabase não está configurado.')
  return supabase
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function listSystemAlerts() {
  const { data, error } = await client()
    .from('system_alerts')
    .select('id, source, agent_id, asset_id, divergence_id, category, severity, status, title, description, detected_at, last_seen_at, acknowledged_by, acknowledged_at, acknowledge_note, resolved_by, resolved_at, resolution_note, metadata, created_at, updated_at')
    .order('detected_at', { ascending: false })
    .limit(1000)
  throwIfError(error)
  return (data ?? []) as SystemAlertRecord[]
}

export async function updateSystemAlertStatus(
  alertId: string,
  status: AlertStatus,
  note: string,
) {
  const { data, error } = await client().rpc('update_system_alert_status', {
    p_alert_id: alertId,
    p_status: status,
    p_note: note.trim() || null,
  })
  throwIfError(error)
  return data as SystemAlertRecord
}

export async function listAssetAgents(assetId: string) {
  const { data, error } = await client()
    .from('agent_devices')
    .select('id, asset_id, label, status, token_prefix, machine_guid, hostname, agent_version, protocol_version, last_seen_at, last_inventory_at, created_at, updated_at, revoked_at, revoke_reason')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as AgentDeviceRecord[]
}

export async function getLatestAssetSnapshot(assetId: string) {
  const { data, error } = await client()
    .from('agent_inventory_snapshots')
    .select('id, agent_id, asset_id, protocol_version, agent_version, collected_at, received_at, hostname, manufacturer, model, serial_number, os_name, os_version, os_build, os_architecture, last_boot_at, cpu_name, cpu_cores, logical_processors, ram_bytes, disks, software, health')
    .eq('asset_id', assetId)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  throwIfError(error)
  return data as AgentInventorySnapshotRecord | null
}

export async function listAssetOpenDivergences(assetId: string) {
  const { data, error } = await client()
    .from('agent_divergences')
    .select('id, agent_id, asset_id, snapshot_id, kind, divergence_key, severity, title, expected, actual, status, first_detected_at, last_detected_at, resolved_at')
    .eq('asset_id', assetId)
    .eq('status', 'open')
    .order('last_detected_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as AgentDivergenceRecord[]
}

export async function getInventoryExpectation(assetId: string) {
  const { data, error } = await client()
    .from('agent_inventory_expectations')
    .select('asset_id, expected_hostname, expected_manufacturer, expected_model, expected_serial_number, expected_os_name, expected_cpu_name, expected_ram_bytes, min_free_system_disk_bytes, required_software, updated_at')
    .eq('asset_id', assetId)
    .maybeSingle()
  throwIfError(error)
  return data as InventoryExpectationRecord | null
}

async function invokeAgentAdmin(body: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke('agent-admin', { body })
  throwIfError(error)
  const payload = data as { ok?: boolean; error?: string } & Partial<AgentEnrollmentResponse>
  if (!payload?.ok) throw new Error(payload?.error ?? 'Operação do agente recusada.')
  return payload
}

export async function createAgentEnrollment(assetId: string) {
  return (await invokeAgentAdmin({ action: 'create', asset_id: assetId })) as AgentEnrollmentResponse
}

export async function rotateAgentToken(agentId: string) {
  return (await invokeAgentAdmin({ action: 'rotate', agent_id: agentId })) as AgentEnrollmentResponse
}

export async function revokeAgent(agentId: string, reason: string) {
  return invokeAgentAdmin({ action: 'revoke', agent_id: agentId, reason: reason.trim() })
}

export async function adoptDetectedInventory(
  asset: AssetRecord,
  snapshot: AgentInventorySnapshotRecord,
  expectation: InventoryExpectationRecord | null,
) {
  const { data, error } = await client().rpc('set_asset_inventory_expectation', {
    p_asset_id: asset.id,
    p_expected_hostname: snapshot.hostname ?? asset.hostname,
    p_expected_manufacturer: snapshot.manufacturer ?? asset.manufacturer,
    p_expected_model: snapshot.model ?? asset.model,
    p_expected_serial_number: snapshot.serial_number ?? asset.serial_number,
    p_expected_os_name: snapshot.os_name ?? asset.os_name,
    p_expected_cpu_name: snapshot.cpu_name,
    p_expected_ram_bytes: snapshot.ram_bytes,
    p_min_free_system_disk_bytes: expectation?.min_free_system_disk_bytes ?? 10737418240,
    p_required_software: expectation?.required_software ?? [],
  })
  throwIfError(error)
  return data as InventoryExpectationRecord
}
