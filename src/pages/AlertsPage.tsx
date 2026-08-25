import { CircleAlert } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusPill } from '../components/ui/StatusPill'
import { alerts } from '../data/mock'

export function AlertsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monitoramento"
        title="Alertas"
        description="Divergências de inventário e saúde detectadas pelo ambiente."
      />
      <SectionCard>
        <div className="divide-y divide-slate-100">
          {alerts.map((alert) => (
            <button key={alert.id} className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 sm:p-5">
              <div
                className={
                  alert.severity === 'critical'
                    ? 'grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600'
                    : alert.severity === 'warning'
                      ? 'grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600'
                      : 'grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600'
                }
              >
                <CircleAlert size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{alert.title}</span>
                  <StatusPill
                    tone={
                      alert.severity === 'critical'
                        ? 'danger'
                        : alert.severity === 'warning'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {alert.severity === 'critical' ? 'Crítico' : alert.severity === 'warning' ? 'Atenção' : 'Informação'}
                  </StatusPill>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{alert.description}</p>
                <div className="mt-2 text-[10px] text-slate-400">
                  {alert.assetCode} · {alert.assetName} · {alert.location} · {alert.detectedAt}
                </div>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}