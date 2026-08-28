import { Loader2, ScanLine } from 'lucide-react'
import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router'
import { resolveInventoryCode } from '../data/field-ops-service'

export function IdentifyCodePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function resolve() {
      try {
        const item = await resolveInventoryCode(code)
        if (!active) return

        if (item.kind === 'asset' && item.id) {
          navigate(`/patrimonio/${item.id}`, { replace: true })
          return
        }

        if (item.kind === 'stock_unit' && item.id) {
          navigate(`/estoque/${item.id}`, { replace: true })
          return
        }

        setErrorMessage('Código não localizado.')
      } catch (error) {
        if (!active) return
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível identificar o código.',
        )
      }
    }

    void resolve()
    return () => {
      active = false
    }
  }, [code, navigate])

  if (!errorMessage) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Identificando item
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600">
          <ScanLine size={20} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-950">
          Item não localizado
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {errorMessage}
        </p>
        <Link
          to="/escanear"
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
        >
          Abrir scanner
        </Link>
      </div>
    </div>
  )
}
