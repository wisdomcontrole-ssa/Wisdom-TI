export type AgentStatus =
  | 'active'
  | 'revoked'

export type AlertSeverity =
  | 'info'
  | 'warning'
  | 'critical'

export type AlertStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved'

export type AgentCommandType =
  | 'collect_inventory'
  | 'collect_diagnostics'
  | 'sfc_verify'
  | 'sfc_scannow'
  | 'dism_scanhealth'
  | 'dism_restorehealth'
  | 'flush_dns'
  | 'cleanup_temp'
  | 'optimize_system_drive'
  | 'uninstall_software'

export type AgentCommandStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

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

export interface AgentMemoryModule {
  bank?: string
  slot?: string
  manufacturer?: string
  part_number?: string
  serial_number?: string
  capacity_bytes?: number
  speed_mhz?: number
  configured_speed_mhz?: number
  memory_type?: string
}

export interface AgentPhysicalDisk {
  friendly_name?: string
  model?: string
  serial_number?: string
  media_type?: string
  bus_type?: string
  health_status?: string
  operational_status?: string
  size_bytes?: number
  temperature_c?: number
  wear_percent?: number
  read_errors_total?: number
  write_errors_total?: number
  power_on_hours?: number
}

export interface AgentNetworkAdapter {
  name?: string
  product_name?: string
  manufacturer?: string
  mac_address?: string
  connection_id?: string
  speed_bps?: number
  status?: string
  is_wifi?: boolean
}

export interface AgentDiagnostics {
  unexpected_shutdowns_7d?: number
  bugchecks_7d?: number
  whea_errors_7d?: number
  memory_diagnostic_errors_30d?: number
  application_crashes_7d?: number
  system_drive_free_percent?: number
  uptime_hours?: number
  pending_reboot?: boolean
}

export interface AgentHealthPayload {
  collector?: string
  motherboard?: {
    manufacturer?: string
    model?: string
    serial_number?: string
  }
  memory_modules?: AgentMemoryModule[]
  physical_disks?: AgentPhysicalDisk[]
  network_adapters?: AgentNetworkAdapter[]
  diagnostics?: AgentDiagnostics
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
    uninstall_id?: string
    uninstall_scope?:
      | 'machine'
      | 'user'
    uninstall_method?:
      | 'msi'
      | 'quiet'
    uninstall_eligible?: boolean
  }>
  health: AgentHealthPayload
}

export interface AgentDivergenceRecord {
  id: string
  agent_id: string
  asset_id: string
  snapshot_id: string
  kind:
    | 'identity'
    | 'hardware'
    | 'software'
    | 'health'
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
  category:
    | 'connectivity'
    | 'identity'
    | 'hardware'
    | 'software'
    | 'health'
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

export interface AgentActivationResponse {
  activation_id: string
  activation_code: string
  expires_at: string
  asset_id: string
  asset_code: string
}

export interface AgentCommandRecord {
  id: string
  agent_id: string
  asset_id: string
  maintenance_id: string | null
  command_type: AgentCommandType
  status: AgentCommandStatus
  parameters: Record<string, unknown>
  reason: string
  requested_by: string
  requested_at: string
  started_at: string | null
  completed_at: string | null
  attempt_count: number
  max_attempts: number
  result: {
    success?: boolean
    exit_code?: number
    summary?: string
    output?: string
    duration_ms?: number
  } | null
}

export interface AssetRemoteAccessRecord {
  asset_id: string
  provider: 'meshcentral'
  device_id: string | null
  connect_url: string | null
  active: boolean
  updated_at: string
}
