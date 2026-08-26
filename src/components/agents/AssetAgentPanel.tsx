import {
  AlertTriangle,
  Check,
  Copy,
  Cpu,
  HardDrive,
  KeyRound,
  MonitorCog,
  Package,
  RefreshCw,
  RotateCw,
  Search,
  ShieldOff,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import {
  adoptDetectedInventory,
  createAgentEnrollment,
  getInventoryExpectation,
  getLatestAssetSnapshot,
  listAssetAgents,
  listAssetOpenDivergences,
  revokeAgent,
  rotateAgentToken,
} from '../../data/agent-service'
import type {
  AgentDeviceRecord,
  AgentDivergenceRecord,
  AgentInventorySnapshotRecord,
  InventoryExpectationRecord,
} from '../../types/agent'
import type { AssetRecord } from '../../types/assets'
import { FormModal } from '../ui/FormModal'
import { StatusPill } from '../ui/StatusPill'

export function AssetAgentPanel({ asset }: { asset: AssetRecord }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('assets.update')
  const [agents, setAgents] = useState<AgentDeviceRecord[]>([])
  const [snapshot, setSnapshot] = useState<AgentInventorySnapshotRecord | null>(null)
  const [divergences, setDivergences] = useState<AgentDivergenceRecord[]>([])
  const [expectation, setExpectation] = useState<InventoryExpectationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<AgentDeviceRecord | null>(null)
  const [softwareOpen, setSoftwareOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data = await load(asset.id)
        if (!active) return
        setAgents(data.agents)
        setSnapshot(data.snapshot)
        setDivergences(data.divergences)
        setExpectation(data.expectation)
        setOnline(data.online)
      } catch (error) {
        if (!active) return
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o inventário automático.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [asset.id])

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)
      const data = await load(asset.id)
      setAgents(data.agents)
      setSnapshot(data.snapshot)
      setDivergences(data.divergences)
      setExpectation(data.expectation)
      setOnline(data.online)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o inventário.',
      )
    } finally {
      setLoading(false)
    }
  }

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.status === 'active') ?? null,
    [agents],
  )

  const sortedSoftware = useMemo(
    () =>
      [...(snapshot?.software ?? [])]
        .filter((software) => software.name?.trim())
        .sort((a, b) =>
          (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR', {
            sensitivity: 'base',
          }),
        ),
    [snapshot],
  )

  async function createEnrollment() {
    try {
      setBusy(true)
      setErrorMessage(null)
      const result = await createAgentEnrollment(asset.id)
      setEnrollmentToken(result.token)
      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o agente.',
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
      const result = await rotateAgentToken(activeAgent.id)
      setEnrollmentToken(result.token)
      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível rotacionar o token.',
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
      await adoptDetectedInventory(asset, snapshot, expectation)
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

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <MonitorCog size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-950">Inventário automático</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Agente Windows, hardware, software, heartbeat e divergências
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      {errorMessage && (
        <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-5 p-5 xl:grid-cols-[1fr_1.45fr]">
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
                        {activeAgent.hostname ?? asset.hostname ?? 'Aguardando heartbeat'}
                      </span>
                      <StatusPill tone={online ? 'success' : 'warning'}>
                        {online ? 'Online' : 'Sem comunicação'}
                      </StatusPill>
                    </div>

                    <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                      <div>
                        Token:{' '}
                        <span className="font-mono">
                          {activeAgent.token_prefix}...
                        </span>
                      </div>
                      <div>Versão: {activeAgent.agent_version ?? '—'}</div>
                      <div>
                        Último heartbeat:{' '}
                        {activeAgent.last_seen_at
                          ? new Date(activeAgent.last_seen_at).toLocaleString('pt-BR')
                          : 'ainda não recebido'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    Nenhum agente ativo vinculado a este patrimônio.
                  </div>
                )}
              </div>

              {activeAgent ? (
                online ? (
                  <Wifi size={18} className="text-emerald-500" />
                ) : (
                  <WifiOff size={18} className="text-amber-500" />
                )
              ) : (
                <WifiOff size={18} className="text-slate-300" />
              )}
            </div>

            {canManage && (
              <div className="mt-4 flex flex-wrap gap-2">
                {!activeAgent ? (
                  <button
                    type="button"
                    onClick={() => void createEnrollment()}
                    disabled={busy || asset.status === 'disposed'}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40"
                  >
                    <KeyRound size={13} />
                    Criar agente
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void rotateToken()}
                      disabled={busy}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
                    >
                      <RotateCw size={13} />
                      Rotacionar token
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(activeAgent)}
                      disabled={busy}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 disabled:opacity-40"
                    >
                      <ShieldOff size={13} />
                      Revogar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Baseline esperado
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Patrimônio esperado x inventário detectado.
                </div>
              </div>
              <Cpu size={17} className="text-slate-300" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <Spec label="CPU" value={expectation?.expected_cpu_name ?? 'não definido'} />
              <Spec
                label="RAM"
                value={
                  expectation?.expected_ram_bytes
                    ? formatBytes(expectation.expected_ram_bytes)
                    : 'não definida'
                }
              />
              <Spec
                label="Serial"
                value={expectation?.expected_serial_number ?? asset.serial_number ?? '—'}
              />
              <Spec
                label="Hostname"
                value={expectation?.expected_hostname ?? asset.hostname ?? '—'}
              />
            </div>

            {canManage && snapshot && (
              <button
                type="button"
                onClick={() => void adoptBaseline()}
                disabled={busy}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40"
              >
                <Check size={13} />
                Adotar inventário detectado
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Último inventário
              </div>
              <HardDrive size={16} className="text-slate-300" />
            </div>

            {!snapshot ? (
              <div className="mt-3 text-xs text-slate-500">
                Aguardando a primeira coleta do agente.
              </div>
            ) : (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Spec
                    label="Sistema"
                    value={[snapshot.os_name, snapshot.os_build].filter(Boolean).join(' · ')}
                  />
                  <Spec label="CPU" value={snapshot.cpu_name ?? '—'} />
                  <Spec
                    label="RAM"
                    value={snapshot.ram_bytes ? formatBytes(snapshot.ram_bytes) : '—'}
                  />
                  <Spec label="Hostname" value={snapshot.hostname ?? '—'} />
                  <Spec
                    label="Fabricante / modelo"
                    value={[snapshot.manufacturer, snapshot.model].filter(Boolean).join(' · ')}
                  />
                  <Spec label="Serial" value={snapshot.serial_number ?? '—'} />
                  <Spec
                    label="Coleta"
                    value={new Date(snapshot.received_at).toLocaleString('pt-BR')}
                  />
                  <Spec
                    label="Arquitetura"
                    value={snapshot.os_architecture ?? '—'}
                  />
                </div>
              </>
            )}
          </div>

          {snapshot && (
            <StorageSection disks={snapshot.disks} />
          )}

          {snapshot && (
            <div className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-800">
                    Programas instalados
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                    {sortedSoftware.length}
                  </span>
                </div>

                {sortedSoftware.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSoftwareOpen(true)}
                    className="text-[11px] font-bold text-sky-700 hover:text-sky-800"
                  >
                    Ver todos
                  </button>
                )}
              </div>

              {sortedSoftware.length === 0 ? (
                <div className="px-4 py-5 text-xs text-slate-400">
                  Nenhum programa identificado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sortedSoftware.slice(0, 6).map((software, index) => (
                    <div
                      key={`${software.name}-${software.version}-${index}`}
                      className="flex items-start justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-slate-700">
                          {software.name}
                        </div>
                        <div className="mt-0.5 truncate text-[9px] text-slate-400">
                          {software.publisher || 'Fabricante não informado'}
                        </div>
                      </div>
                      <div className="shrink-0 text-[9px] font-medium text-slate-400">
                        {software.version || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-800">
                  Divergências abertas
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                  {divergences.length}
                </span>
              </div>
            </div>

            {divergences.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                Nenhuma divergência aberta.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {divergences.map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {item.title}
                      </span>
                      <StatusPill
                        tone={
                          item.severity === 'critical'
                            ? 'danger'
                            : item.severity === 'warning'
                              ? 'warning'
                              : 'info'
                        }
                      >
                        {item.severity === 'critical'
                          ? 'Crítico'
                          : item.severity === 'warning'
                            ? 'Atenção'
                            : 'Info'}
                      </StatusPill>
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-slate-400">
                      {item.divergence_key}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {enrollmentToken && (
        <EnrollmentModal
          token={enrollmentToken}
          onClose={() => setEnrollmentToken(null)}
        />
      )}

      {revokeTarget && (
        <RevokeModal
          agent={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onDone={() => {
            setRevokeTarget(null)
            void refresh()
          }}
        />
      )}

      {softwareOpen && snapshot && (
        <SoftwareModal
          software={sortedSoftware}
          onClose={() => setSoftwareOpen(false)}
        />
      )}
    </section>
  )
}

async function load(assetId: string) {
  const [agents, snapshot, divergences, expectation] = await Promise.all([
    listAssetAgents(assetId),
    getLatestAssetSnapshot(assetId),
    listAssetOpenDivergences(assetId),
    getInventoryExpectation(assetId),
  ])

  const activeAgent = agents.find((agent) => agent.status === 'active')

  const online =
    activeAgent?.last_seen_at != null &&
    Date.now() - new Date(activeAgent.last_seen_at).getTime() < 30 * 60 * 1000

  return {
    agents,
    snapshot,
    divergences,
    expectation,
    online,
  }
}

function StorageSection({
  disks,
}: {
  disks: AgentInventorySnapshotRecord['disks']
}) {
  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <HardDrive size={14} className="text-slate-400" />
        <span className="text-xs font-bold text-slate-800">Armazenamento</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
          {disks.length}
        </span>
      </div>

      {disks.length === 0 ? (
        <div className="px-4 py-5 text-xs text-slate-400">
          Nenhum volume identificado.
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {disks.map((disk, index) => {
            const size = disk.size_bytes ?? 0
            const free = disk.free_bytes ?? 0
            const used = Math.max(0, size - free)
            const usage = size > 0 ? Math.min(100, Math.round((used / size) * 100)) : 0

            return (
              <div
                key={`${disk.device_id}-${index}`}
                className="rounded-xl bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800">
                      {disk.device_id || `Volume ${index + 1}`}
                      {disk.label ? ` · ${disk.label}` : ''}
                    </div>
                    <div className="mt-0.5 text-[9px] text-slate-400">
                      {disk.system_drive ? 'Disco do sistema' : 'Volume local'}
                    </div>
                  </div>

                  {disk.system_drive && (
                    <StatusPill tone="info">Sistema</StatusPill>
                  )}
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{ width: `${usage}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
                  <span>{formatBytes(used)} usados</span>
                  <span>{formatBytes(free)} livres</span>
                </div>

                <div className="mt-1 text-[10px] font-bold text-slate-700">
                  Capacidade: {formatBytes(size)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SoftwareModal({
  software,
  onClose,
}: {
  software: AgentInventorySnapshotRecord['software']
  onClose: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if (!clean) return software

    return software.filter((item) =>
      [item.name, item.version, item.publisher]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(clean),
    )
  }, [query, software])

  return (
    <FormModal
      open
      title="Programas instalados"
      description={`${software.length} programas identificados no último inventário.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white"
          >
            Fechar
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar programa, versão ou fabricante"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Nenhum programa encontrado.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((item, index) => (
                <div
                  key={`${item.name}-${item.version}-${item.publisher}-${index}`}
                  className="grid gap-1 px-3 py-2.5 sm:grid-cols-[1fr_130px]"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800">
                      {item.name}
                    </div>
                    <div className="mt-0.5 text-[9px] text-slate-400">
                      {item.publisher || 'Fabricante não informado'}
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 sm:text-right">
                    {item.version || 'Versão não informada'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </FormModal>
  )
}

function EnrollmentModal({
  token,
  onClose,
}: {
  token: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copyToken() {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <FormModal
      open
      title="Credencial do agente"
      description="Use o instalador gráfico do Wisdom TI na máquina correspondente."
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white"
          >
            Concluir
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-800">
          Instalação simplificada: leve o arquivo <strong>WisdomTI-Agent-Setup.exe</strong>{' '}
          para o computador, dê dois cliques, cole este token e clique em Instalar.
          Não é necessário abrir PowerShell.
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-700">
            Token desta máquina
          </div>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-slate-950 p-3 text-[10px] text-white">
              {token}
            </code>
            <button
              type="button"
              onClick={() => void copyToken()}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200"
              aria-label="Copiar token"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          O token é exibido uma única vez e identifica somente este agente.
          Se houver exposição, use Rotacionar token.
        </div>

        {copied && (
          <div className="text-xs font-semibold text-emerald-600">
            Token copiado.
          </div>
        )}
      </div>
    </FormModal>
  )
}

function RevokeModal({
  agent,
  onClose,
  onDone,
}: {
  agent: AgentDeviceRecord
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function submit() {
    if (!reason.trim()) {
      setErrorMessage('Informe o motivo da revogação.')
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)
      await revokeAgent(agent.id, reason)
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível revogar o agente.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title="Revogar agente"
      description="A credencial deixa de aceitar novas coletas imediatamente."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="h-10 rounded-xl bg-red-600 px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Revogando...' : 'Revogar'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          placeholder="Motivo da revogação"
        />
      </div>
    </FormModal>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-[11px] font-semibold text-slate-700">
        {value || '—'}
      </div>
    </div>
  )
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 GB'

  const gb = value / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`

  const mb = value / 1024 / 1024
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}
