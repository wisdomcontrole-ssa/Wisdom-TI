import {
  ClipboardClock,
  PackagePlus,
  ScanLine,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { getPendingExpressCount } from '../../data/field-ops-service'
import { ExpressAssetModal } from '../assets/ExpressAssetModal'

export function MobileFieldActions() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [expressOpen, setExpressOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const canCreate = hasPermission('assets.create')
  const canView = hasPermission('assets.view')

  const refreshPending = useCallback(async () => {
    if (!canView) return

    try {
      setPendingCount(await getPendingExpressCount())
    } catch {
      setPendingCount(0)
    }
  }, [canView])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPending()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refreshPending])

  if (!canCreate && !canView) return null

  return (
    <>
      <div className="fixed bottom-[76px] left-1/2 z-[75] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur lg:hidden">
        {canCreate && (
          <button
            type="button"
            onClick={() => setExpressOpen(true)}
            className="relative inline-flex h-12 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"
          >
            <PackagePlus size={17} />
            Novo Express
            {pendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        )}

        {canView && (
          <button
            type="button"
            onClick={() => navigate('/escanear')}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-800"
          >
            <ScanLine size={17} />
            Escanear
          </button>
        )}

        {canView && pendingCount > 0 && (
          <button
            type="button"
            aria-label="Cadastros pendentes"
            onClick={() => navigate('/pendencias-cadastro')}
            className="grid size-12 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700"
          >
            <ClipboardClock size={17} />
          </button>
        )}
      </div>

      <ExpressAssetModal
        open={expressOpen}
        onClose={() => setExpressOpen(false)}
        onCreated={(assetId, warning) => {
          setExpressOpen(false)
          void refreshPending()
          navigate(`/patrimonio/${assetId}`)

          if (warning) {
            window.setTimeout(() => window.alert(warning), 250)
          }
        }}
      />
    </>
  )
}
