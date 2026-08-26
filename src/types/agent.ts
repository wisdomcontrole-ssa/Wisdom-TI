export type AgentStatus = 'active' | 'revoked'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'

export interface AgentDeviceRecord {
  id: string
  asset_id: string
  label: string | null
  status: AgentStatus
  token_prefix: string
  machine_guid: string | null
  hostname: string | null
  agent_version: string | null
  protocol_version: string | null
  last_seen_at: string | null
  last_inventory_at: string | null
  created_at: string
  updated_at: string
  revoked_at: string | null
  revoke_reason: string | null
}

export interface AgentInventorySnapshotRecord {
  id: string
  agent_id: string
  asset_id: string
  protocol_version: string
  agent_version: string
  collected_at: string
  received_at: string
  hostname: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  os_name: string | null
  os_version: string | null
  os_build: string | null
  os_architecture: string | null
  last_boot_at: string | null
  cpu_name: string | null
  cpu_cores: number | null
  logical_processors: number | null
  ram_bytes: number | null
  disks: Array<{
    device_id?: string
    label?: string
    size_bytes?: number
    free_bytes?: number
    system_drive?: boolean
  }>
  software: Array<{
    name?: string
    version?: string
    publisher?: string
  }>
  health: Record<string, unknown>
}

export interface AgentDivergenceRecord {
  id: string
  agent_id: string
  asset_id: string
  snapshot_id: string
  kind: 'identity' | 'hardware' | 'software' | 'health'
  divergence_key: string
  severity: AlertSeverity
  title: string
  expected: unknown
  actual: unknown
  status: 'open' | 'resolved'
  first_detected_at: string
  last_detected_at: string
  resolved_at: string | null
}

export interface InventoryExpectationRecord {
  asset_id: string
  expected_hostname: string | null
  expected_manufacturer: string | null
  expected_model: string | null
  expected_serial_number: string | null
  expected_os_name: string | null
  expected_cpu_name: string | null
  expected_ram_bytes: number | null
  min_free_system_disk_bytes: number
  required_software: string[]
  updated_at: string
}

export interface SystemAlertRecord {
  id: string
  source: 'agent' | 'system'
  agent_id: string | null
  asset_id: string | null
  divergence_id: string | null
  category: 'connectivity' | 'identity' | 'hardware' | 'software' | 'health'
  severity: AlertSeverity
  status: AlertStatus
  title: string
  description: string
  detected_at: string
  last_seen_at: string
  acknowledged_by: string | null
  acknowledged_at: string | null
  acknowledge_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentEnrollmentResponse {
  ok: boolean
  agent_id: string
  asset_id: string
  token: string
  token_prefix: string
}
