import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  Link,
  useNavigate,
} from 'react-router'
import { useAuth } from '../auth/useAuth'
import { FormModal } from '../components/ui/FormModal'
import { PageHeader } from '../components/ui/PageHeader'
import {
  createPhysicalAudit,
  listAuditCycles,
} from '../data/audit-service'
import {
  listEnvironments,
  listUnits,
} from '../data/asset-service'
import type {
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'
import type {
  AuditCycleRecord,
  AuditStatus,
} from '../types/audit'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const statusLabels: Record<AuditStatus, string> = {
  in_progress: 'Em andamento',
  closed: 'Fechada',
  cancelled: 'Cancelada',
}

const statusClass: Record<AuditStatus, string> = {
  in_progress: 'bg-sky-50 text-sky-700',
  closed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-600',
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}

export function AuditsPage() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()

  const [audits, setAudits] =
    useState<AuditCycleRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] =
    useState(false)

  async function fetchData() {
    const [auditRows, unitRows, environmentRows] =
      await Promise.all([
        listAuditCycles(),
        listUnits(),
        listEnvironments(),
      ])

    return {
      auditRows,
      unitRows,
      environmentRows,
    }
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data = await fetchData()

        if (!active) {
          return
        }

        setAudits(data.auditRows)
        setUnits(data.unitRows)
        setEnvironments(data.environmentRows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as auditorias.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await fetchData()

      setAudits(data.auditRows)
      setUnits(data.unitRows)
      setEnvironments(data.environmentRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar as auditorias.',
      )
    } finally {
      setLoading(false)
    }
  }

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) {
      return audits
    }

    return audits.filter((audit) =>
      [
        audit.audit_code,
        audit.title,
        unitMap.get(audit.unit_id)?.name,
        environmentMap.get(
          audit.environment_id ?? '',
        )?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [audits, environmentMap, search, unitMap])

  const inProgress = audits.filter(
    (audit) => audit.status === 'in_progress',
  ).length

  const closed = audits.filter(
    (audit) => audit.status === 'closed',
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conferência"
        title="Auditorias"
        description="Ciclos físicos por unidade ou ambiente, com leitura de QR."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <RefreshCw
                size={15}
                className={
                  loading ? 'animate-spin' : undefined
                }
              />
              Atualizar
            </button>

            {hasPermission('audits.create') && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm"
              >
                <Plus size={15} />
                Nova auditoria
              </button>
            )}
          </div>
        }
      />

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={ClipboardCheck}
          label="Total"
          value={audits.length}
        />
        <MetricCard
          icon={CalendarClock}
          label="Em andamento"
          value={inProgress}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Fechadas"
          value={closed}
        />
      </div>

      <div className="relative max-w-xl">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          placeholder="Buscar auditoria, unidade ou ambiente"
        />
      </div>

      {loading ? (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white">
          <RefreshCw
            size={18}
            className="animate-spin text-slate-400"
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div>
            <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
              <ClipboardCheck size={19} />
            </div>
            <div className="mt-4 text-sm font-bold text-slate-900">
              Nenhuma auditoria encontrada
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((audit) => {
            const unit = unitMap.get(audit.unit_id)
            const environment = environmentMap.get(
              audit.environment_id ?? '',
            )

            return (
              <Link
                key={audit.id}
                to={`/auditorias/${audit.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-5"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                  <ClipboardCheck size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      {audit.audit_code}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusClass[audit.status]}`}
                    >
                      {statusLabels[audit.status]}
                    </span>
                  </div>

                  <div className="mt-1 truncate text-sm font-bold text-slate-950">
                    {audit.title}
                  </div>

                  <div className="mt-1 truncate text-xs text-slate-500">
                    {environment?.name ??
                      unit?.name ??
                      'Escopo não localizado'}
                    {environment && unit
                      ? ` · ${unit.name}`
                      : ''}
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400">
                    Início{' '}
                    {new Date(
                      audit.started_at,
                    ).toLocaleString('pt-BR')}
                  </div>
                </div>

                <ChevronRight
                  size={17}
                  className="shrink-0 text-slate-300 transition group-hover:text-slate-500"
                />
              </Link>
            )
          })}
        </div>
      )}

      <CreateAuditModal
        open={createOpen}
        units={units.filter((unit) => unit.active)}
        environments={environments.filter(
          (environment) => environment.active,
        )}
        onClose={() => setCreateOpen(false)}
        onCreated={(auditId) => {
          setCreateOpen(false)
          navigate(`/auditorias/${auditId}`)
        }}
      />
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck
  label: string
  value: number
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
        <Icon size={16} />
      </div>
      <div className="mt-4 text-2xl font-bold tracking-[-0.04em] text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs font-bold text-slate-700">
        {label}
      </div>
    </section>
  )
}

function CreateAuditModal({
  open,
  units,
  environments,
  onClose,
  onCreated,
}: {
  open: boolean
  units: UnitRecord[]
  environments: EnvironmentRecord[]
  onClose: () => void
  onCreated: (auditId: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [unitId, setUnitId] = useState('')
  const [environmentId, setEnvironmentId] =
    useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    queueMicrotask(() => {
      setTitle('')
      setUnitId(units[0]?.id ?? '')
      setEnvironmentId('')
      setNotes('')
      setErrorMessage(null)
    })
  }, [open, units])

  const filteredEnvironments = environments.filter(
    (environment) =>
      environment.unit_id === unitId,
  )

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      const result = await createPhysicalAudit({
        title,
        unitId,
        environmentId: environmentId || null,
        notes,
      })

      onCreated(result.audit_id)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a auditoria.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Nova auditoria"
      description="O banco registrará um snapshot dos ativos esperados no escopo escolhido."
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
            form="create-audit-form"
            disabled={
              saving || !title.trim() || !unitId
            }
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Criando...' : 'Iniciar auditoria'}
          </button>
        </div>
      }
    >
      <form
        id="create-audit-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Título">
          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            className={inputClass}
            placeholder="Auditoria Laboratório 01"
            required
          />
        </Field>

        <Field label="Unidade">
          <select
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value)
              setEnvironmentId('')
            }}
            className={inputClass}
            required
          >
            {units.map((unit) => (
              <option
                key={unit.id}
                value={unit.id}
              >
                {unit.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ambiente">
          <select
            value={environmentId}
            onChange={(event) =>
              setEnvironmentId(
                event.target.value,
              )
            }
            className={inputClass}
          >
            <option value="">
              Toda a unidade
            </option>
            {filteredEnvironments.map(
              (environment) => (
                <option
                  key={environment.id}
                  value={environment.id}
                >
                  {environment.name}
                </option>
              ),
            )}
          </select>
        </Field>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </Field>
      </form>
    </FormModal>
  )
}
