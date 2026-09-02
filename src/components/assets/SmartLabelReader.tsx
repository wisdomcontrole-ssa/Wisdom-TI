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
import {
  useEffect,
  useRef,
  useState,
} from 'react'
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

  const [cameraOpen, setCameraOpen] =
    useState(false)
  const [cameraStarting, setCameraStarting] =
    useState(false)
  const [cameraTaking, setCameraTaking] =
    useState(false)
  const [cameraError, setCameraError] =
    useState<string | null>(null)
  const videoRef =
    useRef<HTMLVideoElement | null>(null)
  const streamRef =
    useRef<MediaStream | null>(null)
  const cameraSessionRef = useRef(0)

  function stopCameraStream() {
    streamRef.current?.getTracks()
      .forEach((track) => track.stop())

    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  function closeCamera() {
    cameraSessionRef.current += 1
    stopCameraStream()
    setCameraOpen(false)
    setCameraStarting(false)
    setCameraTaking(false)
    setCameraError(null)
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks()
        .forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  async function waitForCameraView() {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(
          () => resolve(),
        )
      })
    })
  }

  async function requestRearStream() {
    if (
      !navigator.mediaDevices
        ?.getUserMedia
    ) {
      throw new Error(
        'Este navegador não disponibiliza acesso direto à câmera.',
      )
    }

    const baseVideo = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    }

    try {
      return await navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: {
            ...baseVideo,
            facingMode: {
              exact: 'environment',
            },
          },
        })
    } catch (error) {
      if (
        error instanceof DOMException &&
        (
          error.name ===
            'NotAllowedError' ||
          error.name ===
            'SecurityError'
        )
      ) {
        throw error
      }

      const fallback =
        await navigator.mediaDevices
          .getUserMedia({
            audio: false,
            video: {
              ...baseVideo,
              facingMode: {
                ideal: 'environment',
              },
            },
          })

      const track =
        fallback.getVideoTracks()[0]

      const settings =
        track?.getSettings()
      const label =
        track?.label.toLowerCase() ??
        ''

      if (
        settings?.facingMode ===
          'user' ||
        /front|frontal|selfie|user/.test(
          label,
        )
      ) {
        fallback.getTracks().forEach(
          (item) => item.stop(),
        )

        throw new Error(
          'O navegador selecionou a câmera frontal. A leitura de etiqueta exige a câmera traseira.',
          { cause: error },
        )
      }

      return fallback
    }
  }

  async function openRearCamera() {
    if (disabled || processing) {
      return
    }

    const session =
      cameraSessionRef.current + 1

    cameraSessionRef.current = session
    stopCameraStream()
    setCameraError(null)
    setCameraOpen(true)
    setCameraStarting(true)

    try {
      await waitForCameraView()

      const stream =
        await requestRearStream()

      if (
        session !==
        cameraSessionRef.current
      ) {
        stream.getTracks().forEach(
          (track) => track.stop(),
        )
        return
      }

      const video = videoRef.current

      if (!video) {
        stream.getTracks().forEach(
          (track) => track.stop(),
        )
        throw new Error(
          'Não foi possível iniciar a visualização da câmera.',
        )
      }

      streamRef.current = stream
      video.srcObject = stream
      await video.play()
    } catch (error) {
      stopCameraStream()
      setCameraError(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir a câmera traseira.',
      )
    } finally {
      if (
        session ===
        cameraSessionRef.current
      ) {
        setCameraStarting(false)
      }
    }
  }

  async function captureRearPhoto() {
    const video = videoRef.current

    if (
      !video ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      setCameraError(
        'A câmera ainda não está pronta para fotografar.',
      )
      return
    }

    try {
      setCameraTaking(true)
      setCameraError(null)

      const canvas =
        document.createElement('canvas')

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context =
        canvas.getContext('2d')

      if (!context) {
        throw new Error(
          'Não foi possível preparar a captura da câmera.',
        )
      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      const blob =
        await new Promise<Blob>(
          (resolve, reject) => {
            canvas.toBlob(
              (value) => {
                if (value) {
                  resolve(value)
                  return
                }

                reject(
                  new Error(
                    'Não foi possível gerar a foto da etiqueta.',
                  ),
                )
              },
              'image/jpeg',
              0.92,
            )
          },
        )

      const timestamp =
        new Date()
          .toISOString()
          .replace(/[:.]/g, '-')

      const selected = new File(
        [blob],
        `etiqueta-${timestamp}.jpg`,
        {
          type: 'image/jpeg',
          lastModified: Date.now(),
        },
      )

      closeCamera()
      await analyze(selected)
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : 'Não foi possível fotografar a etiqueta.',
      )
    } finally {
      setCameraTaking(false)
    }
  }

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
        <button
          type="button"
          onClick={() =>
            void openRearCamera()
          }
          disabled={
            disabled || processing
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera size={15} />
          Tirar foto
        </button>

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

      {cameraOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950 text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-black">
                Fotografar etiqueta
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300">
                Câmera traseira do aparelho
              </div>
            </div>

            <button
              type="button"
              onClick={closeCamera}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold"
            >
              Fechar
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />

            {cameraStarting && (
              <div className="absolute inset-0 grid place-items-center bg-black/70">
                <div className="flex items-center gap-2 rounded-xl bg-black/60 px-4 py-3 text-sm font-semibold">
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Abrindo câmera traseira...
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-red-400/40 bg-red-950/90 p-4 text-sm text-red-100">
                <div className="font-black">
                  Câmera traseira indisponível
                </div>
                <div className="mt-1 text-xs leading-5">
                  {cameraError}
                </div>
              </div>
            )}

            {!cameraStarting &&
              !cameraError && (
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/60">
                <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/55 px-3 py-2 text-center text-[11px] font-semibold text-white">
                  Enquadre toda a etiqueta e mantenha o aparelho firme.
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_2fr] gap-2 border-t border-white/10 bg-slate-950 p-4">
            <button
              type="button"
              onClick={closeCamera}
              className="h-12 rounded-xl border border-white/20 text-sm font-bold"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() =>
                void captureRearPhoto()
              }
              disabled={
                cameraStarting ||
                cameraTaking ||
                Boolean(cameraError)
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cameraTaking ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Camera size={17} />
              )}
              Fotografar etiqueta
            </button>
          </div>
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
