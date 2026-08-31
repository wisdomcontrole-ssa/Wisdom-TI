import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  ScanText,
} from 'lucide-react'
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode'
import { useState } from 'react'
import {
  analyzeAssetLabel,
} from '../../lib/asset-label-ocr'
import type {
  AssetLabelAnalysis,
  ReviewedLabelData,
  SuggestionConfidence,
} from '../../types/asset-smart'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const confidenceLabels: Record<
  SuggestionConfidence,
  string
> = {
  high: 'Alta confiança',
  medium: 'Revisar',
  low: 'Confirmar',
}

const confidenceClass: Record<
  SuggestionConfidence,
  string
> = {
  high:
    'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium:
    'border-amber-200 bg-amber-50 text-amber-700',
  low:
    'border-red-200 bg-red-50 text-red-700',
}

export function SmartLabelReader({
  disabled = false,
  onApply,
}: {
  disabled?: boolean
  onApply: (
    data: ReviewedLabelData,
    file: File,
    analysis: AssetLabelAnalysis,
  ) => void
}) {
  const [scannerId] = useState(
    () =>
      `m13-barcode-${crypto.randomUUID()}`,
  )
  const [file, setFile] =
    useState<File | null>(null)
  const [analysis, setAnalysis] =
    useState<AssetLabelAnalysis | null>(
      null,
    )
  const [review, setReview] =
    useState<ReviewedLabelData>({
      manufacturer: '',
      model: '',
      serialNumber: '',
      serviceTag: '',
      productNumber: '',
      electricalRating: '',
    })
  const [processing, setProcessing] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function readBarcode(
    selected: File,
  ) {
    const scanner = new Html5Qrcode(
      scannerId,
      {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        verbose: false,
      },
    )

    try {
      const value =
        await scanner.scanFile(
          selected,
          false,
        )

      return value.trim()
        ? [value.trim()]
        : []
    } catch {
      return []
    } finally {
      try {
        scanner.clear()
      } catch {
        // Nenhuma UI persistente foi criada.
      }
    }
  }

  async function analyze(
    selected: File,
  ) {
    try {
      setProcessing(true)
      setErrorMessage(null)
      setAnalysis(null)
      setFile(selected)

      const barcodes =
        await readBarcode(selected)

      const result =
        await analyzeAssetLabel(
          selected,
          barcodes,
        )

      setAnalysis(result)
      setReview({
        manufacturer:
          result.fields.manufacturer
            ?.value ?? '',
        model:
          result.fields.model?.value ??
          '',
        serialNumber:
          result.fields.serialNumber
            ?.value ?? '',
        serviceTag:
          result.fields.serviceTag
            ?.value ?? '',
        productNumber:
          result.fields.productNumber
            ?.value ?? '',
        electricalRating:
          result.fields
            .electricalRating?.value ??
          '',
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível analisar a etiqueta.',
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
      <div
        id={scannerId}
        className="hidden"
      />

      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700">
          <ScanText size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-slate-950">
            Ler etiqueta automaticamente
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            A imagem é analisada no próprio aparelho. Primeiro tentamos o código de barras e depois o OCR.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white">
          <Camera size={15} />
          Tirar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={
              disabled || processing
            }
            onChange={(event) => {
              const selected =
                event.currentTarget
                  .files?.[0]

              if (selected) {
                void analyze(selected)
              }

              event.currentTarget.value =
                ''
            }}
          />
        </label>

        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
          <FileImage size={15} />
          Usar imagem
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={
              disabled || processing
            }
            onChange={(event) => {
              const selected =
                event.currentTarget
                  .files?.[0]

              if (selected) {
                void analyze(selected)
              }

              event.currentTarget.value =
                ''
            }}
          />
        </label>
      </div>

      {processing && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-200 bg-white p-3 text-xs font-semibold text-sky-700">
          <Loader2
            size={15}
            className="animate-spin"
          />
          Analisando etiqueta. A primeira leitura pode demorar mais para carregar o modelo OCR.
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle
            size={15}
            className="mt-0.5 shrink-0"
          />
          <div>
            <div className="font-bold">
              Leitura automática indisponível
            </div>
            <div className="mt-1">
              {errorMessage}
            </div>
            <div className="mt-1 text-red-600">
              O cadastro manual continua disponível.
            </div>
          </div>
        </div>
      )}

      {analysis && file && (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                Revisão obrigatória
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Confirme ou corrija antes de aplicar.
              </div>
            </div>

            <CheckCircle2
              size={18}
              className="text-emerald-600"
            />
          </div>

          <ReviewField
            label="Fabricante"
            value={review.manufacturer}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                manufacturer: value,
              }))
            }
            confidence={
              analysis.fields
                .manufacturer?.confidence
            }
          />

          <ReviewField
            label="Modelo"
            value={review.model}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                model: value,
              }))
            }
            confidence={
              analysis.fields.model
                ?.confidence
            }
          />

          <ReviewField
            label="Número de série"
            value={review.serialNumber}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                serialNumber: value,
              }))
            }
            confidence={
              analysis.fields
                .serialNumber?.confidence
            }
          />

          <ReviewField
            label="Service Tag"
            value={review.serviceTag}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                serviceTag: value,
              }))
            }
            confidence={
              analysis.fields.serviceTag
                ?.confidence
            }
          />

          <ReviewField
            label="Product / Part Number"
            value={review.productNumber}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                productNumber: value,
              }))
            }
            confidence={
              analysis.fields
                .productNumber?.confidence
            }
          />

          <ReviewField
            label="Alimentação"
            value={
              review.electricalRating
            }
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                electricalRating: value,
              }))
            }
            confidence={
              analysis.fields
                .electricalRating
                ?.confidence
            }
          />

          {analysis.barcodes.length >
            0 && (
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">
                Código de barras detectado
              </div>
              <div className="mt-1 break-all font-mono text-xs font-bold text-slate-700">
                {analysis.barcodes.join(
                  ' · ',
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              onApply(
                review,
                file,
                analysis,
              )
            }
            className="h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
          >
            Aplicar dados revisados
          </button>
        </div>
      )}
    </section>
  )
}

function ReviewField({
  label,
  value,
  confidence,
  onChange,
}: {
  label: string
  value: string
  confidence?:
    SuggestionConfidence
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">
          {label}
        </span>

        {confidence && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${confidenceClass[confidence]}`}
          >
            {
              confidenceLabels[
                confidence
              ]
            }
          </span>
        )}
      </div>

      <input
        className={inputClass}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  )
}
