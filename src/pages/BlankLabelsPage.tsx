import { useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { Button } from '../components/ui/Button'
import { useBranding } from '../branding/BrandContext'
import { issuePreprintedLabels } from '../data/preprinted-labels-service'

const BATCH_OPTIONS = [12, 24, 36, 50, 60, 100]
const LABELS_PER_PAGE = 12

function chunkRows<T>(items: T[], size: number) {
  const pages: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size))
  }
  return pages
}

export function BlankLabelsPage() {
  const { branding } = useBranding()
  const [quantity, setQuantity] = useState<number>(50)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [labels, setLabels] = useState<string[]>([])

  const printable = useMemo(
    () =>
      labels.map((code) => ({ code })),
    [labels],
  )

  const pages = useMemo(
    () => chunkRows(printable, LABELS_PER_PAGE),
    [printable],
  )

  async function handleGenerate() {
    try {
      setLoading(true)
      setErrorMessage(null)
      const response = await issuePreprintedLabels(quantity)
      setLabels(response.codes)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível emitir as etiquetas.'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  const logoUrl = branding.logoUrl
  const organizationName =
    branding.organizationName || branding.productName

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body * { visibility: hidden !important; }
          #m18-print-area, #m18-print-area * { visibility: visible !important; }
          #m18-print-area { position: absolute !important; left: 0; top: 0; width: 297mm !important; padding: 0 !important; margin: 0 !important; }
          .m18-print-page { display: grid !important; grid-template-columns: repeat(3,90mm) !important; grid-template-rows: repeat(4,50mm) !important; gap: 0 !important; width: 297mm !important; height: 210mm !important; padding: 5mm 13.5mm !important; box-sizing: border-box !important; break-after: page !important; }
          .m18-print-page:last-child { break-after: auto !important; }
          .m18-label { width: 90mm !important; height: 50mm !important; box-sizing: border-box !important; break-inside: avoid !important; }
        }
      `}</style>
      <PageHeader
        eyebrow="Patrimônio"
        title="Etiquetas antecipadas"
        description="Emita lotes de etiquetas para colar primeiro e cadastrar depois pela leitura do QR Code."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Gerando...' : `Gerar ${quantity} etiquetas`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrint}
              disabled={labels.length === 0}
            >
              Imprimir
            </Button>
          </div>
        }
      />

      <SectionCard title="Lote">
        <div className="flex flex-wrap gap-2">
          {BATCH_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setQuantity(option)}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-semibold transition',
                quantity === option
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
              ].join(' ')}
            >
              {option} etiquetas
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          A etiqueta antecipada usa o mesmo padrão visual da etiqueta patrimonial.
          O QR Code continua sendo o identificador principal para abrir o cadastro rápido.
        </p>
        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </SectionCard>

      {labels.length > 0 ? (
        <SectionCard
          title="Pré-visualização"
          description={`${labels.length} etiquetas geradas. ${pages.length} folha(s) no padrão A4 com 12 etiquetas por folha.`}
        >
          <div id="m18-print-area" className="space-y-8 print:space-y-0">
            {pages.map((page, pageIndex) => (
              <div
                key={`page-${pageIndex}`}
                className="m18-print-page grid grid-cols-1 gap-4 xl:grid-cols-3 print:gap-0"
              >
                {page.map((label) => (
                  <article
                    key={label.code}
                    className="m18-label break-inside-avoid rounded-none border border-slate-300 bg-white p-3 shadow-sm print:shadow-none"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-sm border border-slate-200 p-1">
                        <QRCode
                          value={label.code}
                          size={92}
                          style={{ height: '92px', width: '92px' }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={organizationName}
                              className="h-8 w-auto max-w-[90px] object-contain"
                            />
                          ) : (
                            <div className="text-[10px] font-black tracking-[0.22em] text-slate-900">
                              {organizationName.toUpperCase()}
                            </div>
                          )}
                          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Inventário TI
                          </div>
                        </div>

                        <div className="mt-2 text-[18px] font-black leading-none tracking-tight text-slate-950">
                          {label.code}
                        </div>

                        <div className="mt-1 text-[10px] font-medium leading-snug text-slate-700">
                          Cadastro posterior por leitura do QR Code
                        </div>

                        <div className="mt-1 text-[9px] leading-snug text-slate-500">
                          Tipo / Fabricante / Modelo / S/N: preenchimento posterior
                        </div>

                        <div className="mt-1 text-[9px] text-slate-400">
                          Identificação antecipada
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                {page.length < LABELS_PER_PAGE
                  ? Array.from({ length: LABELS_PER_PAGE - page.length }).map((_, emptyIndex) => (
                      <div key={`empty-${pageIndex}-${emptyIndex}`} className="hidden print:block" />
                    ))
                  : null}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}