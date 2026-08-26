import { AlertCircle, CheckCircle2, CircleAlert, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { FormModal } from '../components/ui/FormModal'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusPill } from '../components/ui/StatusPill'
import { listSystemAlerts, updateSystemAlertStatus } from '../data/agent-service'
import { listAssets } from '../data/asset-service'
import type { AlertStatus, SystemAlertRecord } from '../types/agent'
import type { AssetRecord } from '../types/assets'

const inputClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

export function AlertsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('alerts.manage')
  const [alerts, setAlerts] = useState<SystemAlertRecord[]>([])
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('open')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all')
  const [action, setAction] = useState<{ alert: SystemAlertRecord; status: AlertStatus } | null>(null)

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const [alertRows, assetRows] = await Promise.all([listSystemAlerts(), listAssets()])
        if (!active) return
        setAlerts(alertRows)
        setAssets(assetRows)
      } catch (error) {
        if (!active) return
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar alertas.')
      } finally { if (active) setLoading(false) }
    }
    void bootstrap()
    return () => { active = false }
  }, [])

  async function refresh() {
    try {
      setLoading(true); setErrorMessage(null)
      const [alertRows, assetRows] = await Promise.all([listSystemAlerts(), listAssets()])
      setAlerts(alertRows); setAssets(assetRows)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar alertas.')
    } finally { setLoading(false) }
  }

  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return alerts.filter((alert) => {
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
      if (!clean) return true
      const asset = alert.asset_id ? assetMap.get(alert.asset_id) : null
      return [alert.title, alert.description, alert.category, alert.severity, asset?.asset_code ?? '', asset?.hostname ?? '', asset?.serial_number ?? ''].join(' ').toLowerCase().includes(clean)
    })
  }, [alerts, assetMap, query, severityFilter, statusFilter])

  const openCount = alerts.filter((a) => a.status === 'open').length
  const criticalCount = alerts.filter((a) => a.status !== 'resolved' && a.severity === 'critical').length
  const acknowledgedCount = alerts.filter((a) => a.status === 'acknowledged').length

  return <div className="space-y-6">
    <PageHeader eyebrow="Monitoramento" title="Alertas" description="Divergências reais de inventário, saúde e comunicação dos agentes Windows."
      actions={<button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Atualizar</button>} />

    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Abertos" value={openCount} icon={CircleAlert} /><Metric label="Críticos" value={criticalCount} icon={AlertCircle} /><Metric label="Reconhecidos" value={acknowledgedCount} icon={ShieldCheck} /></div>

    <SectionCard>
      <div className="border-b border-slate-100 p-4 sm:p-5"><div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alerta, ativo, hostname ou serial" className={`${inputClass} pl-9`} /></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AlertStatus | 'all')} className={inputClass}><option value="all">Todos os status</option><option value="open">Abertos</option><option value="acknowledged">Reconhecidos</option><option value="resolved">Resolvidos</option></select>
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)} className={inputClass}><option value="all">Todas severidades</option><option value="critical">Crítico</option><option value="warning">Atenção</option><option value="info">Informação</option></select>
      </div></div>

      {errorMessage ? <div className="flex items-start gap-3 p-5 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{errorMessage}</div> :
       loading && alerts.length === 0 ? <div className="grid min-h-52 place-items-center"><RefreshCw size={18} className="animate-spin text-slate-400" /></div> :
       filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">Nenhum alerta neste filtro.</div> :
       <div className="divide-y divide-slate-100">{filtered.map((alert) => {
         const asset = alert.asset_id ? assetMap.get(alert.asset_id) : null
         return <div key={alert.id} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start">
           <div className={alert.severity === 'critical' ? 'grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600' : alert.severity === 'warning' ? 'grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600' : 'grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600'}><CircleAlert size={17} /></div>
           <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-900">{alert.title}</span><StatusPill tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}>{severityLabel(alert.severity)}</StatusPill><StatusPill tone={alert.status === 'resolved' ? 'success' : alert.status === 'acknowledged' ? 'info' : 'warning'}>{statusLabel(alert.status)}</StatusPill></div><p className="mt-1 text-xs leading-5 text-slate-500">{alert.description}</p><div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-slate-400"><span>{asset?.asset_code ?? 'Sem ativo'}</span>{asset?.hostname && <span>· {asset.hostname}</span>}<span>· {categoryLabel(alert.category)}</span><span>· {new Date(alert.detected_at).toLocaleString('pt-BR')}</span></div></div>
           {canManage && alert.status !== 'resolved' && <div className="flex shrink-0 gap-2">{alert.status === 'open' && <button type="button" onClick={() => setAction({ alert, status: 'acknowledged' })} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600">Reconhecer</button>}<button type="button" onClick={() => setAction({ alert, status: 'resolved' })} className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white"><CheckCircle2 size={13} />Resolver</button></div>}
         </div>
       })}</div>}
    </SectionCard>
    {action && <AlertActionModal action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); void refresh() }} />}
  </div>
}

function AlertActionModal({ action, onClose, onDone }: { action: { alert: SystemAlertRecord; status: AlertStatus }; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (action.status === 'resolved' && !note.trim()) { setErrorMessage('Informe como o alerta foi resolvido.'); return }
    try { setSaving(true); setErrorMessage(null); await updateSystemAlertStatus(action.alert.id, action.status, note); onDone() }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Não foi possível tratar o alerta.') }
    finally { setSaving(false) }
  }
  return <FormModal open title={action.status === 'resolved' ? 'Resolver alerta' : 'Reconhecer alerta'} description={action.alert.title} onClose={onClose}
    footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600">Cancelar</button><button type="submit" form="alert-action-form" disabled={saving} className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar'}</button></div>}>
    <form id="alert-action-form" onSubmit={submit} className="space-y-3">{errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</div>}<label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{action.status === 'resolved' ? 'Resolução' : 'Observação'}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" /></label></form>
  </FormModal>
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CircleAlert }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400"><Icon size={14} />{label}</div><div className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{value}</div></div>
}
function severityLabel(value: SystemAlertRecord['severity']) { return value === 'critical' ? 'Crítico' : value === 'warning' ? 'Atenção' : 'Informação' }
function statusLabel(value: SystemAlertRecord['status']) { return value === 'resolved' ? 'Resolvido' : value === 'acknowledged' ? 'Reconhecido' : 'Aberto' }
function categoryLabel(value: SystemAlertRecord['category']) { return ({ connectivity: 'Comunicação', identity: 'Identidade', hardware: 'Hardware', software: 'Software', health: 'Saúde' } as const)[value] }
