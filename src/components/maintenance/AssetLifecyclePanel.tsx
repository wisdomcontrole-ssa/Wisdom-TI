import {
  Archive,
  Ban,
  ChevronRight,
  History,
  Plus,
  RefreshCw,
  Recycle,
  Wrench,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { listEvidence } from '../../data/evidence-service'
import {
  disposeAsset,
  getAssetDisposal,
  listAssetLifecycleEvents,
  listMaintenanceOrders,
  retireAsset,
} from '../../data/maintenance-service'
import type { AssetRecord } from '../../types/assets'
import type {
  AssetDisposalRecord,
  AssetLifecycleEventRecord,
  DisposalMethod,
  DisposalReasonCategory,
  MaintenanceOrderRecord,
  MaintenanceStatus,
} from '../../types/maintenance'
import { FormModal } from '../ui/FormModal'
import { MaintenanceCreateModal } from './MaintenanceCreateModal'

const statusLabel: Record<MaintenanceStatus, string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  waiting_parts: 'Aguardando peça',
  external: 'Externa',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const eventLabel: Record<AssetLifecycleEventRecord['event_type'], string> = {
  maintenance_opened: 'Manutenção aberta',
  maintenance_completed: 'Manutenção concluída',
  maintenance_cancelled: 'Manutenção cancelada',
  retired: 'Ativo baixado',
  disposed: 'Ativo descartado',
}

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

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

export function AssetLifecyclePanel({
  asset,
  onChanged,
}: {
  asset: AssetRecord
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const { access, hasPermission } = useAuth()

  const [orders, setOrders] = useState<MaintenanceOrderRecord[]>([])
  const [events, setEvents] = useState<AssetLifecycleEventRecord[]>([])
  const [disposal, setDisposal] = useState<AssetDisposalRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [retireOpen, setRetireOpen] = useState(false)
  const [disposeOpen, setDisposeOpen] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const [orderRows, eventRows, disposalRow] = await Promise.all([
        listMaintenanceOrders(asset.id),
        listAssetLifecycleEvents(asset.id),
        getAssetDisposal(asset.id),
      ])

      setOrders(orderRows)
      setEvents(eventRows)
      setDisposal(disposalRow)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o ciclo de vida.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function bootstrap(assetId: string) {
      try {
        const [orderRows, eventRows, disposalRow] = await Promise.all([
          listMaintenanceOrders(assetId),
          listAssetLifecycleEvents(assetId),
          getAssetDisposal(assetId),
        ])

        if (!active) {
          return
        }

        setOrders(orderRows)
        setEvents(eventRows)
        setDisposal(disposalRow)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o ciclo de vida.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrap(asset.id)

    return () => {
      active = false
    }
  }, [asset.id])

  const activeOrder = useMemo(
    () =>
      orders.find((order) =>
        ['open', 'in_progress', 'waiting_parts', 'external'].includes(
          order.status,
        ),
      ) ?? null,
    [orders],
  )

  const canUpdate = hasPermission('assets.update')
  const canRetire = hasPermission('assets.retire')

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
            {loading ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <History size={16} />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Ciclo de vida e manutenção
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Manutenções, baixa e descarte com histórico não destrutivo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
            aria-label="Atualizar ciclo de vida"
          >
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : undefined}
            />
          </button>

          {canUpdate && asset.status !== 'disposed' && !activeOrder && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white"
            >
              <Plus size={14} />
              Manutenção
            </button>
          )}

          {canRetire &&
            !activeOrder &&
            asset.status !== 'retired' &&
            asset.status !== 'disposed' && (
              <button
                type="button"
                onClick={() => setRetireOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
              >
                <Archive size={14} />
                Baixar
              </button>
            )}

          {canRetire &&
            asset.status === 'retired' &&
            !disposal && (
              <button
                type="button"
                onClick={() => setDisposeOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-700 px-3 text-xs font-bold text-white"
              >
                <Recycle size={14} />
                Descartar
              </button>
            )}
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {activeOrder && (
          <Link
            to={`/manutencoes/${activeOrder.id}`}
            className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100/70"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
              <Wrench size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] font-bold text-amber-700">
                {activeOrder.maintenance_code}
              </div>
              <div className="mt-1 truncate text-sm font-bold text-slate-900">
                {activeOrder.symptom}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                {statusLabel[activeOrder.status]}
              </div>
            </div>
            <ChevronRight size={16} className="text-amber-500" />
          </Link>
        )}

        {disposal && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-red-700">
              <Ban size={14} />
              {disposal.disposal_code}
            </div>
            <div className="mt-2 text-sm font-bold text-slate-900">
              Ativo descartado
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600">
              {disposal.reason}
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              {new Date(disposal.disposed_at).toLocaleString('pt-BR')}
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
              Manutenções
            </div>

            {orders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
                Nenhuma manutenção registrada.
              </div>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 6).map((order) => (
                  <Link
                    key={order.id}
                    to={`/manutencoes/${order.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 transition hover:bg-slate-50"
                  >
                    <Wrench size={14} className="shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] font-bold text-slate-500">
                        {order.maintenance_code}
                      </div>
                      <div className="mt-0.5 truncate text-xs font-semibold text-slate-700">
                        {order.symptom}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">
                      {statusLabel[order.status]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
              Linha do tempo
            </div>

            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-400">
                Nenhum evento de ciclo de vida registrado.
              </div>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 8).map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-slate-300" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-700">
                        {eventLabel[event.event_type]}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(event.occurred_at).toLocaleString('pt-BR')}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                        {event.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MaintenanceCreateModal
        open={createOpen}
        assets={[asset]}
        currentUserId={access?.profile.id ?? null}
        initialAssetId={asset.id}
        onClose={() => setCreateOpen(false)}
        onCreated={(maintenanceId) => {
          setCreateOpen(false)
          onChanged()
          navigate(`/manutencoes/${maintenanceId}`)
        }}
      />

      <RetireAssetModal
        open={retireOpen}
        asset={asset}
        onClose={() => setRetireOpen(false)}
        onDone={() => {
          setRetireOpen(false)
          onChanged()
          void load()
        }}
      />

      <DisposeAssetModal
        open={disposeOpen}
        asset={asset}
        onClose={() => setDisposeOpen(false)}
        onDone={() => {
          setDisposeOpen(false)
          onChanged()
          void load()
        }}
      />
    </section>
  )
}

function RetireAssetModal({
  open,
  asset,
  onClose,
  onDone,
}: {
  open: boolean
  asset: AssetRecord
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
      await retireAsset(asset.id, reason)
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível baixar o ativo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Baixar ativo"
      description={`${asset.asset_code} · A baixa é registrada na linha do tempo e antecede o descarte.`}
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
            form="retire-asset-form"
            disabled={saving || !reason.trim()}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Baixando...' : 'Confirmar baixa'}
          </button>
        </div>
      }
    >
      <form id="retire-asset-form" onSubmit={submit} className="space-y-4">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
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

function DisposeAssetModal({
  open,
  asset,
  onClose,
  onDone,
}: {
  open: boolean
  asset: AssetRecord
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [checkingEvidence, setCheckingEvidence] = useState(false)
  const [hasEvidence, setHasEvidence] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reasonCategory, setReasonCategory] =
    useState<DisposalReasonCategory>('obsolete')
  const [disposalMethod, setDisposalMethod] =
    useState<DisposalMethod>('recycling')
  const [reason, setReason] = useState('')
  const [destination, setDestination] = useState('')
  const [residualValue, setResidualValue] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return

    let active = true

    queueMicrotask(() => {
      setReasonCategory('obsolete')
      setDisposalMethod('recycling')
      setReason('')
      setDestination('')
      setResidualValue('')
      setNotes('')
      setHasEvidence(false)
      setErrorMessage(null)
    })

    async function verifyEvidence() {
      try {
        setCheckingEvidence(true)
        const rows = await listEvidence({ assetId: asset.id })

        if (!active) return

        setHasEvidence(
          rows.some(
            (item) =>
              item.status === 'active' &&
              item.category_code === 'disposal',
          ),
        )
      } catch (error) {
        if (!active) return
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível validar as evidências de descarte.',
        )
      } finally {
        if (active) setCheckingEvidence(false)
      }
    }

    void verifyEvidence()

    return () => {
      active = false
    }
  }, [asset.id, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!hasEvidence) {
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      await disposeAsset({
        assetId: asset.id,
        reasonCategory,
        disposalMethod,
        reason,
        destination,
        residualValue: residualValue
          ? Number(residualValue.replace(',', '.'))
          : null,
        notes,
      })

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível descartar o ativo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Descartar ativo"
      description={`${asset.asset_code} · Operação final do ciclo de vida.`}
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
            form="dispose-asset-form"
            disabled={
              saving ||
              checkingEvidence ||
              !hasEvidence ||
              !reason.trim()
            }
            className="h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Descartando...' : 'Confirmar descarte'}
          </button>
        </div>
      }
    >
      <form id="dispose-asset-form" onSubmit={submit} className="space-y-4">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {!checkingEvidence && !hasEvidence && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            Antes do descarte, adicione pelo menos uma evidência ativa na categoria
            <strong> Descarte</strong> na seção Fotos e evidências da ficha do ativo.
          </div>
        )}

        {hasEvidence && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
            Evidência de descarte localizada.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Motivo principal">
            <select
              className={inputClass}
              value={reasonCategory}
              onChange={(event) =>
                setReasonCategory(
                  event.target.value as DisposalReasonCategory,
                )
              }
            >
              <option value="damage">Dano</option>
              <option value="obsolete">Obsolescência</option>
              <option value="unrepairable">Sem reparo</option>
              <option value="lost">Extravio</option>
              <option value="donation">Doação</option>
              <option value="sale">Venda</option>
              <option value="recycling">Reciclagem</option>
              <option value="other">Outro</option>
            </select>
          </Field>

          <Field label="Destinação">
            <select
              className={inputClass}
              value={disposalMethod}
              onChange={(event) =>
                setDisposalMethod(event.target.value as DisposalMethod)
              }
            >
              <option value="recycling">Reciclagem</option>
              <option value="donation">Doação</option>
              <option value="sale">Venda</option>
              <option value="destruction">Destruição</option>
              <option value="return">Devolução</option>
              <option value="other">Outra</option>
            </select>
          </Field>

          <Field label="Destino / recebedor">
            <input
              className={inputClass}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </Field>

          <Field label="Valor residual">
            <input
              className={inputClass}
              inputMode="decimal"
              value={residualValue}
              onChange={(event) => setResidualValue(event.target.value)}
              placeholder="0,00"
            />
          </Field>
        </div>

        <Field label="Justificativa">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            required
          />
        </Field>

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