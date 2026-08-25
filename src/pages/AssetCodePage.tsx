import {
  Loader2,
  QrCode,
} from 'lucide-react'
import {
  useEffect,
  useState,
} from 'react'
import {
  Navigate,
  useParams,
} from 'react-router'
import { getAssetByCode } from '../data/asset-service'

export function AssetCodePage() {
  const { assetCode } = useParams()

  const [assetId, setAssetId] =
    useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!assetCode) {
      return
    }

    let active = true

    async function resolveAsset(code: string) {
      try {
        const asset = await getAssetByCode(code)

        if (active) {
          setAssetId(asset.id)
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Ativo não encontrado.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void resolveAsset(assetCode)

    return () => {
      active = false
    }
  }, [assetCode])

  if (assetId) {
    return (
      <Navigate
        to={`/patrimonio/${assetId}`}
        replace
      />
    )
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2
          size={20}
          className="animate-spin text-slate-400"
        />
      </div>
    )
  }

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <QrCode size={20} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-950">
          Código não localizado
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {errorMessage ??
            'Não foi encontrado um ativo com este código.'}
        </p>
      </div>
    </div>
  )
}