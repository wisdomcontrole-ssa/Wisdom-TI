import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleDashed,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  Link,
  useParams,
} from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AuditScanner } from '../components/audits/AuditScanner'
import { EvidencePanel } from '../components/evidence/EvidencePanel'
import { FormModal } from '../components/ui/FormModal'
import {
  cancelPhysicalAudit,
  closePhysicalAudit,
  getAuditCycle,
  listAuditItems,
  listAuditScanEvents,
  registerAuditScan,
  updateAuditItemNote,
} from '../data/audit-service'
import {
  listAssets,
  listEnvironments,
  listUnits,
} from '../data/asset-service'
import type {
  AssetRecord,
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'
import type {
  AuditCycleRecord,
  AuditItemRecord,
  AuditItemResult,
  AuditScanEventRecord,
  AuditScanMethod,
  AuditScanResponse,
} from '../types/audit'

const resultLabels: Record<
  AuditItemResult,
  string
> = {
  pending: 'Pendente',
  found: 'Conferido',
  missing: 'Ausente',
  divergent: 'Divergente',
  extra: 'Extra',
}

const resultClass: Record<
  AuditItemResult,
  string
> = {
  pending: 'bg-slate-100 text-slate-600',
  found: 'bg-emerald-50 text-emerald-700',
  missing: 'bg-red-50 text-red-700',
  divergent: 'bg-amber-50 text-amber-700',
  extra: 'bg-violet-50 text-violet-700',
}

type ResultFilter = AuditItemResult | 'all'

export function AuditExecutionPage() {
  const { auditId } = useParams()
  const { hasPermission } = useAuth()

  const [audit, setAudit] =
    useState<AuditCycleRecord | null>(null)
  const [items, setItems] =
    useState<AuditItemRecord[]>([])
  const [events, setEvents] =
    useState<AuditScanEventRecord[]>([])
  const [assets, setAssets] =
    useState<AssetRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [lastScan, setLastScan] =
    useState<AuditScanResponse | null>(null)

  const [observedEnvironmentId, setObservedEnvironmentId] =
    useState('')
  const [filter, setFilter] =
    useState<ResultFilter>('all')
  const [search, setSearch] = useState('')

  const [closeOpen, setCloseOpen] =
    useState(false)
  const [cancelOpen, setCancelOpen] =
    useState(false)
  const [noteItem, setNoteItem] =
    useState<AuditItemRecord | null>(null)

  async function fetchData(id: string) {
    const [
      auditRow,
      itemRows,
      eventRows,
      assetRows,
      unitRows,
      environmentRows,
    ] = await Promise.all([
      getAuditCycle(id),
      listAuditItems(id),
      listAuditScanEvents(id),
      listAssets(),
      listUnits(),
      listEnvironments(),
    ])

    return {
      auditRow,
      itemRows,
      eventRows,
      assetRows,
      unitRows,
      environmentRows,
    }
  }

  useEffect(() => {
    if (!auditId) {
      return
    }

    let active = true

    async function bootstrap(id: string) {
      try {
        const data = await fetchData(id)

        if (!active) {
          return
        }

        setAudit(data.auditRow)
        setItems(data.itemRows)
        setEvents(data.eventRows)
        setAssets(data.assetRows)
        setUnits(data.unitRows)
        setEnvironments(data.environmentRows)
        setObservedEnvironmentId(
          data.auditRow.environment_id ?? '',
        )
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar a auditoria.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrap(auditId)

    return () => {
      active = false
    }
  }, [auditId])

  async function refresh() {
    if (!auditId) {
      return
    }

    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await fetchData(auditId)

      setAudit(data.auditRow)
      setItems(data.itemRows)
      setEvents(data.eventRows)
      setAssets(data.assetRows)
      setUnits(data.unitRows)
      setEnvironments(data.environmentRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a auditoria.',
      )
    } finally {
      setLoading(false)
    }
  }

  const assetMap = useMemo(
    () =>
      new Map(
        assets.map((asset) => [asset.id, asset]),
      ),
    [assets],
  )

  const unitMap = useMemo(
    () =>
      new Map(
        units.map((unit) => [unit.id, unit]),
      ),
    [units],
  )

  const environmentMap = useMemo(
    () =>
      new Map(
        environments.map((environment) => [
          environment.id,
          environment,
        ]),
      ),
    [environments],
  )

  const scopeEnvironments = useMemo(() => {
    if (!audit) {
      return []
    }

    return environments.filter(
      (environment) =>
        environment.active &&
        environment.unit_id === audit.unit_id,
    )
  }, [audit, environments])

  const counts = useMemo(() => {
    const value: Record<AuditItemResult, number> = {
      pending: 0,
      found: 0,
      missing: 0,
      divergent: 0,
      extra: 0,
    }

    for (const item of items) {
      value[item.result]++
    }

    return value
  }, [items])

  const unknownCount = useMemo(
    () =>
      events.filter(
        (event) =>
          event.result === 'unknown_code',
      ).length,
    [events],
  )

  const progress = useMemo(() => {
    const expected = items.filter(
      (item) => item.expected,
    ).length

    const checked = items.filter(
      (item) =>
        item.expected &&
        item.result !== 'pending',
    ).length

    return {
      expected,
      checked,
      percentage:
        expected === 0
          ? 100
          : Math.round((checked / expected) * 100),
    }
  }, [items])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()

    return items.filter((item) => {
      if (
        filter !== 'all' &&
        item.result !== filter
      ) {
        return false
      }

      if (!term) {
        return true
      }

      const asset = assetMap.get(item.asset_id)

      return [
        asset?.asset_code,
        asset?.manufacturer,
        asset?.model,
        asset?.serial_number,
        environmentMap.get(
          item.expected_environment_id ?? '',
        )?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [
    assetMap,
    environmentMap,
    filter,
    items,
    search,
  ])

  async function handleScan(
    value: string,
    method: AuditScanMethod,
  ) {
    if (!audit || audit.status !== 'in_progress') {
      return
    }

    try {
      setScanning(true)
      setErrorMessage(null)

      const result = await registerAuditScan({
        auditId: audit.id,
        scannedValue: value,
        observedUnitId: audit.unit_id,
        observedEnvironmentId:
          observedEnvironmentId || null,
        scanMethod: method,
      })

      setLastScan(result)

      const [newItems, newEvents] =
        await Promise.all([
          listAuditItems(audit.id),
          listAuditScanEvents(audit.id),
        ])

      setItems(newItems)
      setEvents(newEvents)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a leitura.',
      )
    } finally {
      setScanning(false)
    }
  }

  if (loading && !audit) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <RefreshCw
          size={18}
          className="animate-spin text-slate-400"
        />
      </div>
    )
  }

  if (!audit) {
    return (
      <div className="space-y-4">
        <Link
          to="/auditorias"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={15} />
          Auditorias
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {errorMessage ??
            'Auditoria não encontrada.'}
        </div>
      </div>
    )
  }

  const unit = unitMap.get(audit.unit_id)
  const environment = environmentMap.get(
    audit.environment_id ?? '',
  )
  const executionEnabled =
    audit.status === 'in_progress' &&
    hasPermission('audits.execute')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/auditorias"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Auditorias
          </Link>

          <div className="mt-3 font-mono text-[10px] font-bold text-slate-400">
            {audit.audit_code}
          </div>

          <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] text-slate-950 sm:text-2xl">
            {audit.title}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <MapPin size={13} />
            <span>
              {environment?.name ??
                unit?.name ??
                'Escopo'}
            </span>
            {environment && unit && (
              <span>· {unit.name}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"
          >
            <RefreshCw
              size={15}
              className={
                loading ? 'animate-spin' : undefined
              }
            />
          </button>

          {audit.status === 'in_progress' &&
            hasPermission('audits.close') && (
              <>
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setCloseOpen(true)}
                  className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white"
                >
                  Fechar auditoria
                </button>
              </>
            )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {audit.status !== 'in_progress' && (
        <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
          Auditoria{' '}
          {audit.status === 'closed'
            ? 'fechada'
            : 'cancelada'}
          . As leituras estão em modo consulta.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-900">
              Progresso
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {progress.checked} de {progress.expected}{' '}
              ativos esperados conferidos
            </div>
          </div>
          <div className="text-xl font-black tracking-[-0.04em] text-slate-950">
            {progress.percentage}%
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-950 transition-all"
            style={{
              width: `${progress.percentage}%`,
            }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Counter
            label="Pendente"
            value={counts.pending}
          />
          <Counter
            label="Conferido"
            value={counts.found}
          />
          <Counter
            label="Ausente"
            value={counts.missing}
          />
          <Counter
            label="Divergente"
            value={counts.divergent}
          />
          <Counter
            label="Extra"
            value={counts.extra}
          />
          <Counter
            label="Desconhecido"
            value={unknownCount}
          />
        </div>
      </section>

      {audit.status === 'in_progress' && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Local onde você está conferindo
              </span>

              {audit.environment_id ? (
                <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                  {environment?.name ??
                    'Ambiente da auditoria'}
                </div>
              ) : (
                <select
                  value={observedEnvironmentId}
                  onChange={(event) =>
                    setObservedEnvironmentId(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="">
                    Somente unidade / sem ambiente
                  </option>
                  {scopeEnvironments.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                      </option>
                    ),
                  )}
                </select>
              )}
            </label>
          </section>

          <AuditScanner
            disabled={!executionEnabled || scanning}
            onScan={handleScan}
          />

          {lastScan && (
            <LastScanCard
              scan={lastScan}
              asset={
                lastScan.asset_id
                  ? assetMap.get(lastScan.asset_id)
                  : undefined
              }
            />
          )}
        </>
      )}

      <EvidencePanel
        context={{
          auditId: audit.id,
        }}
        canUpload={executionEnabled}
        canManage={executionEnabled}
        defaultCategory="audit"
        categoryOptions={[
          'audit',
          'other',
        ]}
        title="Evidências da auditoria"
        description="Fotos e documentos gerais deste ciclo de auditoria."
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'Todos'],
                ['pending', 'Pendentes'],
                ['found', 'Conferidos'],
                ['missing', 'Ausentes'],
                ['divergent', 'Divergentes'],
                ['extra', 'Extras'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`h-8 rounded-xl px-3 text-[10px] font-bold ${
                  filter === value
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative mt-3">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-sky-400 focus:bg-white"
              placeholder="Buscar código, serial ou modelo"
            />
          </div>
        </header>

        {filteredItems.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            Nenhum item neste filtro.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const asset = assetMap.get(item.asset_id)
              const expectedEnvironment =
                environmentMap.get(
                  item.expected_environment_id ?? '',
                )
              const observedEnvironment =
                environmentMap.get(
                  item.observed_environment_id ?? '',
                )

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    executionEnabled
                      ? setNoteItem(item)
                      : undefined
                  }
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50"
                >
                  <ResultIcon result={item.result} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-800">
                        {asset?.asset_code ??
                          item.asset_id}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${resultClass[item.result]}`}
                      >
                        {resultLabels[item.result]}
                      </span>
                      {!item.expected && (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                          não esperado
                        </span>
                      )}
                    </div>

                    <div className="mt-1 truncate text-xs font-semibold text-slate-600">
                      {[
                        asset?.manufacturer,
                        asset?.model,
                        asset?.serial_number,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Sem detalhes'}
                    </div>

                    <div className="mt-1 truncate text-[10px] text-slate-400">
                      Esperado:{' '}
                      {expectedEnvironment?.name ??
                        unitMap.get(
                          item.expected_unit_id ?? '',
                        )?.name ??
                        'sem local'}
                      {item.observed_unit_id && (
                        <>
                          {' '}
                          · Observado:{' '}
                          {observedEnvironment?.name ??
                            unitMap.get(
                              item.observed_unit_id,
                            )?.name ??
                            'sem ambiente'}
                        </>
                      )}
                    </div>

                    {item.notes && (
                      <div className="mt-1 truncate text-[10px] italic text-slate-500">
                        {item.notes}
                      </div>
                    )}
                  </div>

                  {executionEnabled && (
                    <MoreHorizontal
                      size={16}
                      className="shrink-0 text-slate-300"
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-4 py-3">
          <div className="text-xs font-bold text-slate-900">
            Leituras recentes
          </div>
        </header>

        {events.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-400">
            Nenhuma leitura registrada.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.slice(0, 15).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[11px] font-bold text-slate-700">
                    {event.scanned_value}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {event.scan_method} ·{' '}
                    {new Date(
                      event.scanned_at,
                    ).toLocaleString('pt-BR')}
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                    event.result === 'found'
                      ? 'bg-emerald-50 text-emerald-700'
                      : event.result === 'divergent'
                        ? 'bg-amber-50 text-amber-700'
                        : event.result === 'extra'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-red-50 text-red-700'
                  }`}
                >
                  {event.result}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <CloseAuditModal
        open={closeOpen}
        audit={audit}
        counts={counts}
        unknownCount={unknownCount}
        onClose={() => setCloseOpen(false)}
        onDone={() => void refresh()}
      />

      <CancelAuditModal
        open={cancelOpen}
        audit={audit}
        onClose={() => setCancelOpen(false)}
        onDone={() => void refresh()}
      />

      <AuditItemNoteModal
        item={noteItem}
        asset={
          noteItem
            ? assetMap.get(noteItem.asset_id)
            : undefined
        }
        auditId={audit.id}
        canUpload={executionEnabled}
        onClose={() => setNoteItem(null)}
        onSaved={() => void refresh()}
      />
    </div>
  )
}

function Counter({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5 text-center">
      <div className="text-base font-black text-slate-950">
        {value}
      </div>
      <div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </div>
    </div>
  )
}

function ResultIcon({
  result,
}: {
  result: AuditItemResult
}) {
  const base =
    'grid size-9 shrink-0 place-items-center rounded-xl'

  if (result === 'found') {
    return (
      <div
        className={`${base} bg-emerald-50 text-emerald-600`}
      >
        <Check size={16} />
      </div>
    )
  }

  if (result === 'missing') {
    return (
      <div
        className={`${base} bg-red-50 text-red-600`}
      >
        <XCircle size={16} />
      </div>
    )
  }

  if (result === 'divergent') {
    return (
      <div
        className={`${base} bg-amber-50 text-amber-600`}
      >
        <AlertTriangle size={16} />
      </div>
    )
  }

  if (result === 'extra') {
    return (
      <div
        className={`${base} bg-violet-50 text-violet-600`}
      >
        <ShieldAlert size={16} />
      </div>
    )
  }

  return (
    <div
      className={`${base} bg-slate-100 text-slate-400`}
    >
      <CircleDashed size={16} />
    </div>
  )
}

function LastScanCard({
  scan,
  asset,
}: {
  scan: AuditScanResponse
  asset?: AssetRecord
}) {
  const positive = scan.result === 'found'

  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm ${
        positive
          ? 'border-emerald-200 bg-emerald-50'
          : scan.result === 'divergent'
            ? 'border-amber-200 bg-amber-50'
            : scan.result === 'extra'
              ? 'border-violet-200 bg-violet-50'
              : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid size-10 place-items-center rounded-xl ${
            positive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-white/70 text-slate-600'
          }`}
        >
          {positive ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}
        </div>

        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            Última leitura · {scan.result}
          </div>
          <div className="mt-1 font-mono text-sm font-black text-slate-950">
            {scan.asset_code}
          </div>
          {asset && (
            <div className="mt-1 truncate text-xs text-slate-600">
              {[asset.manufacturer, asset.model]
                .filter(Boolean)
                .join(' ')}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CloseAuditModal({
  open,
  audit,
  counts,
  unknownCount,
  onClose,
  onDone,
}: {
  open: boolean
  audit: AuditCycleRecord
  counts: Record<AuditItemResult, number>
  unknownCount: number
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setNotes('')
      setErrorMessage(null)
    })
  }, [open])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await closePhysicalAudit(audit.id, notes)

      onClose()
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível fechar a auditoria.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Fechar auditoria"
      description="Todos os ativos esperados ainda pendentes serão marcados como ausentes."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Voltar
          </button>
          <button
            type="submit"
            form="close-audit-form"
            disabled={saving}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving
              ? 'Fechando...'
              : 'Confirmar fechamento'}
          </button>
        </div>
      }
    >
      <form
        id="close-audit-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Counter
            label="Conferido"
            value={counts.found}
          />
          <Counter
            label="Pendente → Ausente"
            value={counts.pending}
          />
          <Counter
            label="Divergente"
            value={counts.divergent}
          />
          <Counter
            label="Extra"
            value={counts.extra}
          />
          <Counter
            label="Desconhecido"
            value={unknownCount}
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Observações de fechamento
          </span>
          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </label>
      </form>
    </FormModal>
  )
}

function CancelAuditModal({
  open,
  audit,
  onClose,
  onDone,
}: {
  open: boolean
  audit: AuditCycleRecord
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setReason('')
      setErrorMessage(null)
    })
  }, [open])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await cancelPhysicalAudit(
        audit.id,
        reason,
      )

      onClose()
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível cancelar a auditoria.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Cancelar auditoria"
      description="O histórico será preservado e o ciclo ficará somente para consulta."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Voltar
          </button>
          <button
            type="submit"
            form="cancel-audit-form"
            disabled={saving || !reason.trim()}
            className="h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving
              ? 'Cancelando...'
              : 'Confirmar cancelamento'}
          </button>
        </div>
      }
    >
      <form
        id="cancel-audit-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Justificativa
          </span>
          <textarea
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            required
          />
        </label>
      </form>
    </FormModal>
  )
}

function AuditItemNoteModal({
  item,
  asset,
  auditId,
  canUpload,
  onClose,
  onSaved,
}: {
  item: AuditItemRecord | null
  asset?: AssetRecord
  auditId: string
  canUpload: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!item) return

    queueMicrotask(() => {
      setNotes(item.notes ?? '')
      setErrorMessage(null)
    })
  }, [item])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!item) {
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      await updateAuditItemNote(
        item.id,
        notes,
      )

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a observação.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={Boolean(item)}
      title="Observação do item"
      description={
        asset?.asset_code ?? item?.asset_id
      }
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="audit-item-note-form"
            disabled={saving}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      }
    >
      <form
        id="audit-item-note-form"
        onSubmit={submit}
      >
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <textarea
          value={notes}
          onChange={(event) =>
            setNotes(event.target.value)
          }
          className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          placeholder="Observação técnica sobre este item."
        />
      </form>

      {item && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <EvidencePanel
            context={{
              auditId,
              auditItemId: item.id,
            }}
            canUpload={canUpload}
            canManage={canUpload}
            defaultCategory="audit"
            categoryOptions={[
              'audit',
              'other',
            ]}
            title="Evidências deste item"
            description="Fotos vinculadas diretamente ao item conferido."
            compact
          />
        </div>
      )}
    </FormModal>
  )
}