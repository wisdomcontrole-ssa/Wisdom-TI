import {
  AlertCircle,
  Boxes,
  ClipboardCheck,
  Laptop,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusPill } from '../components/ui/StatusPill'
import {
  getDashboardSummary,
} from '../data/m10-service'
import type {
  DashboardSummary,
} from '../types/m10'

export function DashboardPage() {
  const [summary, setSummary] =
    useState<DashboardSummary | null>(null)
  const [loading, setLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data =
          await getDashboardSummary()

        if (active) {
          setSummary(data)
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o dashboard.',
          )
        }
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
      setSummary(
        await getDashboardSummary(),
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o dashboard.',
      )
    } finally {
      setLoading(false)
    }
  }

  const cards = useMemo(
    () =>
      summary
        ? [
            {
              label: 'Ativos controlados',
              value: summary.assets.total,
              detail: `${summary.assets.active} em operação`,
              icon: Laptop,
              to: '/patrimonio',
            },
            {
              label: 'Estoque disponível',
              value: summary.stock.in_stock,
              detail: `${summary.stock.installed} componentes instalados`,
              icon: Boxes,
              to: '/estoque',
            },
            {
              label: 'Manutenções ativas',
              value:
                summary.maintenance.active,
              detail: `${summary.maintenance.critical} críticas`,
              icon: Wrench,
              to: '/manutencoes',
            },
            {
              label: 'Auditorias em curso',
              value:
                summary.audits.in_progress,
              detail: `${summary.audits.missing_items} itens ausentes`,
              icon: ClipboardCheck,
              to: '/auditorias',
            },
            {
              label: 'Alertas abertos',
              value: summary.alerts.open,
              detail: `${summary.alerts.critical} críticos`,
              icon: ShieldAlert,
              to: '/alertas',
            },
            {
              label: 'Agentes online',
              value: summary.agents.online,
              detail: `${summary.agents.offline} offline`,
              icon: Wifi,
              to: '/alertas',
            },
          ]
        : [],
    [summary],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Visão geral"
        description="Indicadores reais do patrimônio, estoque, auditorias, manutenção, alertas e agentes."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />
            Atualizar
          </button>
        }
      />

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={17} />
          {errorMessage}
        </div>
      )}

      {loading && !summary ? (
        <div className="grid min-h-72 place-items-center">
          <RefreshCw
            size={20}
            className="animate-spin text-slate-400"
          />
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {cards.map((card) => {
              const Icon = card.icon

              return (
                <Link
                  key={card.label}
                  to={card.to}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon size={16} />
                  </div>
                  <div className="mt-5 text-2xl font-black tracking-[-0.04em] text-slate-950">
                    {card.value}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-800">
                    {card.label}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">
                    {card.detail}
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard>
              <SectionTitle
                title="Saúde operacional"
                detail="Situações que exigem atenção."
              />
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <HealthItem
                  label="Agentes offline"
                  value={summary.agents.offline}
                  critical={
                    summary.agents.offline > 0
                  }
                  icon={WifiOff}
                />
                <HealthItem
                  label="Divergências abertas"
                  value={
                    summary.agents
                      .open_divergences
                  }
                  critical={
                    summary.agents
                      .open_divergences > 0
                  }
                  icon={ShieldAlert}
                />
                <HealthItem
                  label="Ativos sem localização"
                  value={
                    summary.assets
                      .without_location
                  }
                  critical={
                    summary.assets
                      .without_location > 0
                  }
                  icon={Laptop}
                />
                <HealthItem
                  label="Auditoria divergente"
                  value={
                    summary.audits
                      .divergent_items
                  }
                  critical={
                    summary.audits
                      .divergent_items > 0
                  }
                  icon={ClipboardCheck}
                />
              </div>
            </SectionCard>

            <SectionCard>
              <SectionTitle
                title="Alertas recentes"
                detail="Últimos eventos do monitoramento."
              />
              {summary.recent_alerts.length ===
              0 ? (
                <EmptyText text="Nenhum alerta registrado." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {summary.recent_alerts.map(
                    (alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 px-5 py-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-xs font-bold text-slate-800">
                              {alert.title}
                            </span>
                            <StatusPill
                              tone={
                                alert.severity ===
                                'critical'
                                  ? 'danger'
                                  : alert.severity ===
                                      'warning'
                                    ? 'warning'
                                    : 'info'
                              }
                            >
                              {alert.severity}
                            </StatusPill>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400">
                            {alert.asset_code ??
                              'Sistema'}{' '}
                            ·{' '}
                            {new Date(
                              alert.detected_at,
                            ).toLocaleString(
                              'pt-BR',
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard>
            <SectionTitle
              title="Manutenções recentes"
              detail="Últimas ordens registradas."
            />
            {summary.recent_maintenance.length ===
            0 ? (
              <EmptyText text="Nenhuma manutenção registrada." />
            ) : (
              <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-3">
                {summary.recent_maintenance.map(
                  (item) => (
                    <Link
                      key={item.id}
                      to={`/manutencoes/${item.id}`}
                      className="bg-white p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          {
                            item.maintenance_code
                          }
                        </span>
                        <StatusPill
                          tone={
                            item.priority ===
                            'critical'
                              ? 'danger'
                              : item.priority ===
                                  'high'
                                ? 'warning'
                                : 'info'
                          }
                        >
                          {item.priority}
                        </StatusPill>
                      </div>
                      <div className="mt-2 text-xs font-bold text-slate-800">
                        {item.asset_code}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {item.status} ·{' '}
                        {new Date(
                          item.opened_at,
                        ).toLocaleString(
                          'pt-BR',
                        )}
                      </div>
                    </Link>
                  ),
                )}
              </div>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}

function SectionTitle({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4">
      <div className="text-sm font-bold text-slate-900">
        {title}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400">
        {detail}
      </div>
    </div>
  )
}

function HealthItem({
  label,
  value,
  critical,
  icon: Icon,
}: {
  label: string
  value: number
  critical: boolean
  icon: typeof Wifi
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
      <div
        className={
          critical
            ? 'grid size-9 place-items-center rounded-xl bg-red-50 text-red-500'
            : 'grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-500'
        }
      >
        <Icon size={15} />
      </div>
      <div>
        <div className="text-lg font-black text-slate-900">
          {value}
        </div>
        <div className="text-[10px] text-slate-500">
          {label}
        </div>
      </div>
    </div>
  )
}

function EmptyText({
  text,
}: {
  text: string
}) {
  return (
    <div className="p-8 text-center text-xs text-slate-400">
      {text}
    </div>
  )
}
