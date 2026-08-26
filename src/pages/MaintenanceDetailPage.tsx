import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Edit3,
  ExternalLink,
  History,
  Link2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { EvidencePanel } from '../components/evidence/EvidencePanel'
import { FormModal } from '../components/ui/FormModal'
import { StatusPill } from '../components/ui/StatusPill'
import { getAssetById } from '../data/asset-service'
import {
  addMaintenancePart,
  cancelMaintenanceOrder,
  completeMaintenanceOrder,
  getMaintenanceOrder,
  listMaintenanceEvents,
  listMaintenanceParts,
  removeMaintenancePart,
  updateMaintenanceOrder,
} from '../data/maintenance-service'
import {
  changeStockUnitStatus,
  installStockUnit,
  listStockProducts,
  listStockUnits,
  removeStockUnit,
} from '../data/stock-service'
import type { AssetRecord } from '../types/assets'
import type {
  MaintenanceEventRecord,
  MaintenanceOrderRecord,
  MaintenancePartAction,
  MaintenancePartRecord,
  MaintenancePriority,
  MaintenanceStatus,
} from '../types/maintenance'
import type {
  StockProductRecord,
  StockUnitRecord,
} from '../types/stock'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

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

const priorityLabels: Record<MaintenancePriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  critical: 'Crítica',
}

const actionLabels: Record<MaintenancePartAction, string> = {
  installed: 'Instalada',
  removed: 'Retirada',
  consumed: 'Consumida',
  replaced: 'Substituída',
  other: 'Outra',
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

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value || '—'}
      </div>
    </div>
  )
}

function money(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

async function loadMaintenance(id: string) {
  const order = await getMaintenanceOrder(id)

  const [
    asset,
    parts,
    events,
    stockUnits,
    stockProducts,
  ] = await Promise.all([
    getAssetById(order.asset_id),
    listMaintenanceParts(order.id),
    listMaintenanceEvents(order.id),
    listStockUnits(),
    listStockProducts(),
  ])

  return {
    order,
    asset,
    parts,
    events,
    stockUnits,
    stockProducts,
  }
}

export function MaintenanceDetailPage() {
  const { maintenanceId } = useParams()
  const { access, hasPermission } = useAuth()

  const [order, setOrder] = useState<MaintenanceOrderRecord | null>(null)
  const [asset, setAsset] = useState<AssetRecord | null>(null)
  const [parts, setParts] = useState<MaintenancePartRecord[]>([])
  const [events, setEvents] = useState<MaintenanceEventRecord[]>([])
  const [stockUnits, setStockUnits] = useState<StockUnitRecord[]>([])
  const [stockProducts, setStockProducts] = useState<StockProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [partOpen, setPartOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [removePartTarget, setRemovePartTarget] =
    useState<MaintenancePartRecord | null>(null)

  async function refresh() {
    if (!maintenanceId) return

    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await loadMaintenance(maintenanceId)
      setOrder(data.order)
      setAsset(data.asset)
      setParts(data.parts)
      setEvents(data.events)
      setStockUnits(data.stockUnits)
      setStockProducts(data.stockProducts)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a manutenção.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!maintenanceId) {
      return
    }

    let active = true

    async function bootstrap(id: string) {
      try {
        const data = await loadMaintenance(id)

        if (!active) {
          return
        }

        setOrder(data.order)
        setAsset(data.asset)
        setParts(data.parts)
        setEvents(data.events)
        setStockUnits(data.stockUnits)
        setStockProducts(data.stockProducts)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar a manutenção.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrap(maintenanceId)

    return () => {
      active = false
    }
  }, [maintenanceId])

  const productMap = useMemo(
    () => new Map(stockProducts.map((product) => [product.id, product])),
    [stockProducts],
  )

  const stockMap = useMemo(
    () => new Map(stockUnits.map((item) => [item.id, item])),
    [stockUnits],
  )

  if (loading && !order) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <RefreshCw size={18} className="animate-spin text-slate-400" />
      </div>
    )
  }

  if (!order || !asset) {
    return (
      <div className="space-y-4">
        <Link
          to="/manutencoes"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={15} />
          Manutenções
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {errorMessage ?? 'Manutenção não encontrada.'}
        </div>
      </div>
    )
  }

  const active = !['completed', 'cancelled'].includes(order.status)
  const canUpdate = hasPermission('assets.update') && active
  const currentUserOwns =
    Boolean(order.assigned_to) &&
    order.assigned_to === access?.profile.id

  const partsCost = parts
    .filter((part) => !part.removed_at)
    .reduce(
      (total, part) => total + Number(part.quantity) * Number(part.unit_cost),
      0,
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/manutencoes"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Manutenções
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-sky-400">
              <Wrench size={19} />
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-slate-400">
                {order.maintenance_code}
              </div>
              <h1 className="mt-0.5 text-2xl font-bold tracking-[-0.035em] text-slate-950">
                {asset.asset_code}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"
            aria-label="Atualizar"
          >
            <RefreshCw
              size={15}
              className={loading ? 'animate-spin' : undefined}
            />
          </button>

          {canUpdate && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              <Edit3 size={15} />
              Atualizar
            </button>
          )}

          {canUpdate && (
            <button
              type="button"
              onClick={() => setPartOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              <Boxes size={15} />
              Peça / material
            </button>
          )}

          {canUpdate && (
            <button
              type="button"
              onClick={() => setCompleteOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
            >
              <CheckCircle2 size={15} />
              Concluir
            </button>
          )}

          {canUpdate && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="grid size-10 place-items-center rounded-xl border border-red-200 bg-white text-red-600"
              aria-label="Cancelar manutenção"
            >
              <XCircle size={16} />
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={statusTone[order.status]}>
              {statusLabels[order.status]}
            </StatusPill>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
              Prioridade {priorityLabels[order.priority].toLowerCase()}
            </span>
          </div>

          <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <InfoItem
              label="Ativo"
              value={`${asset.asset_code} · ${[asset.manufacturer, asset.model]
                .filter(Boolean)
                .join(' ')}`}
            />
            <InfoItem
              label="Responsável"
              value={
                currentUserOwns
                  ? access?.profile.fullName ?? 'Você'
                  : order.assigned_to
                    ? 'Outro técnico atribuído'
                    : 'Não atribuído'
              }
            />
            <InfoItem
              label="Abertura"
              value={new Date(order.opened_at).toLocaleString('pt-BR')}
            />
            <InfoItem
              label="Atendimento externo"
              value={order.external_service ? 'Sim' : 'Não'}
            />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
              Defeito, sintoma ou objetivo
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {order.symptom}
            </p>
          </div>

          {order.diagnosis && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Diagnóstico
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {order.diagnosis}
              </p>
            </div>
          )}

          {order.action_taken && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Ação executada
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {order.action_taken}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
              Custos
            </div>
            <div className="mt-4 space-y-3">
              <CostLine label="Mão de obra" value={order.labor_cost} />
              <CostLine label="Serviço externo" value={order.external_cost} />
              <CostLine label="Outros" value={order.other_cost} />
              <CostLine label="Peças / materiais" value={partsCost} />
              <div className="border-t border-slate-100 pt-3">
                <CostLine
                  label="Total geral"
                  value={Number(order.total_cost) + partsCost}
                  strong
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
              Fornecedor externo
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-800">
              {order.provider_name ?? 'Não informado'}
            </div>
            {order.provider_reference && (
              <div className="mt-1 text-xs text-slate-500">
                {order.provider_reference}
              </div>
            )}
          </section>

          <Link
            to={`/patrimonio/${asset.id}`}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Abrir ficha do patrimônio
            <ExternalLink size={15} className="text-slate-400" />
          </Link>
        </div>
      </section>

      <EvidencePanel
        context={{ assetId: asset.id }}
        canUpload={canUpdate}
        canManage={hasPermission('assets.update')}
        defaultCategory="maintenance"
        categoryOptions={['maintenance']}
        visibleCategories={['maintenance']}
        title="Evidências da manutenção"
        description="Fotos e documentos técnicos vinculados ao ativo na categoria Manutenção."
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
              <Boxes size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">
                Peças e materiais
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Registro técnico integrado ao estoque quando aplicável
              </p>
            </div>
          </div>
        </header>

        {parts.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400">
            Nenhuma peça ou material registrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {parts.map((part) => {
              const stock = part.stock_unit_id
                ? stockMap.get(part.stock_unit_id)
                : undefined
              const product = stock
                ? productMap.get(stock.product_id)
                : undefined

              return (
                <div
                  key={part.id}
                  className={`flex items-center gap-3 px-5 py-4 ${
                    part.removed_at ? 'opacity-50' : ''
                  }`}
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                    {part.action === 'removed' ? (
                      <RotateCcw size={15} />
                    ) : part.stock_unit_id ? (
                      <Link2 size={15} />
                    ) : (
                      <Boxes size={15} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {part.description}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                        {actionLabels[part.action]}
                      </span>
                      {part.removed_at && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">
                          registro removido
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-[10px] text-slate-400">
                      {stock
                        ? `${stock.stock_code} · ${product?.name ?? 'Componente'}`
                        : `${part.quantity} × ${money(part.unit_cost)}`}
                    </div>
                  </div>

                  {part.stock_unit_id && (
                    <Link
                      to={`/estoque/${part.stock_unit_id}`}
                      className="grid size-9 place-items-center rounded-xl text-sky-700 hover:bg-sky-50"
                      aria-label="Abrir item de estoque"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  )}

                  {canUpdate && !part.removed_at && (
                    <button
                      type="button"
                      onClick={() => setRemovePartTarget(part)}
                      className="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remover registro"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <History size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Histórico da manutenção
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Alterações, peças e encerramento preservados
            </p>
          </div>
        </header>

        {events.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400">
            Nenhum evento registrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => (
              <div
                key={event.id}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[160px_1fr]"
              >
                <div className="text-[10px] font-semibold text-slate-400">
                  {new Date(event.occurred_at).toLocaleString('pt-BR')}
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.06em] text-slate-700">
                    {event.event_type.replaceAll('_', ' ')}
                  </div>
                  {event.reason && (
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {event.reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <MaintenanceEditModal
        open={editOpen}
        order={order}
        currentUserId={access?.profile.id ?? null}
        onClose={() => setEditOpen(false)}
        onDone={() => {
          setEditOpen(false)
          void refresh()
        }}
      />

      <MaintenancePartModal
        open={partOpen}
        order={order}
        asset={asset}
        stockUnits={stockUnits}
        stockProducts={stockProducts}
        onClose={() => setPartOpen(false)}
        onDone={() => {
          setPartOpen(false)
          void refresh()
        }}
      />

      <MaintenanceCompleteModal
        open={completeOpen}
        order={order}
        onClose={() => setCompleteOpen(false)}
        onDone={() => {
          setCompleteOpen(false)
          void refresh()
        }}
      />

      <MaintenanceCancelModal
        open={cancelOpen}
        order={order}
        onClose={() => setCancelOpen(false)}
        onDone={() => {
          setCancelOpen(false)
          void refresh()
        }}
      />

      <RemoveMaintenancePartModal
        part={removePartTarget}
        onClose={() => setRemovePartTarget(null)}
        onDone={() => {
          setRemovePartTarget(null)
          void refresh()
        }}
      />
    </div>
  )
}

function CostLine({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'text-sm font-bold text-slate-800' : 'text-xs text-slate-500'}>
        {label}
      </span>
      <span className={strong ? 'text-base font-black text-slate-950' : 'text-sm font-semibold text-slate-700'}>
        {money(value)}
      </span>
    </div>
  )
}

function numberValue(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function MaintenanceEditModal({
  open,
  order,
  currentUserId,
  onClose,
  onDone,
}: {
  open: boolean
  order: MaintenanceOrderRecord
  currentUserId: string | null
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<Extract<
    MaintenanceStatus,
    'open' | 'in_progress' | 'waiting_parts' | 'external'
  >>('open')
  const [priority, setPriority] = useState<MaintenancePriority>('normal')
  const [symptom, setSymptom] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [actionTaken, setActionTaken] = useState('')
  const [externalService, setExternalService] = useState(false)
  const [providerName, setProviderName] = useState('')
  const [providerReference, setProviderReference] = useState('')
  const [laborCost, setLaborCost] = useState('0')
  const [externalCost, setExternalCost] = useState('0')
  const [otherCost, setOtherCost] = useState('0')
  const [notes, setNotes] = useState('')
  const [assignedToMe, setAssignedToMe] = useState(false)

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setStatus(
        ['open', 'in_progress', 'waiting_parts', 'external'].includes(
          order.status,
        )
          ? (order.status as Extract<
              MaintenanceStatus,
              'open' | 'in_progress' | 'waiting_parts' | 'external'
            >)
          : 'open',
      )
      setPriority(order.priority)
      setSymptom(order.symptom)
      setDiagnosis(order.diagnosis ?? '')
      setActionTaken(order.action_taken ?? '')
      setExternalService(order.external_service)
      setProviderName(order.provider_name ?? '')
      setProviderReference(order.provider_reference ?? '')
      setLaborCost(String(order.labor_cost ?? 0))
      setExternalCost(String(order.external_cost ?? 0))
      setOtherCost(String(order.other_cost ?? 0))
      setNotes(order.notes ?? '')
      setAssignedToMe(order.assigned_to === currentUserId)
      setErrorMessage(null)
    })
  }, [currentUserId, open, order])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await updateMaintenanceOrder({
        maintenanceId: order.id,
        status,
        priority,
        symptom,
        diagnosis,
        actionTaken,
        assignedTo: assignedToMe ? currentUserId : order.assigned_to,
        externalService,
        providerName,
        providerReference,
        laborCost: numberValue(laborCost),
        externalCost: numberValue(externalCost),
        otherCost: numberValue(otherCost),
        notes,
        reason: 'Atualização técnica da ordem de manutenção.',
      })

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a manutenção.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Atualizar manutenção"
      description={order.maintenance_code}
      onClose={onClose}
      widthClassName="max-w-4xl"
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
            form="maintenance-edit-form"
            disabled={saving || !symptom.trim()}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Salvando...' : 'Salvar atualização'}
          </button>
        </div>
      }
    >
      <form id="maintenance-edit-form" onSubmit={submit} className="space-y-4">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status operacional">
            <select
              className={inputClass}
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as Extract<
                    MaintenanceStatus,
                    'open' | 'in_progress' | 'waiting_parts' | 'external'
                  >,
                )
              }
            >
              <option value="open">Aberta</option>
              <option value="in_progress">Em andamento</option>
              <option value="waiting_parts">Aguardando peça</option>
              <option value="external">Externa</option>
            </select>
          </Field>

          <Field label="Prioridade">
            <select
              className={inputClass}
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as MaintenancePriority)
              }
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={assignedToMe}
            onChange={(event) => setAssignedToMe(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Assumir esta manutenção como responsável
        </label>

        <Field label="Defeito, sintoma ou objetivo">
          <textarea
            value={symptom}
            onChange={(event) => setSymptom(event.target.value)}
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            required
          />
        </Field>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Diagnóstico">
            <textarea
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </Field>

          <Field label="Ação executada até o momento">
            <textarea
              value={actionTaken}
              onChange={(event) => setActionTaken(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={externalService}
            onChange={(event) => setExternalService(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Atendimento por fornecedor externo
        </label>

        {externalService && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fornecedor / assistência">
              <input
                className={inputClass}
                value={providerName}
                onChange={(event) => setProviderName(event.target.value)}
              />
            </Field>
            <Field label="Ordem / protocolo externo">
              <input
                className={inputClass}
                value={providerReference}
                onChange={(event) => setProviderReference(event.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mão de obra">
            <input
              className={inputClass}
              inputMode="decimal"
              value={laborCost}
              onChange={(event) => setLaborCost(event.target.value)}
            />
          </Field>
          <Field label="Serviço externo">
            <input
              className={inputClass}
              inputMode="decimal"
              value={externalCost}
              onChange={(event) => setExternalCost(event.target.value)}
            />
          </Field>
          <Field label="Outros custos">
            <input
              className={inputClass}
              inputMode="decimal"
              value={otherCost}
              onChange={(event) => setOtherCost(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </Field>
      </form>
    </FormModal>
  )
}

function MaintenancePartModal({
  open,
  order,
  asset,
  stockUnits,
  stockProducts,
  onClose,
  onDone,
}: {
  open: boolean
  order: MaintenanceOrderRecord
  asset: AssetRecord
  stockUnits: StockUnitRecord[]
  stockProducts: StockProductRecord[]
  onClose: () => void
  onDone: () => void
}) {
  const productMap = useMemo(
    () => new Map(stockProducts.map((product) => [product.id, product])),
    [stockProducts],
  )

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [source, setSource] = useState<'stock' | 'manual'>('stock')
  const [action, setAction] = useState<Exclude<MaintenancePartAction, 'replaced'>>('installed')
  const [stockUnitId, setStockUnitId] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('0')

  const eligibleStock = useMemo(() => {
    if (action === 'installed') {
      return stockUnits.filter((item) => {
        const product = productMap.get(item.product_id)
        return (
          Boolean(product?.can_install) &&
          ['in_stock', 'reserved'].includes(item.status)
        )
      })
    }

    if (action === 'removed') {
      return stockUnits.filter(
        (item) => item.installed_asset_id === asset.id,
      )
    }

    if (action === 'consumed') {
      return stockUnits.filter(
        (item) =>
          item.status !== 'installed' &&
          item.status !== 'disposed',
      )
    }

    return stockUnits.filter((item) => item.status !== 'disposed')
  }, [action, asset.id, productMap, stockUnits])

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setSource('stock')
      setAction('installed')
      setStockUnitId('')
      setDescription('')
      setQuantity('1')
      setUnitCost('0')
      setErrorMessage(null)
    })
  }, [open])

  useEffect(() => {
    if (source !== 'stock') return

    const selected = eligibleStock.find((item) => item.id === stockUnitId)
    const next = selected ?? eligibleStock[0]

    queueMicrotask(() => {
      if (!next) {
        setStockUnitId('')
        setDescription('')
        setUnitCost('0')
        return
      }

      if (next.id !== stockUnitId) {
        setStockUnitId(next.id)
      }

      const product = productMap.get(next.product_id)
      setDescription(
        `${product?.name ?? 'Componente'} ${next.stock_code}`,
      )
      setUnitCost(String(next.cost_amount ?? 0))
    })
  }, [eligibleStock, productMap, source, stockUnitId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      const controlled = source === 'stock'
      const selected = controlled
        ? stockUnits.find((item) => item.id === stockUnitId)
        : undefined

      if (controlled && !selected) {
        throw new Error('Selecione um item de estoque válido.')
      }

      const part = await addMaintenancePart({
        maintenanceId: order.id,
        action,
        description,
        stockUnitId: controlled ? stockUnitId : null,
        quantity: controlled ? 1 : Math.max(1, numberValue(quantity)),
        unitCost: numberValue(unitCost),
      })

      if (controlled && selected) {
        const reason = `Manutenção ${order.maintenance_code}: ${description.trim()}`

        try {
          if (action === 'installed') {
            await installStockUnit(selected.id, asset.id, reason)
          } else if (action === 'removed') {
            await removeStockUnit(
              selected.id,
              asset.current_unit_id,
              asset.current_environment_id,
              'used',
              reason,
            )
          } else if (action === 'consumed') {
            await changeStockUnitStatus(selected.id, 'disposed', reason)
          }
        } catch (stockError) {
          const message =
            stockError instanceof Error
              ? stockError.message
              : 'Falha na movimentação do estoque.'

          await removeMaintenancePart(
            part.id,
            `Compensação automática: ${message}`,
          ).catch(() => undefined)

          throw new Error(
            `A peça não foi aplicada porque o estoque recusou a operação: ${message}`,
            { cause: stockError },
          )
        }
      }

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a peça ou material.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Peça ou material"
      description="Itens controlados executam a movimentação correspondente no estoque. Para substituição, registre a retirada da peça antiga e depois a instalação da nova."
      onClose={onClose}
      widthClassName="max-w-3xl"
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
            form="maintenance-part-form"
            disabled={saving || !description.trim()}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      }
    >
      <form id="maintenance-part-form" onSubmit={submit} className="space-y-4">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSource('stock')}
            className={`h-9 rounded-lg text-xs font-bold ${
              source === 'stock'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Estoque controlado
          </button>
          <button
            type="button"
            onClick={() => setSource('manual')}
            className={`h-9 rounded-lg text-xs font-bold ${
              source === 'manual'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Material manual
          </button>
        </div>

        <Field label="Ação">
          <select
            className={inputClass}
            value={action}
            onChange={(event) =>
              setAction(
                event.target.value as Exclude<
                  MaintenancePartAction,
                  'replaced'
                >,
              )
            }
          >
            <option value="installed">Instalada no ativo</option>
            <option value="removed">Retirada do ativo</option>
            <option value="consumed">Consumida</option>
            <option value="other">Outra</option>
          </select>
        </Field>

        {source === 'stock' && (
          <Field label="Item de estoque">
            <select
              className={inputClass}
              value={stockUnitId}
              onChange={(event) => setStockUnitId(event.target.value)}
              required
            >
              {eligibleStock.length === 0 && (
                <option value="">Nenhum item compatível</option>
              )}
              {eligibleStock.map((item) => {
                const product = productMap.get(item.product_id)
                return (
                  <option key={item.id} value={item.id}>
                    {item.stock_code} · {product?.name ?? 'Componente'}
                    {item.serial_number ? ` · ${item.serial_number}` : ''}
                  </option>
                )
              })}
            </select>
          </Field>
        )}

        <Field label="Descrição">
          <input
            className={inputClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </Field>

        {source === 'manual' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantidade">
              <input
                className={inputClass}
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
            <Field label="Custo unitário">
              <input
                className={inputClass}
                inputMode="decimal"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
              />
            </Field>
          </div>
        )}
      </form>
    </FormModal>
  )
}

function MaintenanceCompleteModal({
  open,
  order,
  onClose,
  onDone,
}: {
  open: boolean
  order: MaintenanceOrderRecord
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState(order.diagnosis ?? '')
  const [actionTaken, setActionTaken] = useState(order.action_taken ?? '')
  const [resultStatus, setResultStatus] =
    useState<'active' | 'stock' | 'retired'>('active')
  const [notes, setNotes] = useState(order.notes ?? '')

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setDiagnosis(order.diagnosis ?? '')
      setActionTaken(order.action_taken ?? '')
      setResultStatus('active')
      setNotes(order.notes ?? '')
      setErrorMessage(null)
    })
  }, [open, order])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await completeMaintenanceOrder({
        maintenanceId: order.id,
        diagnosis,
        actionTaken,
        resultAssetStatus: resultStatus,
        notes,
      })

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a manutenção.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Concluir manutenção"
      description="Registre o resultado técnico e defina o estado do ativo após o serviço."
      onClose={onClose}
      widthClassName="max-w-3xl"
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
            form="maintenance-complete-form"
            disabled={saving || !actionTaken.trim()}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Concluindo...' : 'Confirmar conclusão'}
          </button>
        </div>
      }
    >
      <form id="maintenance-complete-form" onSubmit={submit} className="space-y-4">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Diagnóstico final">
          <textarea
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </Field>

        <Field label="Ação executada">
          <textarea
            value={actionTaken}
            onChange={(event) => setActionTaken(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            required
          />
        </Field>

        <Field label="Estado do ativo após a manutenção">
          <select
            className={inputClass}
            value={resultStatus}
            onChange={(event) =>
              setResultStatus(
                event.target.value as 'active' | 'stock' | 'retired',
              )
            }
          >
            <option value="active">Ativo</option>
            <option value="stock">Estoque</option>
            <option value="retired">Baixado</option>
          </select>
        </Field>

        <Field label="Observações de conclusão">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </Field>
      </form>
    </FormModal>
  )
}

function MaintenanceCancelModal({
  open,
  order,
  onClose,
  onDone,
}: {
  open: boolean
  order: MaintenanceOrderRecord
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setReason('')
      setErrorMessage(null)
    })
  }, [open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)
      await cancelMaintenanceOrder(order.id, reason)
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível cancelar a manutenção.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Cancelar manutenção"
      description="O histórico será preservado e o ativo retornará ao estado anterior compatível."
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
            form="maintenance-cancel-form"
            disabled={saving || !reason.trim()}
            className="h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      }
    >
      <form id="maintenance-cancel-form" onSubmit={submit}>
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}
        <Field label="Justificativa">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            required
          />
        </Field>
      </form>
    </FormModal>
  )
}

function RemoveMaintenancePartModal({
  part,
  onClose,
  onDone,
}: {
  part: MaintenancePartRecord | null
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!part) return
    queueMicrotask(() => {
      setReason('')
      setErrorMessage(null)
    })
  }, [part])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!part) return

    try {
      setSaving(true)
      setErrorMessage(null)
      await removeMaintenancePart(part.id, reason)
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover o registro.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={Boolean(part)}
      title="Remover registro de peça"
      description="A remoção é lógica; o histórico original permanece preservado."
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
            form="remove-maintenance-part-form"
            disabled={saving || !reason.trim()}
            className="h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Removendo...' : 'Confirmar'}
          </button>
        </div>
      }
    >
      <form id="remove-maintenance-part-form" onSubmit={submit}>
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}
        <Field label="Justificativa">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            required
          />
        </Field>
      </form>
    </FormModal>
  )
}