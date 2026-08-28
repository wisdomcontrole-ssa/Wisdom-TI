import {
  Camera,
  CameraOff,
  FileImage,
  Keyboard,
  ScanLine,
} from 'lucide-react'
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'

export type InventoryScanMethod =
  | 'qr'
  | 'manual'
  | 'file'

export function InventoryScanner({
  disabled = false,
  onScan,
  compact = false,
}: {
  disabled?: boolean
  onScan: (
    value: string,
    method: InventoryScanMethod,
  ) => Promise<void>
  compact?: boolean
}) {
  const [scannerId] = useState(
    () => `inventory-scanner-${crypto.randomUUID()}`,
  )
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lockRef = useRef(false)

  const [cameraRunning, setCameraRunning] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scannerError, setScannerError] =
    useState<string | null>(null)

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      if (!scanner) return

      void scanner
        .stop()
        .catch(() => undefined)
        .finally(() => {
          void scanner.clear()
        })
    }
  }, [])

  function ensureScanner() {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(scannerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      })
    }

    return scannerRef.current
  }

  async function dispatchScan(
    value: string,
    method: InventoryScanMethod,
  ) {
    if (lockRef.current) return

    const clean = value.trim()
    if (!clean) return

    lockRef.current = true
    setScannerError(null)

    try {
      await onScan(clean, method)
    } catch (error) {
      setScannerError(
        error instanceof Error
          ? error.message
          : 'Não foi possível processar o código.',
      )
    } finally {
      window.setTimeout(() => {
        lockRef.current = false
      }, 700)
    }
  }

  async function startCamera() {
    if (disabled || cameraRunning || cameraStarting) return

    try {
      setCameraStarting(true)
      setScannerError(null)
      const scanner = ensureScanner()

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (width, height) => {
            const edge = Math.floor(
              Math.min(width, height) * 0.68,
            )
            return { width: edge, height: edge }
          },
          aspectRatio: 1,
        },
        (decodedText) => {
          void dispatchScan(decodedText, 'qr')
        },
        () => undefined,
      )

      setCameraRunning(true)
    } catch (error) {
      setScannerError(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a câmera.',
      )
    } finally {
      setCameraStarting(false)
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current
    if (!scanner || !cameraRunning) return

    try {
      await scanner.stop()
    } catch {
      // Pode já ter sido interrompido pelo navegador.
    } finally {
      setCameraRunning(false)
    }
  }

  async function scanFile(file: File) {
    try {
      setScannerError(null)
      if (cameraRunning) await stopCamera()

      const scanner = ensureScanner()
      const decoded = await scanner.scanFile(file, true)
      await dispatchScan(decoded, 'file')
    } catch (error) {
      setScannerError(
        error instanceof Error
          ? error.message
          : 'Nenhum QR Code válido foi encontrado.',
      )
    }
  }

  async function submitManual(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    const value = manualCode.trim()
    if (!value) return

    await dispatchScan(value, 'manual')
    setManualCode('')
  }

  return (
    <section
      className={
        compact
          ? 'space-y-3'
          : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
      }
    >
      {!compact && (
        <div className="mb-4 flex items-center gap-2">
          <ScanLine size={17} className="text-slate-500" />
          <div>
            <div className="text-sm font-bold text-slate-900">
              Leitor universal
            </div>
            <div className="text-xs text-slate-500">
              QR Code, código completo ou código curto.
            </div>
          </div>
        </div>
      )}

      <div
        id={scannerId}
        className={`overflow-hidden rounded-2xl bg-slate-950 ${
          cameraRunning ? 'min-h-64' : 'min-h-0'
        }`}
      />

      {scannerError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {scannerError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            void (cameraRunning ? stopCamera() : startCamera())
          }
          disabled={disabled || cameraStarting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40"
        >
          {cameraRunning ? <CameraOff size={15} /> : <Camera size={15} />}
          {cameraStarting
            ? 'Abrindo...'
            : cameraRunning
              ? 'Parar câmera'
              : 'Usar câmera'}
        </button>

        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
          <FileImage size={15} />
          Ler imagem
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void scanFile(file)
              event.currentTarget.value = ''
            }}
          />
        </label>

        <form
          onSubmit={(event) => void submitManual(event)}
          className="col-span-2 flex h-11 sm:col-span-1"
        >
          <div className="relative min-w-0 flex-1">
            <Keyboard
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              disabled={disabled}
              className="h-11 w-full rounded-l-xl border border-r-0 border-slate-200 bg-white pl-9 pr-2 font-mono text-xs uppercase outline-none focus:border-sky-400 disabled:bg-slate-50"
              placeholder="K7M4Q2"
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !manualCode.trim()}
            className="rounded-r-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
          >
            OK
          </button>
        </form>
      </div>
    </section>
  )
}
