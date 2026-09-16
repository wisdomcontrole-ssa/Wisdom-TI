import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8',
  )
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const publicSupport = read(
  'src/pages/PublicSupportPage.tsx',
)
const maintenance = read(
  'src/pages/MaintenancePage.tsx',
)
const requestService = read(
  'src/data/maintenance-request-service.ts',
)
const agentTypes = read(
  'src/types/agent.ts',
)
const panel = read(
  'src/components/agents/AssetAgentPanel.tsx',
)
const program = read(
  'agent/InventarioTI.Agent/Program.cs',
)
const commands = read(
  'agent/InventarioTI.Agent/RemoteCommandExecutor.cs',
)
const migration = read(
  'supabase/migrations/20260916183000_m16b_support_integrated.sql',
)
const ocrMigration = read(
  'supabase/migrations/20260916083000_ocr_intelligence.sql',
)

assert(
  !publicSupport.includes(
    'Código interno Wisdom',
  ),
  'Portal ainda exibe nomenclatura institucional no código.',
)

assert(
  publicSupport.includes(
    'Código interno do patrimônio',
  ),
  'Opção neutra de identificação ausente.',
)

assert(
  publicSupport.includes(
    'requesterEmail',
  ) &&
    publicSupport.includes(
      'requesterWhatsapp',
    ),
  'Campos estruturados de contato ausentes.',
)

assert(
  maintenance.includes(
    'Unidade:',
  ) &&
    maintenance.includes(
      'Responsável:',
    ),
  'Lista de manutenção sem unidade/responsável.',
)

assert(
  requestService.includes(
    'requester_email',
  ) &&
    requestService.includes(
      'requester_whatsapp',
    ),
  'Serviço de chamados sem contatos estruturados.',
)

assert(
  agentTypes.includes(
    "'uninstall_software'",
  ),
  'Tipo de comando uninstall_software ausente.',
)

assert(
  panel.includes(
    'Desinstalar',
  ) &&
    panel.includes(
      'Acesso remoto',
    ),
  'Painel do agente sem desinstalação/acesso remoto.',
)

assert(
  program.includes(
    'AgentVersion = "2.0.1"',
  ),
  'Agente não está em 2.0.1.',
)

assert(
  program.includes(
    'new Semaphore',
  ) &&
    !program.includes(
      'new Mutex',
    ),
  'Correção de sincronização do agente não aplicada.',
)

assert(
  commands.includes(
    '"uninstall_software"',
  ) &&
    commands.includes(
      'BlockedExecutables',
    ),
  'Executor seguro de desinstalação ausente.',
)

for (const token of [
  'asset_code_aliases',
  'stock_code_aliases',
  'maintenance_notification_outbox',
  'asset_remote_access',
  "'AG-'",
  "'uninstall_software'",
]) {
  assert(
    migration.includes(token),
    `Migração M16B incompleta: ${token}`,
  )
}

assert(
  ocrMigration.includes(
    'distinct on (normalized_alias)',
  ),
  'Migração OCR local ainda está na versão com aliases duplicados.',
)

console.log(
  'M16B SOURCE VALIDADO COM SUCESSO',
)
