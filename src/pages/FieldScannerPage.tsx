import { ScanLine } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { InventoryScanner } from '../components/field/InventoryScanner'
import { PageHeader } from '../components/ui/PageHeader'
import { resolveInventoryCode } from '../data/field-ops-service'
import { findPreprintedLabel } from '../data/preprinted-labels-service'
import type { InventoryResolvedItem } from '../types/field-ops'

function normalizeScannedCode(input: string): string {
  let raw = input.trim()
  // QR convencional pode carregar URL absoluta em vez do código.
  try {
    const url = new URL(raw)
    const match = url.pathname.match(/\/(?:identificar|ativo|cadastro-etiqueta)\/([^/?#]+)/i)
    if (match) raw = decodeURIComponent(match[1])
  } catch {
    const match = raw.match(/\/(?:identificar|ativo|cadastro-etiqueta)\/([^/?#]+)/i)
    if (match) raw = decodeURIComponent(match[1])
  }
  return raw.replace(/^[\s"'`]+|[\s"'`]+$/g, '').toUpperCase()
}

export function FieldScannerPage() {
  const navigate = useNavigate()
  const [last, setLast] = useState<InventoryResolvedItem | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleScan(value: string) {
    const code = normalizeScannedCode(value)
    if (!code) throw new Error('Código vazio.')
    try {
      setBusy(true)
      const item = await resolveInventoryCode(code)
      setLast(item)
      if (item.kind === 'asset' && item.id) {
        navigate(`/patrimonio/${item.id}`)
        return
      }
      if (item.kind === 'stock_unit' && item.id) {
        navigate(`/estoque/${item.id}`)
        return
      }

      const label = await findPreprintedLabel(code)
      if (label?.state === 'reserved') {
        navigate(`/cadastro-etiqueta/${encodeURIComponent(label.code)}`)
        return
      }
      if (label?.state === 'claimed' && label.asset_id) {
        navigate(`/patrimonio/${label.asset_id}`)
        return
      }
      throw new Error(`Código ${code} lido, mas não consta como etiqueta reservada ou item cadastrado.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operação de campo"
        title="Escanear item"
        description="Leia QR Code, código de barras, serial ou Código de terceiro. Etiquetas antecipadas reservadas abrem o cadastro rápido."
      />
      <InventoryScanner disabled={busy} onScan={async (value) => { await handleScan(value) }} />
      {last?.kind === 'unknown' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <div className="flex items-center gap-2 font-bold"><ScanLine size={16}/> Último código sem cadastro patrimonial</div>
          <div className="mt-2 font-mono">{last.code}</div>
        </div>
      )}
    </div>
  )
}
