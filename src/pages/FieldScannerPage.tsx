import { ScanLine } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { InventoryScanner } from '../components/field/InventoryScanner'
import { PageHeader } from '../components/ui/PageHeader'
import { resolveInventoryCode } from '../data/field-ops-service'
import type { InventoryResolvedItem } from '../types/field-ops'

export function FieldScannerPage() {
  const navigate = useNavigate()
  const [last, setLast] =
    useState<InventoryResolvedItem | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleScan(value: string) {
    try {
      setBusy(true)
      const item = await resolveInventoryCode(value)
      setLast(item)

      if (item.kind === 'asset' && item.id) {
        navigate(`/patrimonio/${item.id}`)
        return
      }

      if (item.kind === 'stock_unit' && item.id) {
        navigate(`/estoque/${item.id}`)
        return
      }

      throw new Error('Código não localizado no inventário.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operação de campo"
        title="Escanear item"
        description="Aponte a câmera para o QR Code ou digite o código curto. O sistema abre diretamente a ficha correspondente."
      />

      <InventoryScanner
        disabled={busy}
        onScan={async (value) => {
          await handleScan(value)
        }}
      />

      {last?.kind === 'unknown' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700">
            <ScanLine size={16} />
            Código não localizado
          </div>
          <div className="mt-2 font-mono text-xs text-red-600">
            {last.code}
          </div>
        </div>
      )}
    </div>
  )
}
