import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  RefreshCw,
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

const REAR_CAMERA_STORAGE_KEY =
  'wisdom-ti:rear-camera-device:v2'

const frontCameraPattern =
  /front|frontal|selfie|user|face|facing\s*front/i
const rearCameraPattern =
  /back|rear|environment|traseir|traser|facing\s*back|world/i
const secondaryRearPattern =
  /wide|ultra|tele|macro|0\.5x|1x|2x|3x/i

function cameraScore(
  device: MediaDeviceInfo,
) {
  const label = device.label.toLowerCase()
  let score = 0

  if (rearCameraPattern.test(label)) {
    score += 200
  }

  if (secondaryRearPattern.test(label)) {
    score += 40
  }

  if (frontCameraPattern.test(label)) {
    score -= 500
  }

  return score
}

function streamLooksFront(
  stream: MediaStream,
) {
  const track = stream.getVideoTracks()[0]
  const settings = track?.getSettings()
  const label = track?.label ?? ''

  return (
    settings?.facingMode === 'user' ||
    frontCameraPattern.test(label)
  )
}

function stopStream(
  stream: MediaStream | null,
) {
  stream?.getTracks().forEach(
    (track) => track.stop(),
  )
}

function readStoredRearDevice() {
  try {
    return window.localStorage.getItem(
      REAR_CAMERA_STORAGE_KEY,
    )
  } catch {
    return null
  }
}

function storeRearDevice(
  deviceId: string | undefined,
) {
  if (!deviceId) return

  try {
    window.localStorage.setItem(
      REAR_CAMERA_STORAGE_KEY,
      deviceId,
    )
  } catch {
    // O navegador pode bloquear storage privado.
  }
}

function humanOcrStatus(status: string) {
  const normalized = status.toLowerCase()

  if (normalized.includes('loading language')) {
    return 'Carregando idioma OCR local'
  }

  if (normalized.includes('loading tesseract core')) {
    return 'Carregando motor OCR local'
  }

  if (normalized.includes('initializing')) {
    return 'Inicializando OCR'
  }

  if (normalized.includes('recognizing')) {
    return 'Reconhecendo texto da etiqueta'
  }

  return status || 'Analisando etiqueta'
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
  const [ocrProgress, setOcrProgress] =
    useState(0)
  const [ocrStatus, setOcrStatus] =
    useState('Preparando leitura')

  const [cameraOpen, setCameraOpen] =
    useState(false)
  const [cameraStarting, setCameraStarting] =
    useState(false)
  const [cameraTaking, setCameraTaking] =
    useState(false)
  const [cameraError, setCameraError] =
    useState<string | null>(null)
  const [cameraLabel, setCameraLabel] =
    useState('Câmera traseira')
  const [cameraCount, setCameraCount] =
    useState(0)

  const videoRef =
    useRef<HTMLVideoElement | null>(null)
  const streamRef =
    useRef<MediaStream | null>(null)
  const cameraDevicesRef =
    useRef<MediaDeviceInfo[]>([])
  const activeDeviceIdRef =
    useRef<string | null>(null)
  const cameraSessionRef = useRef(0)

  function stopCameraStream() {
    stopStream(streamRef.current)
    streamRef.current = null
    activeDeviceIdRef.current = null

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
      stopStream(streamRef.current)
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

  async function requestDeviceStream(
    deviceId: string,
  ) {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    })
  }

  async function getLabeledVideoDevices() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      throw new Error(
        'Este navegador não disponibiliza a API moderna de câmera.',
      )
    }

    let permissionProbe:
      | MediaStream
      | null = null

    try {
      permissionProbe =
        await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        })
    } catch (error) {
      throw new Error(
        'Permita o acesso à câmera para fotografar a etiqueta.',
        { cause: error },
      )
    } finally {
      stopStream(permissionProbe)
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(
        () => resolve(),
        120,
      )
    })

    const devices =
      await navigator.mediaDevices.enumerateDevices()

    return devices.filter(
      (device) =>
        device.kind === 'videoinput',
    )
  }

  async function requestRearStream() {
    const devices =
      await getLabeledVideoDevices()

    cameraDevicesRef.current = devices
    setCameraCount(devices.length)

    const storedDeviceId =
      readStoredRearDevice()

    const candidates = [...devices]
      .sort(
        (left, right) =>
          cameraScore(right) -
          cameraScore(left),
      )

    const orderedIds = [
      storedDeviceId,
      ...candidates.map(
        (device) => device.deviceId,
      ),
    ].filter(
      (
        value,
        index,
        all,
      ): value is string =>
        Boolean(value) &&
        all.indexOf(value) === index,
    )

    for (const deviceId of orderedIds) {
      const device = devices.find(
        (item) =>
          item.deviceId === deviceId,
      )

      if (
        device &&
        frontCameraPattern.test(
          device.label,
        )
      ) {
        continue
      }

      try {
        const stream =
          await requestDeviceStream(deviceId)

        if (streamLooksFront(stream)) {
          stopStream(stream)
          continue
        }

        const track =
          stream.getVideoTracks()[0]
        const actualDeviceId =
          track?.getSettings().deviceId ??
          deviceId

        storeRearDevice(actualDeviceId)

        return {
          stream,
          deviceId: actualDeviceId,
          label:
            track?.label ||
            device?.label ||
            'Câmera traseira',
        }
      } catch {
        // Tenta a próxima câmera física.
      }
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: {
              exact: 'environment',
            },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })

      if (streamLooksFront(stream)) {
        stopStream(stream)
        throw new Error(
          'O navegador retornou a câmera frontal mesmo com a câmera traseira exigida.',
        )
      }

      const track = stream.getVideoTracks()[0]
      const actualDeviceId =
        track?.getSettings().deviceId

      storeRearDevice(actualDeviceId)

      return {
        stream,
        deviceId:
          actualDeviceId ?? '',
        label:
          track?.label ||
          'Câmera traseira',
      }
    } catch (error) {
      throw new Error(
        'Não foi possível selecionar uma câmera traseira neste aparelho.',
        { cause: error },
      )
    }
  }

  async function attachCameraStream(
    stream: MediaStream,
    deviceId: string,
    label: string,
  ) {
    const video = videoRef.current

    if (!video) {
      stopStream(stream)
      throw new Error(
        'Não foi possível iniciar a visualização da câmera.',
      )
    }

    stopCameraStream()
    streamRef.current = stream
    activeDeviceIdRef.current = deviceId
    setCameraLabel(label)
    video.srcObject = stream
    await video.play()
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

      const selected =
        await requestRearStream()

      if (
        session !==
        cameraSessionRef.current
      ) {
        stopStream(selected.stream)
        return
      }

      await attachCameraStream(
        selected.stream,
        selected.deviceId,
        selected.label,
      )
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

  async function switchCamera() {
    const devices =
      cameraDevicesRef.current

    if (devices.length < 2) return

    const currentId =
      activeDeviceIdRef.current
    const ordered = [...devices]
      .sort(
        (left, right) =>
          cameraScore(right) -
          cameraScore(left),
      )
      .filter(
        (device) =>
          !frontCameraPattern.test(
            device.label,
          ),
      )

    const currentIndex =
      ordered.findIndex(
        (device) =>
          device.deviceId === currentId,
      )

    const next =
      ordered[
        (currentIndex + 1) %
          ordered.length
      ]

    if (!next) return

    try {
      setCameraStarting(true)
      setCameraError(null)

      const stream =
        await requestDeviceStream(
          next.deviceId,
        )

      if (streamLooksFront(stream)) {
        stopStream(stream)
        throw new Error(
          'A câmera selecionada é frontal.',
        )
      }

      await attachCameraStream(
        stream,
        next.deviceId,
        next.label || 'Câmera traseira',
      )
      storeRearDevice(next.deviceId)
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : 'Não foi possível trocar a câmera.',
      )
    } finally {
      setCameraStarting(false)
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
              0.94,
            )
          },
        )

      const timestamp = new Date()
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
      setOcrProgress(0)
      setOcrStatus('Procurando código de barras')

      const barcodes =
        await readBarcode(selected)

      const result =
        await analyzeAssetLabel(
          selected,
          barcodes,
          (progress, status) => {
            setOcrProgress(progress)
            setOcrStatus(
              humanOcrStatus(status),
            )
          },
        )

      setAnalysis(result)
      setReview({
        manufacturer:
          result.fields.manufacturer
            ?.value ?? '',
        model:
          result.fields.model?.value ?? '',
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
          result.fields.electricalRating
            ?.value ?? '',
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
            A foto é processada no próprio aparelho com OCR local Tesseract. Código de barras é lido primeiro.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            void openRearCamera()
          }
          disabled={disabled || processing}
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
            disabled={disabled || processing}
            onChange={(event) => {
              const selected =
                event.currentTarget.files?.[0]

              if (selected) {
                void analyze(selected)
              }

              event.currentTarget.value = ''
            }}
          />
        </label>
      </div>

      {processing && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-white p-3 text-xs font-semibold text-sky-700">
          <div className="flex items-center gap-2">
            <Loader2
              size={15}
              className="animate-spin"
            />
            <span>{ocrStatus}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
            <div
              className="h-full rounded-full bg-sky-600 transition-[width] duration-200"
              style={{
                width:
                  `${Math.round(ocrProgress * 100)}%`,
              }}
            />
          </div>
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
              analysis.fields.manufacturer
                ?.confidence
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
              analysis.fields.model?.confidence
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
              analysis.fields.serialNumber
                ?.confidence
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
              analysis.fields.productNumber
                ?.confidence
            }
          />

          <ReviewField
            label="Alimentação"
            value={review.electricalRating}
            onChange={(value) =>
              setReview((current) => ({
                ...current,
                electricalRating: value,
              }))
            }
            confidence={
              analysis.fields.electricalRating
                ?.confidence
            }
          />

          {analysis.barcodes.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">
                Código de barras detectado
              </div>
              <div className="mt-1 break-all font-mono text-xs font-bold text-slate-700">
                {analysis.barcodes.join(' · ')}
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
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-black">
                Fotografar etiqueta
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-300">
                {cameraLabel}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {cameraCount > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    void switchCamera()
                  }
                  disabled={cameraStarting}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Trocar
                </button>
              )}

              <button
                type="button"
                onClick={closeCamera}
                className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold"
              >
                Fechar
              </button>
            </div>
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
                  Selecionando câmera traseira...
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
                  Enquadre toda a etiqueta, evite reflexos e mantenha o aparelho firme.
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
  confidence?: SuggestionConfidence
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
            {confidenceLabels[confidence]}
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
