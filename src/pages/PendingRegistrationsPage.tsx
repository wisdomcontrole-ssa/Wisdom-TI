import {
  Check,
  ClipboardClock,
  RefreshCw,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import {
  completeExpressAsset,
  listPendingExpressAssets,
} from '../data/field-ops-service'
import type { ExpressAssetRecord } from '../types/field-ops'

const originLabels: Record<string, string> = {
  purchase: 'Compra',
  donation: 'Doação',
  used: 'Usado',
  transfer: 'Transferência',
  other: 'Outra',
}

export function PendingRegistrationsPage() {
  const { hasPermission } = useAuth()
  const canUpdate = hasPermission('assets.update')

  const [items, setItems] = useState<ExpressAssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      setItems(await listPendingExpressAssets())
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os cadastros pendentes.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refresh])

  async function complete(assetId: string) {
    try {
      setSavingId(assetId)
      setErrorMessage(null)
      await completeExpressAsset(assetId)
      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir o cadastro.',
      )
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Patrimônio"
        title="Cadastros pendentes"
        description="Ativos criados pelo modo Express aguardando complementação da ficha."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600"
          >
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : ''}
            />
            Atualizar
          </button>
        }
      />

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid min-h-48 place-items-center">
          <RefreshCw size={18} className="animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <ClipboardClock size={22} className="mx-auto text-slate-300" />
          <div className="mt-3 text-sm font-bold text-slate-800">
            Nenhum pré-cadastro pendente
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-black text-slate-950">
                    {item.asset_code}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {[item.manufacturer, item.model]
                      .filter(Boolean)
                      .join(' ') || 'Dados técnicos pendentes'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase text-slate-500">
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                      Pré-cadastro
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {originLabels[item.entry_origin ?? 'other'] ?? 'Outra'}
                    </span>
                    {item.serial_number && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-mono">
                        SN {item.serial_number}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/patrimonio/${item.id}`}
                    className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700"
                  >
                    Abrir ficha
                  </Link>

                  {canUpdate && (
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => void complete(item.id)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-40"
                    >
                      <Check size={14} />
                      {savingId === item.id
                        ? 'Salvando...'
                        : 'Marcar concluído'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
