import {
  Box,
  Link2,
  Plus,
  RefreshCw,
  Unlink2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import {
  linkAssetBinding,
  linkStockBinding,
  listAssetBindings,
  resolveInventoryCode,
  unlinkAssetBinding,
  unlinkStockBinding,
} from '../../data/field-ops-service'
import type {
  AssetBindingView,
  InventoryResolvedItem,
} from '../../types/field-ops'
import { InventoryScanner } from '../field/InventoryScanner'
import { FormModal } from '../ui/FormModal'

const relationLabels: Record<string, string> = {
  component: 'Componente',
  accessory: 'Acessório',
  cable: 'Cabo',
  peripheral: 'Periférico',
  consumable: 'Consumível',
  part_of: 'Parte do conjunto',
  paired: 'Pareado',
  other: 'Outro',
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

export function AssetBindingsCard({
  assetId,
}: {
  assetId: string
}) {
  const { hasPermission } = useAuth()
  const canManage =
    hasPermission('assets.update') ||
    hasPermission('stock.move') ||
    hasPermission('stock.adjust')

  const [items, setItems] = useState<AssetBindingView[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] =
    useState<AssetBindingView | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      setItems(await listAssetBindings(assetId))
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os vínculos.',
      )
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refresh])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Link2 size={15} />
            Vínculos do ativo
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Componentes, acessórios, cabos e outros ativos que fazem parte deste conjunto.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"
            aria-label="Atualizar vínculos"
          >
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : ''}
            />
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white"
            >
              <Plus size={14} />
              Vincular
            </button>
          )}
        </div>
      </div>

      {errorMessage ? (
        <div className="p-5 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : loading && items.length === 0 ? (
        <div className="grid min-h-28 place-items-center">
          <RefreshCw size={16} className="animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">
          Nenhum componente ou acessório vinculado.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 px-5 py-4"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                <Box size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-bold text-slate-900">
                    {item.name}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500">
                    {relationLabels[item.relationType] ?? item.relationType}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-slate-500">
                  {item.shortCode && (
                    <span className="font-black text-slate-900">
                      {item.shortCode}
                    </span>
                  )}
                  <span>{item.code}</span>
                  {item.serial && <span>SN {item.serial}</span>}
                </div>
              </div>

              <Link
                to={
                  item.kind === 'stock'
                    ? `/estoque/${item.itemId}`
                    : `/patrimonio/${item.itemId}`
                }
                className="hidden text-xs font-semibold text-sky-700 sm:block"
              >
                Abrir
              </Link>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setRemoveTarget(item)}
                  className="grid size-9 place-items-center rounded-xl border border-red-200 text-red-600"
                  aria-label="Desvincular"
                >
                  <Unlink2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <AddBindingModal
        open={addOpen}
        assetId={assetId}
        onClose={() => setAddOpen(false)}
        onDone={() => {
          setAddOpen(false)
          void refresh()
        }}
      />

      <RemoveBindingModal
        target={removeTarget}
        assetId={assetId}
        onClose={() => setRemoveTarget(null)}
        onDone={() => {
          setRemoveTarget(null)
          void refresh()
        }}
      />
    </section>
  )
}

function AddBindingModal({
  open,
  assetId,
  onClose,
  onDone,
}: {
  open: boolean
  assetId: string
  onClose: () => void
  onDone: () => void
}) {
  const [resolved, setResolved] =
    useState<InventoryResolvedItem | null>(null)
  const [relationType, setRelationType] = useState('accessory')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      setResolved(null)
      setRelationType('accessory')
      setReason('')
      setSaving(false)
      setErrorMessage(null)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [open])

  async function scan(value: string) {
    const item = await resolveInventoryCode(value)

    if (item.kind === 'unknown' || !item.id) {
      throw new Error('Código não localizado no inventário.')
    }

    if (item.kind === 'asset' && item.id === assetId) {
      throw new Error('O ativo não pode ser vinculado a ele mesmo.')
    }

    setResolved(item)
    setRelationType(
      item.kind === 'stock_unit' ? 'accessory' : 'peripheral',
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!resolved?.id) {
      setErrorMessage('Escaneie ou digite o item a vincular.')
      return
    }

    if (!reason.trim()) {
      setErrorMessage('Informe a justificativa.')
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      if (resolved.kind === 'stock_unit') {
        await linkStockBinding({
          stockUnitId: resolved.id,
          assetId,
          relationType,
          reason,
        })
      } else if (resolved.kind === 'asset') {
        await linkAssetBinding({
          parentAssetId: assetId,
          childAssetId: resolved.id,
          relationType,
          reason,
        })
      }

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o vínculo.',
      )
    } finally {
      setSaving(false)
    }
  }

  const stockRelations = [
    ['component', 'Componente'],
    ['accessory', 'Acessório'],
    ['cable', 'Cabo'],
    ['peripheral', 'Periférico'],
    ['consumable', 'Consumível'],
    ['other', 'Outro'],
  ]
  const assetRelations = [
    ['peripheral', 'Periférico'],
    ['accessory', 'Acessório'],
    ['part_of', 'Parte do conjunto'],
    ['paired', 'Pareado'],
    ['other', 'Outro'],
  ]
  const relations =
    resolved?.kind === 'asset' ? assetRelations : stockRelations

  return (
    <FormModal
      open={open}
      title="Adicionar vínculo"
      description="Leia o QR Code, digite o código completo ou o código curto escrito na peça."
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="m12-add-binding"
            disabled={saving || !resolved?.id || !reason.trim()}
            className="h-10 flex-1 rounded-xl bg-slate-950 px-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Vinculando...' : 'Confirmar vínculo'}
          </button>
        </div>
      }
    >
      <form
        id="m12-add-binding"
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <InventoryScanner
          compact
          disabled={saving}
          onScan={async (value) => {
            await scan(value)
          }}
        />

        {resolved && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
              Item localizado
            </div>
            <div className="mt-1 text-sm font-black text-slate-950">
              {resolved.display_name ?? resolved.code}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-600">
              {resolved.short_code ? `${resolved.short_code} · ` : ''}
              {resolved.code}
            </div>
            {resolved.installed_asset_id &&
              resolved.installed_asset_id !== assetId && (
                <div className="mt-2 text-xs font-semibold text-amber-700">
                  Já existe outro vínculo. Ao confirmar, o histórico anterior será encerrado e o item será transferido.
                </div>
              )}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Tipo de vínculo
          </span>
          <select
            className={inputClass}
            value={relationType}
            onChange={(event) => setRelationType(event.target.value)}
          >
            {relations.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Justificativa
          </span>
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: montagem inicial, cabo entregue com monitor, substituição..."
            required
          />
        </label>
      </form>
    </FormModal>
  )
}

function RemoveBindingModal({
  target,
  assetId,
  onClose,
  onDone,
}: {
  target: AssetBindingView | null
  assetId: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!target) return

    const timer = window.setTimeout(() => {
      setReason('')
      setSaving(false)
      setErrorMessage(null)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [target])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!target) return

    try {
      setSaving(true)
      setErrorMessage(null)

      if (target.kind === 'stock') {
        await unlinkStockBinding({
          stockUnitId: target.itemId,
          assetId,
          reason,
        })
      } else {
        await unlinkAssetBinding({
          parentAssetId: assetId,
          childAssetId: target.itemId,
          reason,
        })
      }

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível desfazer o vínculo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={Boolean(target)}
      title="Desvincular item"
      description={
        target
          ? `${target.name} · ${target.shortCode ?? target.code}`
          : undefined
      }
      onClose={onClose}
      widthClassName="max-w-lg"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="m12-remove-binding"
            disabled={saving || !reason.trim()}
            className="h-10 flex-1 rounded-xl bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Desvinculando...' : 'Confirmar'}
          </button>
        </div>
      }
    >
      <form
        id="m12-remove-binding"
        onSubmit={(event) => void submit(event)}
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
            onChange={(event) => setReason(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Ex.: substituição, cabo defeituoso, transferência..."
            required
          />
        </label>
      </form>
    </FormModal>
  )
}
