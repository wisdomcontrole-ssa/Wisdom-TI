import type {
  AgentCommandType,
  AgentHealthPayload,
} from '../src/types/agent'

const commandTypes: AgentCommandType[] = [
  'collect_inventory',
  'collect_diagnostics',
  'sfc_verify',
  'sfc_scannow',
  'dism_scanhealth',
  'dism_restorehealth',
  'flush_dns',
  'cleanup_temp',
  'optimize_system_drive',
]

function assert(
  condition: unknown,
  message: string,
) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(
  commandTypes.length === 9,
  'Catálogo de comandos remotos incompleto.',
)

const health: AgentHealthPayload = {
  motherboard: {
    manufacturer: 'Login',
    model: 'LOG-A520 LN300',
  },
  memory_modules: [
    {
      capacity_bytes:
        8 * 1024 ** 3,
      memory_type: 'DDR4',
      configured_speed_mhz: 3200,
    },
    {
      capacity_bytes:
        8 * 1024 ** 3,
      memory_type: 'DDR4',
      configured_speed_mhz: 3200,
    },
  ],
  physical_disks: [
    {
      model: 'NVMe',
      size_bytes:
        256 * 1024 ** 3,
      media_type: 'SSD',
      bus_type: 'NVMe',
      health_status: 'Healthy',
    },
  ],
  diagnostics: {
    unexpected_shutdowns_7d: 0,
    bugchecks_7d: 0,
    whea_errors_7d: 0,
    memory_diagnostic_errors_30d: 0,
    system_drive_free_percent: 40,
  },
}

assert(
  health.memory_modules?.length === 2,
  'Inventário precisa suportar módulos de memória individuais.',
)

assert(
  health.physical_disks?.[0]
    ?.bus_type === 'NVMe',
  'Inventário precisa suportar tipo/interface do disco.',
)

console.log(
  'OK: M16A tipos de inventario profundo e catalogo de acoes remotas validados.',
)