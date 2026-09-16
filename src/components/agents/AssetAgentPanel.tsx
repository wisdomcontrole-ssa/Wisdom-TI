import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  HardDrive,
  MemoryStick,
  MonitorCog,
  Package,
  RefreshCw,
  RotateCw,
  ShieldOff,
  Trash2,
  Stethoscope,
  Wrench,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '../../auth/useAuth'
import {
  adoptDetectedInventory,
  createAgentActivation,
  downloadAgentInstaller,
  getAssetRemoteAccess,
  getInventoryExpectation,
  getLatestAssetSnapshot,
  listAssetAgentCommands,
  listAssetAgents,
  listAssetOpenDivergences,
  queueAgentCommand,
  revokeAgent,
  rotateAgentToken,
} from '../../data/agent-service'
import type {
  AgentCommandRecord,
  AgentCommandType,
  AgentDeviceRecord,
  AgentDivergenceRecord,
  AgentInventorySnapshotRecord,
  AssetRemoteAccessRecord,
  InventoryExpectationRecord,
} from '../../types/agent'
import type {
  AssetRecord,
} from '../../types/assets'
import { FormModal } from '../ui/FormModal'
import { StatusPill } from '../ui/StatusPill'

const actionOptions: Array<{
  value: AgentCommandType
  label: string
  description: string
  risk: 'diagnostic' | 'maintenance'
}> = [
  {
    value: 'collect_diagnostics',
    label: 'Coletar diagnóstico agora',
    description:
      'Atualiza inventário, eventos do Windows e executa uma verificação rápida da integridade do sistema.',
    risk: 'diagnostic',
  },
  {
    value: 'sfc_verify',
    label: 'Verificar arquivos do Windows (SFC)',
    description:
      'Executa somente a verificação dos arquivos protegidos do Windows.',
    risk: 'diagnostic',
  },
  {
    value: 'dism_scanhealth',
    label: 'Verificar imagem do Windows (DISM)',
    description:
      'Analisa a integridade da imagem do Windows sem reparar.',
    risk: 'diagnostic',
  },
  {
    value: 'flush_dns',
    label: 'Limpar cache DNS',
    description:
      'Limpa o cache local de resolução de nomes.',
    risk: 'maintenance',
  },
  {
    value: 'cleanup_temp',
    label: 'Limpeza segura de temporários',
    description:
      'Remove arquivos temporários antigos que não estejam em uso.',
    risk: 'maintenance',
  },
  {
    value: 'optimize_system_drive',
    label: 'Otimizar armazenamento',
    description:
      'Solicita ao Windows a otimização apropriada para a mídia instalada.',
    risk: 'maintenance',
  },
  {
    value: 'sfc_scannow',
    label: 'Reparar arquivos do Windows (SFC)',
    description:
      'Verifica e tenta reparar arquivos protegidos do Windows.',
    risk: 'maintenance',
  },
  {
    value: 'dism_restorehealth',
    label: 'Reparar imagem do Windows (DISM)',
    description:
      'Tenta reparar a imagem do sistema operacional.',
    risk: 'maintenance',
  },
]

const commandLabels =
  new Map<AgentCommandType, string>([
    ...actionOptions.map(
      (item) =>
        [item.value, item.label] as [
          AgentCommandType,
          string,
        ],
    ),
    [
      'uninstall_software',
      'Desinstalar programa',
    ],
  ])

const statusTone = {
  queued: 'info',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
} as const

const statusLabels = {
  queued: 'Na fila',
  running: 'Executando',
  completed: 'Concluído',
  failed: 'Falhou',
  cancelled: 'Cancelado',
} as const

export function AssetAgentPanel({
  asset,
}: {
  asset: AssetRecord
}) {
  const { hasPermission } = useAuth()
  const canManage =
    hasPermission('agents.manage') ||
    hasPermission('assets.update')
  const canRemote =
    hasPermission('agents.remote') ||
    hasPermission('assets.update')

  const [agents, setAgents] = useState<
    AgentDeviceRecord[]
  >([])
  const [snapshot, setSnapshot] =
    useState<AgentInventorySnapshotRecord | null>(
      null,
    )
  const [divergences, setDivergences] =
    useState<AgentDivergenceRecord[]>([])
  const [expectation, setExpectation] =
    useState<InventoryExpectationRecord | null>(
      null,
    )
  const [commands, setCommands] =
    useState<AgentCommandRecord[]>([])
  const [
    remoteAccess,
    setRemoteAccess,
  ] = useState<AssetRemoteAccessRecord | null>(
    null,
  )
  const [loading, setLoading] =
    useState(true)
  const [online, setOnline] =
    useState(false)
  const [busy, setBusy] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [
    activationMessage,
    setActivationMessage,
  ] = useState<string | null>(null)
  const [
    actionOpen,
    setActionOpen,
  ] = useState(false)
  const [
    revokeTarget,
    setRevokeTarget,
  ] =
    useState<AgentDeviceRecord | null>(null)
  const [softwareOpen, setSoftwareOpen] =
    useState(false)

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await load(asset.id)

      setAgents(data.agents)
      setSnapshot(data.snapshot)
      setDivergences(
        data.divergences,
      )
      setExpectation(
        data.expectation,
      )
      setCommands(data.commands)
      setRemoteAccess(
        data.remoteAccess,
      )
      setOnline(data.online)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o inventário automático.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    void load(asset.id)
      .then((data) => {
        if (!active) return
        setAgents(data.agents)
        setSnapshot(data.snapshot)
        setDivergences(
          data.divergences,
        )
        setExpectation(
          data.expectation,
        )
        setCommands(data.commands)
        setOnline(data.online)
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o inventário automático.',
        )
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [asset.id])

  const activeAgent = useMemo(
    () =>
      agents.find(
        (agent) =>
          agent.status === 'active',
      ) ?? null,
    [agents],
  )

  const sortedSoftware = useMemo(
    () =>
      [...(snapshot?.software ?? [])]
        .filter((item) =>
          item.name?.trim(),
        )
        .sort((a, b) =>
          (a.name ?? '').localeCompare(
            b.name ?? '',
            'pt-BR',
            {
              sensitivity: 'base',
            },
          ),
        ),
    [snapshot],
  )

  const health =
    snapshot?.health ?? {}
  const diagnostics =
    health.diagnostics
  const memoryModules =
    health.memory_modules ?? []
  const physicalDisks =
    health.physical_disks ?? []

  async function downloadInstaller() {
    try {
      setBusy(true)
      setErrorMessage(null)

      const activation =
        await createAgentActivation(
          asset.id,
        )

      await downloadAgentInstaller(
        activation.activation_code,
      )

      setActivationMessage(
        `Instalador preparado para ${asset.asset_code}. ` +
          `Código de recuperação: ${activation.activation_code}. ` +
          `Válido até ${new Date(
            activation.expires_at,
          ).toLocaleString('pt-BR')}.`,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível preparar o instalador.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function quickDiagnostic() {
    try {
      setBusy(true)
      setErrorMessage(null)

      await queueAgentCommand({
        assetId: asset.id,
        commandType:
          'collect_diagnostics',
        reason:
          'Diagnóstico solicitado pela ficha do patrimônio.',
      })

      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível solicitar o diagnóstico.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function rotateToken() {
    if (!activeAgent) return

    try {
      setBusy(true)
      setErrorMessage(null)

      await rotateAgentToken(
        activeAgent.id,
      )

      await refresh()

      setActivationMessage(
        'A credencial foi rotacionada. Gere um novo instalador deste ativo para reconfigurar a máquina.',
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível rotacionar a credencial.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function adoptBaseline() {
    if (!snapshot) return

    try {
      setBusy(true)
      setErrorMessage(null)

      await adoptDetectedInventory(
        asset,
        snapshot,
        expectation,
      )

      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o baseline.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function uninstallSoftware(
    software:
      AgentInventorySnapshotRecord['software'][number],
  ) {
    if (
      !software.uninstall_eligible ||
      !software.uninstall_id ||
      !software.name
    ) {
      return
    }

    const accepted = window.confirm(
      `Desinstalar "${software.name}" desta máquina?\n\nA ação será executada pelo agente e ficará registrada no histórico.`,
    )

    if (!accepted) {
      return
    }

    try {
      setBusy(true)
      setErrorMessage(null)

      await queueAgentCommand({
        assetId: asset.id,
        commandType:
          'uninstall_software',
        reason:
          `Desinstalação remota solicitada para ${software.name}.`,
        parameters: {
          software_id:
            software.uninstall_id,
          expected_name:
            software.name,
        },
      })

      setSoftwareOpen(false)
      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível solicitar a desinstalação.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <MonitorCog size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Inventário e suporte do endpoint
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Inventário Windows, saúde, diagnóstico e ações remotas auditadas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={
              loading
                ? 'animate-spin'
                : ''
            }
          />
          Atualizar
        </button>
      </header>

      {errorMessage && (
        <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {activationMessage && (
        <div className="border-b border-sky-100 bg-sky-50 px-5 py-3 text-xs leading-5 text-sky-800">
          {activationMessage}
        </div>
      )}

      <div className="grid gap-5 p-5 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Agente
                </div>

                {activeAgent ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {activeAgent.hostname ??
                          asset.hostname ??
                          'Aguardando identificação'}
                      </span>
                      <StatusPill
                        tone={
                          online
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {online
                          ? 'Online'
                          : 'Sem comunicação'}
                      </StatusPill>
                    </div>

                    <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                      <div>
                        Versão:{' '}
                        {activeAgent.agent_version ??
                          '—'}
                      </div>
                      <div>
                        Última comunicação:{' '}
                        {activeAgent.last_seen_at
                          ? new Date(
                              activeAgent.last_seen_at,
                            ).toLocaleString(
                              'pt-BR',
                            )
                          : 'ainda não recebida'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    Nenhum agente ativo vinculado a este patrimônio.
                  </div>
                )}
              </div>

              {activeAgent &&
              online ? (
                <Wifi
                  size={18}
                  className="text-emerald-500"
                />
              ) : (
                <WifiOff
                  size={18}
                  className="text-slate-300"
                />
              )}
            </div>

            {canManage && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    void downloadInstaller()
                  }
                  disabled={
                    busy ||
                    asset.status ===
                      'disposed'
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Download size={13} />
                  {activeAgent
                    ? 'Baixar instalador / reinstalar'
                    : 'Baixar instalador deste ativo'}
                </button>

                {activeAgent && (
                  <button
                    type="button"
                    onClick={() =>
                      void quickDiagnostic()
                    }
                    disabled={
                      busy || !canRemote
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-800 disabled:opacity-40"
                  >
                    <Stethoscope
                      size={13}
                    />
                    Diagnóstico agora
                  </button>
                )}
              </div>
            )}

            {canManage &&
              activeAgent && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {canRemote && (
                    <button
                      type="button"
                      onClick={() =>
                        setActionOpen(
                          true,
                        )
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600"
                    >
                      <Wrench size={13} />
                      Manutenção remota
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      void rotateToken()
                    }
                    disabled={busy}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
                  >
                    <RotateCw size={13} />
                    Rotacionar credencial
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRevokeTarget(
                        activeAgent,
                      )
                    }
                    disabled={busy}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 disabled:opacity-40"
                  >
                    <ShieldOff size={13} />
                    Revogar
                  </button>
                </div>
              )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Acesso remoto
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  Tela, teclado e mouse por sessão administrativa auditada.
                </div>
              </div>
              <MonitorCog
                size={16}
                className="text-slate-300"
              />
            </div>

            {remoteAccess?.active &&
            remoteAccess.connect_url ? (
              <a
                href={
                  remoteAccess.connect_url
                }
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white"
              >
                <ExternalLink size={13} />
                Conectar
              </a>
            ) : (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                Integração preparada. A sessão ficará disponível após configurar o servidor persistente de acesso remoto.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Baseline esperado
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Patrimônio cadastrado x inventário detectado.
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <Spec
                label="CPU"
                value={
                  expectation
                    ?.expected_cpu_name ??
                  'não definido'
                }
              />
              <Spec
                label="RAM"
                value={
                  expectation
                    ?.expected_ram_bytes
                    ? formatBytes(
                        expectation.expected_ram_bytes,
                      )
                    : 'não definida'
                }
              />
              <Spec
                label="Serial"
                value={
                  expectation
                    ?.expected_serial_number ??
                  asset.serial_number ??
                  '—'
                }
              />
              <Spec
                label="Hostname"
                value={
                  expectation
                    ?.expected_hostname ??
                  asset.hostname ??
                  '—'
                }
              />
            </div>

            {canManage &&
              snapshot && (
                <button
                  type="button"
                  onClick={() =>
                    void adoptBaseline()
                  }
                  disabled={busy}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                  <Check size={13} />
                  Adotar inventário detectado
                </button>
              )}
          </div>

          <CommandHistory
            commands={commands}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Último inventário
              </div>
              <HardDrive
                size={16}
                className="text-slate-300"
              />
            </div>

            {!snapshot ? (
              <div className="mt-3 text-xs text-slate-500">
                Aguardando a primeira coleta do agente.
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Spec
                  label="Sistema"
                  value={[
                    snapshot.os_name,
                    snapshot.os_build,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <Spec
                  label="CPU"
                  value={
                    snapshot.cpu_name ??
                    '—'
                  }
                />
                <Spec
                  label="RAM"
                  value={
                    snapshot.ram_bytes
                      ? formatBytes(
                          snapshot.ram_bytes,
                        )
                      : '—'
                  }
                />
                <Spec
                  label="Placa-mãe"
                  value={[
                    health.motherboard
                      ?.manufacturer,
                    health.motherboard
                      ?.model,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <Spec
                  label="Hostname"
                  value={
                    snapshot.hostname ??
                    '—'
                  }
                />
                <Spec
                  label="Coleta"
                  value={new Date(
                    snapshot.received_at,
                  ).toLocaleString(
                    'pt-BR',
                  )}
                />
              </div>
            )}
          </div>

          {snapshot && (
            <DiagnosticsCard
              diagnostics={
                diagnostics
              }
            />
          )}

          {snapshot &&
            memoryModules.length >
              0 && (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <MemoryStick
                    size={15}
                    className="text-slate-400"
                  />
                  <div className="text-xs font-bold text-slate-800">
                    Módulos de memória
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {memoryModules.map(
                    (module, index) => (
                      <Spec
                        key={`${module.slot}-${index}`}
                        label={
                          module.slot ||
                          module.bank ||
                          `Módulo ${index + 1}`
                        }
                        value={[
                          module.capacity_bytes
                            ? formatBytes(
                                module.capacity_bytes,
                              )
                            : '',
                          module.memory_type,
                          module.configured_speed_mhz
                            ? `${module.configured_speed_mhz} MHz`
                            : '',
                          module.manufacturer,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    ),
                  )}
                </div>
              </div>
            )}

          {snapshot &&
            physicalDisks.length >
              0 && (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <HardDrive
                    size={15}
                    className="text-slate-400"
                  />
                  <div className="text-xs font-bold text-slate-800">
                    Discos físicos
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {physicalDisks.map(
                    (disk, index) => (
                      <div
                        key={`${disk.serial_number}-${index}`}
                        className="rounded-xl bg-slate-50 p-3"
                      >
                        <div className="text-xs font-bold text-slate-800">
                          {disk.model ||
                            disk.friendly_name ||
                            `Disco ${index + 1}`}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          {[
                            disk.size_bytes
                              ? formatBytes(
                                  disk.size_bytes,
                                )
                              : '',
                            disk.media_type,
                            disk.bus_type,
                            disk.health_status,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {snapshot && (
            <div className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package
                    size={14}
                    className="text-slate-400"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Programas instalados
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                    {
                      sortedSoftware.length
                    }
                  </span>
                </div>

                {sortedSoftware.length >
                  0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSoftwareOpen(
                        true,
                      )
                    }
                    className="text-[11px] font-bold text-sky-700"
                  >
                    Ver todos
                  </button>
                )}
              </div>

              {sortedSoftware.length ===
              0 ? (
                <div className="px-4 py-5 text-xs text-slate-400">
                  Nenhum programa identificado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sortedSoftware
                    .slice(0, 6)
                    .map(
                      (
                        software,
                        index,
                      ) => (
                        <div
                          key={`${software.name}-${index}`}
                          className="flex items-start justify-between gap-3 px-4 py-2.5"
                        >
                          <div className="min-w-0 truncate text-[11px] font-semibold text-slate-700">
                            {
                              software.name
                            }
                          </div>
                          <div className="shrink-0 text-[9px] text-slate-400">
                            {software.version ??
                              '—'}
                          </div>
                        </div>
                      ),
                    )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <AlertTriangle
                size={14}
                className="text-amber-500"
              />
              <span className="text-xs font-bold text-slate-800">
                Divergências abertas
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                {divergences.length}
              </span>
            </div>

            {divergences.length ===
            0 ? (
              <div className="px-4 py-5 text-xs text-slate-400">
                Nenhuma divergência aberta.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {divergences.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="px-4 py-3"
                    >
                      <div className="text-xs font-bold text-slate-800">
                        {item.title}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {item.divergence_key}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <RemoteActionModal
        open={actionOpen}
        assetId={asset.id}
        busy={busy}
        onBusy={setBusy}
        onClose={() =>
          setActionOpen(false)
        }
        onQueued={async () => {
          setActionOpen(false)
          await refresh()
        }}
        onError={setErrorMessage}
      />

      <RevokeModal
        agent={revokeTarget}
        busy={busy}
        onClose={() =>
          setRevokeTarget(null)
        }
        onConfirm={async (
          reason,
        ) => {
          if (!revokeTarget) {
            return
          }

          try {
            setBusy(true)
            setErrorMessage(null)

            await revokeAgent(
              revokeTarget.id,
              reason,
            )

            setRevokeTarget(null)
            await refresh()
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'Não foi possível revogar o agente.',
            )
          } finally {
            setBusy(false)
          }
        }}
      />

      <SoftwareModal
        open={softwareOpen}
        software={sortedSoftware}
        busy={busy}
        canUninstall={canRemote}
        onUninstall={(software) =>
          void uninstallSoftware(
            software,
          )
        }
        onClose={() =>
          setSoftwareOpen(false)
        }
      />
    </section>
  )
}

async function load(
  assetId: string,
) {
  const [
    agents,
    snapshot,
    divergences,
    expectation,
    commands,
    remoteAccess,
  ] = await Promise.all([
    listAssetAgents(assetId),
    getLatestAssetSnapshot(assetId),
    listAssetOpenDivergences(
      assetId,
    ),
    getInventoryExpectation(assetId),
    listAssetAgentCommands(assetId),
    getAssetRemoteAccess(assetId),
  ])

  const activeAgent =
    agents.find(
      (agent) =>
        agent.status === 'active',
    ) ?? null

  const online =
    Boolean(
      activeAgent?.last_seen_at,
    ) &&
    Date.now() -
      new Date(
        activeAgent!.last_seen_at!,
      ).getTime() <
      3 * 60 * 1000

  return {
    agents,
    snapshot,
    divergences,
    expectation,
    commands,
    remoteAccess,
    online,
  }
}

function DiagnosticsCard({
  diagnostics,
}: {
  diagnostics:
    | AgentInventorySnapshotRecord['health']['diagnostics']
    | undefined
}) {
  if (!diagnostics) {
    return null
  }

  const findings = [
    {
      label:
        'Reinicializações inesperadas (7 dias)',
      value:
        diagnostics
          .unexpected_shutdowns_7d ??
        0,
    },
    {
      label:
        'Telas azuis / BugCheck (7 dias)',
      value:
        diagnostics.bugchecks_7d ??
        0,
    },
    {
      label:
        'Erros WHEA de hardware (7 dias)',
      value:
        diagnostics.whea_errors_7d ??
        0,
    },
    {
      label:
        'Erros de memória registrados (30 dias)',
      value:
        diagnostics
          .memory_diagnostic_errors_30d ??
        0,
    },
    {
      label:
        'Falhas de aplicativos (7 dias)',
      value:
        diagnostics
          .application_crashes_7d ??
        0,
    },
  ]

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <Stethoscope
          size={15}
          className="text-slate-400"
        />
        <div className="text-xs font-bold text-slate-800">
          Diagnóstico do Windows
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {findings.map((item) => (
          <Spec
            key={item.label}
            label={item.label}
            value={String(
              item.value,
            )}
          />
        ))}

        <Spec
          label="Espaço livre no disco do sistema"
          value={
            diagnostics
              .system_drive_free_percent !==
            undefined
              ? `${diagnostics.system_drive_free_percent}%`
              : '—'
          }
        />

        <Spec
          label="Reinicialização pendente"
          value={
            diagnostics.pending_reboot
              ? 'Sim'
              : 'Não'
          }
        />
      </div>
    </div>
  )
}

function CommandHistory({
  commands,
}: {
  commands: AgentCommandRecord[]
}) {
  return (
    <div className="rounded-xl border border-slate-200">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="text-xs font-bold text-slate-800">
          Ações remotas recentes
        </div>
      </div>

      {commands.length === 0 ? (
        <div className="px-4 py-5 text-xs text-slate-400">
          Nenhuma ação remota registrada.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {commands
            .slice(0, 8)
            .map((command) => (
              <div
                key={command.id}
                className="px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[11px] font-bold text-slate-800">
                    {commandLabels.get(
                      command.command_type,
                    ) ??
                      command.command_type}
                  </div>
                  <StatusPill
                    tone={
                      statusTone[
                        command.status
                      ]
                    }
                  >
                    {
                      statusLabels[
                        command.status
                      ]
                    }
                  </StatusPill>
                </div>

                <div className="mt-1 text-[10px] leading-4 text-slate-400">
                  {new Date(
                    command.requested_at,
                  ).toLocaleString(
                    'pt-BR',
                  )}
                  {' · '}
                  {command.reason}
                </div>

                {command.result
                  ?.summary && (
                  <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] leading-4 text-slate-600">
                    {
                      command.result
                        .summary
                    }
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function RemoteActionModal({
  open,
  assetId,
  busy,
  onBusy,
  onClose,
  onQueued,
  onError,
}: {
  open: boolean
  assetId: string
  busy: boolean
  onBusy: (value: boolean) => void
  onClose: () => void
  onQueued: () => Promise<void>
  onError: (
    message: string | null,
  ) => void
}) {
  const [command, setCommand] =
    useState<AgentCommandType>(
      'sfc_verify',
    )
  const [reason, setReason] =
    useState('')

  const selected =
    actionOptions.find(
      (item) =>
        item.value === command,
    )

  async function submit() {
    try {
      onBusy(true)
      onError(null)

      await queueAgentCommand({
        assetId,
        commandType: command,
        reason,
      })

      setReason('')
      await onQueued()
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Não foi possível colocar a ação na fila.',
      )
    } finally {
      onBusy(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Manutenção remota"
      description="Somente operações pré-definidas e auditadas podem ser executadas pelo agente."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              busy ||
              reason.trim().length < 5
            }
            onClick={() =>
              void submit()
            }
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            Enviar para a máquina
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">
            Ação
          </span>
          <select
            value={command}
            onChange={(event) =>
              setCommand(
                event.target
                  .value as AgentCommandType,
              )
            }
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            {actionOptions.map(
              (item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ),
            )}
          </select>
        </label>

        {selected && (
          <div
            className={`rounded-xl border p-3 text-xs leading-5 ${
              selected.risk ===
              'maintenance'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            {selected.description}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">
            Motivo / contexto
          </span>
          <textarea
            value={reason}
            onChange={(event) =>
              setReason(
                event.target.value,
              )
            }
            placeholder="Ex.: chamado CHM-2026-000012 apresenta lentidão e reinicializações."
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
          />
        </label>
      </div>
    </FormModal>
  )
}

function RevokeModal({
  agent,
  busy,
  onClose,
  onConfirm,
}: {
  agent: AgentDeviceRecord | null
  busy: boolean
  onClose: () => void
  onConfirm: (
    reason: string,
  ) => Promise<void>
}) {
  const [reason, setReason] =
    useState('')

  return (
    <FormModal
      open={Boolean(agent)}
      title="Revogar agente"
      description="A máquina deixará de conseguir enviar inventário ou receber ações remotas."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              busy ||
              reason.trim().length < 5
            }
            onClick={() =>
              void onConfirm(
                reason,
              )
            }
            className="h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            Revogar
          </button>
        </div>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700">
          Justificativa
        </span>
        <textarea
          value={reason}
          onChange={(event) =>
            setReason(
              event.target.value,
            )
          }
          className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
    </FormModal>
  )
}

function SoftwareModal({
  open,
  software,
  busy,
  canUninstall,
  onUninstall,
  onClose,
}: {
  open: boolean
  software:
    AgentInventorySnapshotRecord['software']
  busy: boolean
  canUninstall: boolean
  onUninstall: (
    software:
      AgentInventorySnapshotRecord['software'][number],
  ) => void
  onClose: () => void
}) {
  const [search, setSearch] =
    useState('')

  const filtered = software.filter(
    (item) =>
      `${item.name ?? ''} ${item.publisher ?? ''}`
        .toLowerCase()
        .includes(
          search
            .trim()
            .toLowerCase(),
        ),
  )

  return (
    <FormModal
      open={open}
      title="Programas instalados"
      description={`${software.length} programas identificados na última coleta.`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
        >
          Concluir
        </button>
      }
    >
      <input
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value,
          )
        }
        placeholder="Buscar programa"
        className="mb-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
      />

      <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
        {filtered.map(
          (item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-800">
                  {item.name}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {[
                    item.version,
                    item.publisher,
                    item.uninstall_scope ===
                    'machine'
                      ? 'Máquina'
                      : item.uninstall_scope ===
                          'user'
                        ? 'Usuário'
                        : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              {canUninstall &&
                item.uninstall_eligible &&
                item.uninstall_id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onUninstall(item)
                    }
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-[10px] font-bold text-red-700 disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                    Desinstalar
                  </button>
                )}
            </div>
          ),
        )}
      </div>
    </FormModal>
  )
}

function Spec({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-[11px] font-semibold text-slate-700">
        {value || '—'}
      </div>
    </div>
  )
}

function formatBytes(
  bytes: number,
) {
  if (!Number.isFinite(bytes)) {
    return '—'
  }

  if (bytes >=
    1024 ** 3) {
    return `${(
      bytes /
      1024 ** 3
    ).toFixed(1)} GB`
  }

  return `${(
    bytes /
    1024 ** 2
  ).toFixed(0)} MB`
}
