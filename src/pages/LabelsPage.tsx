import {
  FileDown,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import QRCode from 'react-qr-code'
import { useBranding } from '../branding/BrandContext'
import { InventoryScanner } from '../components/field/InventoryScanner'
import { PageHeader } from '../components/ui/PageHeader'
import {
  listLabelCatalog,
  resolveInventoryCode,
} from '../data/field-ops-service'
import type {
  LabelCatalogItem,
  M12AssetLink,
  M12ClassicBinding,
  M12GenericBinding,
  M12StockProduct,
  M12StockUnit,
} from '../types/field-ops'

interface CatalogState {
  items: LabelCatalogItem[]
  stockUnits: M12StockUnit[]
  products: M12StockProduct[]
  genericBindings: M12GenericBinding[]
  classicBindings: M12ClassicBinding[]
  assetLinks: M12AssetLink[]
}

const emptyCatalog: CatalogState = {
  items: [],
  stockUnits: [],
  products: [],
  genericBindings: [],
  classicBindings: [],
  assetLinks: [],
}

function itemKey(item: LabelCatalogItem) {
  return `${item.kind}:${item.id}`
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

export function LabelsPage() {
  const { branding } = useBranding()
  const [catalog, setCatalog] = useState<CatalogState>(emptyCatalog)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] =
    useState<Record<string, number>>({})

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const data = await listLabelCatalog()

      setCatalog({
        items: data.items,
        stockUnits: data.stockUnits,
        products: data.products,
        genericBindings: data.genericBindings,
        classicBindings: data.classicBindings,
        assetLinks: data.assetLinks,
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a Central de Etiquetas.',
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

  const byKey = useMemo(
    () =>
      new Map(
        catalog.items.map((item) => [itemKey(item), item]),
      ),
    [catalog.items],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase()
    if (!term) return catalog.items.slice(0, 80)

    return catalog.items
      .filter((item) =>
        [
          item.code,
          item.shortCode,
          item.typeName,
          item.title,
          item.serial,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toUpperCase().includes(term),
          ),
      )
      .slice(0, 120)
  }, [catalog.items, search])

  const copies = useMemo(() => {
    const output: LabelCatalogItem[] = []

    for (const [key, quantity] of Object.entries(selected)) {
      const item = byKey.get(key)
      if (!item) continue

      for (let index = 0; index < quantity; index += 1) {
        output.push(item)
      }
    }

    return output
  }, [byKey, selected])

  const pages = useMemo(() => chunk(copies, 12), [copies])

  function addItem(item: LabelCatalogItem) {
    const key = itemKey(item)
    setSelected((current) => ({
      ...current,
      [key]: Math.max(1, current[key] ?? 0),
    }))
  }

  async function scanToBatch(value: string) {
    const resolved = await resolveInventoryCode(value)

    if (resolved.kind === 'unknown' || !resolved.id) {
      throw new Error('Código não localizado.')
    }

    const key =
      resolved.kind === 'asset'
        ? `asset:${resolved.id}`
        : `stock:${resolved.id}`
    const item = byKey.get(key)

    if (!item) {
      throw new Error(
        'Item localizado, mas ainda não está disponível no catálogo carregado.',
      )
    }

    addItem(item)
  }

  async function exportPdf() {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-m12-label="true"]',
      ),
    )

    if (nodes.length === 0) {
      setErrorMessage('Selecione ao menos uma etiqueta.')
      return
    }

    try {
      setExporting(true)
      setErrorMessage(null)

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      })

      for (let index = 0; index < nodes.length; index += 1) {
        if (index > 0 && index % 12 === 0) {
          pdf.addPage('a4', 'landscape')
        }

        const canvas = await html2canvas(nodes[index], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        })

        const cell = index % 12
        const column = cell % 3
        const row = Math.floor(cell / 3)
        const x = 13.5 + column * 90
        const y = 5 + row * 50

        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          x,
          y,
          90,
          50,
          undefined,
          'FAST',
        )
      }

      pdf.save(
        `etiquetas-inventario-ti-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar o PDF.',
      )
    } finally {
      setExporting(false)
    }
  }

  const totalCopies = copies.length
  const totalPages = Math.ceil(totalCopies / 12)

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body * { visibility: hidden !important; }
          #m12-print-area, #m12-print-area * { visibility: visible !important; }
          #m12-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .m12-print-page {
            width: 297mm !important;
            height: 210mm !important;
            min-height: 210mm !important;
            padding: 5mm 13.5mm !important;
            display: grid !important;
            grid-template-columns: repeat(3, 90mm) !important;
            grid-template-rows: repeat(4, 50mm) !important;
            gap: 0 !important;
            break-after: page !important;
            page-break-after: always !important;
            background: white !important;
          }
          .m12-print-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
          [data-m12-label="true"] { break-inside: avoid !important; }
        }
      `}</style>

      <PageHeader
        eyebrow="Patrimônio"
        title="Central de Etiquetas"
        description="Selecione ativos e componentes, defina a quantidade de cópias e gere folhas A4 com etiquetas de 90 × 50 mm."
        actions={
          <div className="flex flex-wrap gap-2">
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
            <button
              type="button"
              disabled={totalCopies === 0}
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              <Printer size={14} />
              Imprimir
            </button>
            <button
              type="button"
              disabled={totalCopies === 0 || exporting}
              onClick={() => void exportPdf()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40"
            >
              <FileDown size={14} />
              {exporting ? 'Gerando PDF...' : 'Exportar PDF'}
            </button>
          </div>
        }
      />

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              placeholder="Código do ativo, código curto, serial, tipo..."
            />
          </div>

          <div className="mt-4 max-h-[520px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
            {filtered.map((item) => {
              const key = itemKey(item)
              const quantity = selected[key] ?? 0

              return (
                <div key={key} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {item.typeName}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500">
                        {item.kind === 'asset' ? 'Ativo' : 'Componente'}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {item.title}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-slate-500">
                      {item.shortCode && (
                        <span className="font-black text-slate-950">
                          {item.shortCode}
                        </span>
                      )}
                      <span>{item.code}</span>
                      {item.serial && <span>SN {item.serial}</span>}
                    </div>
                  </div>

                  {quantity === 0 ? (
                    <button
                      type="button"
                      onClick={() => addItem(item)}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white"
                    >
                      <Plus size={13} />
                      Adicionar
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((current) => ({
                            ...current,
                            [key]: Math.max(1, quantity - 1),
                          }))
                        }
                        className="grid size-8 place-items-center rounded-lg border border-slate-200"
                      >
                        <Minus size={12} />
                      </button>
                      <div className="min-w-8 text-center text-sm font-black">
                        {quantity}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((current) => ({
                            ...current,
                            [key]: quantity + 1,
                          }))
                        }
                        className="grid size-8 place-items-center rounded-lg border border-slate-200"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((current) => {
                            const next = { ...current }
                            delete next[key]
                            return next
                          })
                        }
                        className="grid size-8 place-items-center rounded-lg border border-red-200 text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Lote atual
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Etiquetas" value={totalCopies} />
              <Metric label="Folhas A4" value={totalPages} />
            </div>
            <div className="mt-3 text-xs leading-5 text-slate-500">
              A4 paisagem · 3 colunas × 4 linhas · 12 etiquetas por folha.
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Adicionar por leitura
            </div>
            <InventoryScanner
              compact
              onScan={async (value) => {
                await scanToBatch(value)
              }}
            />
          </section>
        </aside>
      </div>

      {totalCopies > 0 && (
        <section className="space-y-4">
          <div>
            <div className="text-sm font-bold text-slate-900">
              Pré-visualização
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Dimensão física real: 90 × 50 mm.
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-200/60 p-3">
            <div id="m12-print-area" className="mx-auto w-[297mm]">
              {pages.map((page, pageIndex) => (
                <div
                  key={pageIndex}
                  className="m12-print-page grid h-[210mm] w-[297mm] grid-cols-[repeat(3,90mm)] grid-rows-[repeat(4,50mm)] bg-white px-[13.5mm] py-[5mm] shadow-sm"
                >
                  {page.map((item, index) => (
                    <InventoryLabel
                      key={`${pageIndex}-${index}-${itemKey(item)}`}
                      item={item}
                      organizationName={
                        branding.organizationName || branding.productName
                      }
                      productName={
                        branding.organizationName
                          ? branding.productName
                          : ''
                      }
                      logoUrl={branding.logoUrl}
                      composition={compositionFor(item, catalog)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="text-xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
    </div>
  )
}

function compositionFor(
  item: LabelCatalogItem,
  catalog: CatalogState,
) {
  if (item.kind !== 'asset') return []

  const stockMap = new Map(
    catalog.stockUnits.map((row) => [row.id, row]),
  )
  const productMap = new Map(
    catalog.products.map((row) => [row.id, row]),
  )
  const itemMap = new Map(
    catalog.items.map((row) => [itemKey(row), row]),
  )

  const lines: string[] = []
  const genericIds = new Set<string>()

  for (const binding of catalog.genericBindings) {
    if (binding.asset_id !== item.id) continue

    genericIds.add(binding.stock_unit_id)
    const stock = stockMap.get(binding.stock_unit_id)
    if (!stock) continue

    const product = productMap.get(stock.product_id)
    lines.push(`${product?.name ?? 'Item'}: ${stock.short_code}`)
  }

  for (const binding of catalog.classicBindings) {
    if (
      binding.asset_id !== item.id ||
      genericIds.has(binding.stock_unit_id)
    ) {
      continue
    }

    const stock = stockMap.get(binding.stock_unit_id)
    if (!stock) continue

    const product = productMap.get(stock.product_id)
    lines.push(`${product?.name ?? 'Componente'}: ${stock.short_code}`)
  }

  for (const link of catalog.assetLinks) {
    if (link.parent_asset_id !== item.id) continue

    const child = itemMap.get(`asset:${link.child_asset_id}`)
    if (child) lines.push(`${child.typeName}: ${child.code}`)
  }

  if (lines.length <= 5) return lines
  return [...lines.slice(0, 4), `+ ${lines.length - 4} outros`]
}

function InventoryLabel({
  item,
  organizationName,
  productName,
  logoUrl,
  composition,
}: {
  item: LabelCatalogItem
  organizationName: string
  productName: string
  logoUrl: string | null
  composition: string[]
}) {
  const qrValue =
    item.kind === 'asset'
      ? `${window.location.origin}/ativo/${encodeURIComponent(item.code)}`
      : `${window.location.origin}/identificar/${encodeURIComponent(
          item.shortCode,
        )}`

  return (
    <div
      data-m12-label="true"
      className="box-border grid h-[50mm] w-[90mm] grid-cols-[29mm_1fr] gap-[2.5mm] overflow-hidden border border-slate-300 bg-white p-[3mm] text-slate-950"
    >
      <div className="flex items-center justify-center">
        <QRCode
          value={qrValue}
          size={102}
          level="M"
          style={{ width: '26mm', height: '26mm' }}
        />
      </div>

      <div className="min-w-0 overflow-hidden">
        <div className="flex min-h-[7mm] items-center gap-[1.5mm]">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              crossOrigin="anonymous"
              className="max-h-[6mm] max-w-[19mm] object-contain object-left"
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-[7pt] font-black uppercase leading-none">
              {organizationName}
            </div>
            {productName && (
              <div className="mt-[0.5mm] truncate text-[5pt] font-semibold text-slate-500">
                {productName}
              </div>
            )}
          </div>
        </div>

        {item.shortCode && (
          <div className="mt-[1mm] font-mono text-[13pt] font-black leading-none tracking-[0.08em]">
            {item.shortCode}
          </div>
        )}

        <div
          className={`font-mono font-black leading-none ${
            item.shortCode
              ? 'mt-[0.8mm] text-[6.5pt] text-slate-500'
              : 'mt-[1.5mm] text-[10pt]'
          }`}
        >
          {item.code}
        </div>

        <div className="mt-[1mm] truncate text-[6.2pt] font-bold">
          {item.typeName} · {item.title}
        </div>

        {item.serial && (
          <div className="mt-[0.7mm] truncate font-mono text-[5.5pt] text-slate-500">
            SN {item.serial}
          </div>
        )}

        {composition.length > 0 && (
          <div className="mt-[1mm] border-t border-slate-200 pt-[0.7mm]">
            <div className="mb-[0.4mm] text-[4.8pt] font-black uppercase tracking-[0.06em] text-slate-500">
              Composição
            </div>
            {composition.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className="truncate font-mono text-[5pt] font-semibold leading-[1.15]"
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
