import {
  AlertTriangle,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Wrench,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { MaintenanceCreateModal } from '../components/maintenance/MaintenanceCreateModal'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusPill } from '../components/ui/StatusPill'
import { listAssets } from '../data/asset-service'
import { listMaintenanceOrders } from '../data/maintenance-service'
import type { AssetRecord } from '../types/assets'
import type {
  MaintenanceOrderRecord,
  MaintenanceStatus,
} from '../types/maintenance'

const statusLabels: Record<MaintenanceStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  waiting_parts: 'Aguardando peça',
  external: 'Externa',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const statusTone: Record<
  MaintenanceStatus,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  open: 'info',
  in_progress: 'warning',
  waiting_parts: 'warning',
  external: 'info',
  completed: 'success',
  cancelled: 'danger',
}

type StatusFilter = MaintenanceStatus | 'all' | 'active'

const activeStatuses: MaintenanceStatus[] = [
  'open',
  'in_progress',
  'waiting_parts',
  'external',
]

export function MaintenancePage() {
  const navigate = useNavigate()
  const { access, hasPermission } = useAuth()

  const [orders, setOrders] = useState<MaintenanceOrderRecord[]>([])
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [createOpen, setCreateOpen] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const [orderRows, assetRows] = await Promise.all([
        listMaintenanceOrders(),
        listAssets(),
      ])

      setOrders(orderRows)
      setAssets(assetRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar as manutenções.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const [orderRows, assetRows] = await Promise.all([
          listMaintenanceOrders(),
          listAssets(),
        ])

        if (!active) {
          return
        }

        setOrders(orderRows)
        setAssets(assetRows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as manutenções.',
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

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  )

  const metrics = useMemo(() => {
    const active = orders.filter((order) =>
      activeStatuses.includes(order.status),
    ).length

    const critical = orders.filter(
      (order) =>
        activeStatuses.includes(order.status) &&
        order.priority === 'critical',
    ).length

    const waiting = orders.filter(
      (order) => order.status === 'waiting_parts',
    ).length

    const external = orders.filter(
      (order) => order.status === 'external',
    ).length

    return { active, critical, waiting, external }
  }, [orders])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return orders.filter((order) => {
      if (
        status === 'active' &&
        !activeStatuses.includes(order.status)
      ) {
        return false
      }

      if (
        status !== 'all' &&
        status !== 'active' &&
        order.status !== status
      ) {
        return false
      }

      if (!term) {
        return true
      }

      const asset = assetMap.get(order.asset_id)

      return [
        order.maintenance_code,
        order.symptom,
        order.diagnosis,
        order.provider_name,
        asset?.asset_code,
        asset?.manufacturer,
        asset?.model,
        asset?.serial_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [assetMap, orders, search, status])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação técnica"
        title="Manutenções"
        description="Ordens de serviço, diagnóstico, custos, peças, evidências e ciclo de vida dos ativos."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm disabled:opacity-40"
              aria-label="Atualizar"
            >
              <RefreshCw
                size={15}
                className={loading ? 'animate-spin' : undefined}
              />
            </button>

            {hasPermission('assets.update') && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm"
              >
                <Plus size={15} />
                Nova manutenção
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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={<Wrench size={16} />}
          label="Ativas"
          value={metrics.active}
        />
        <MetricCard
          icon={<AlertTriangle size={16} />}
          label="Críticas"
          value={metrics.critical}
        />
        <MetricCard
          icon={<Clock3 size={16} />}
          label="Aguardando peça"
          value={metrics.waiting}
        />
        <MetricCard
          icon={<Truck size={16} />}
          label="Externas"
          value={metrics.external}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              placeholder="Buscar ordem, patrimônio, defeito ou fornecedor"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as StatusFilter)
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none"
          >
            <option value="active">Manutenções ativas</option>
            <option value="all">Todos os status</option>
            <option value="open">Aberta</option>
            <option value="in_progress">Em andamento</option>
            <option value="waiting_parts">Aguardando peça</option>
            <option value="external">Externa</option>
            <option value="completed">Concluída</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Ordens de manutenção
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {filtered.length} registros exibidos
            </p>
          </div>
        </header>

        {loading && orders.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-10 text-sm font-semibold text-slate-400">
            <RefreshCw size={16} className="animate-spin" />
            Carregando manutenções
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Nenhuma manutenção encontrada neste filtro.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((order) => {
              const asset = assetMap.get(order.asset_id)

              return (
                <Link
                  key={order.id}
                  to={`/manutencoes/${order.id}`}
                  className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 md:grid-cols-[150px_1fr_150px_130px] md:items-center"
                >
                  <div>
                    <div className="font-mono text-[11px] font-black text-slate-700">
                      {order.maintenance_code}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {new Date(order.opened_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-sky-700">
                        {asset?.asset_code ?? order.asset_id}
                      </span>
                      {order.priority === 'critical' && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">
                          CRÍTICA
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-800">
                      {order.symptom}
                    </div>
                    <div className="mt-1 truncate text-[10px] text-slate-400">
                      {[asset?.manufacturer, asset?.model]
                        .filter(Boolean)
                        .join(' ') || 'Ativo controlado'}
                    </div>
                  </div>

                  <StatusPill tone={statusTone[order.status]}>
                    {statusLabels[order.status]}
                  </StatusPill>

                  <div className="text-left md:text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      Custos serviço
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-800">
                      {Number(order.total_cost ?? 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <MaintenanceCreateModal
        open={createOpen}
        assets={assets}
        currentUserId={access?.profile.id ?? null}
        onClose={() => setCreateOpen(false)}
        onCreated={(maintenanceId) => {
          setCreateOpen(false)
          navigate(`/manutencoes/${maintenanceId}`)
        }}
      />
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">
        {value}
      </div>
    </div>
  )
}