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
import type { AuditScanMethod } from '../../types/audit'

interface Props {
  disabled?: boolean
  onScan: (
    value: string,
    method: AuditScanMethod,
  ) => Promise<void>
}

export function AuditScanner({
  disabled = false,
  onScan,
}: Props) {
  const [scannerId] = useState(
    () =>
      `wisdom-audit-scanner-${crypto.randomUUID()}`,
  )
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lockRef = useRef(false)

  const [cameraRunning, setCameraRunning] =
    useState(false)
  const [cameraStarting, setCameraStarting] =
    useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scannerError, setScannerError] =
    useState<string | null>(null)

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current

      if (!scanner) {
        return
      }

      void scanner
        .stop()
        .catch(() => undefined)
        .finally(() => {
          void scanner.clear()
        })
    }
  }, [])

  async function dispatchScan(
    value: string,
    method: AuditScanMethod,
  ) {
    if (lockRef.current) {
      return
    }

    lockRef.current = true

    try {
      await onScan(value, method)
    } finally {
      window.setTimeout(() => {
        lockRef.current = false
      }, 1000)
    }
  }

  function ensureScanner() {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(
        scannerId,
        {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        },
      )
    }

    return scannerRef.current
  }

  async function startCamera() {
    if (disabled || cameraRunning || cameraStarting) {
      return
    }

    try {
      setCameraStarting(true)
      setScannerError(null)

      const scanner = ensureScanner()

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const edge = Math.floor(
              Math.min(
                viewfinderWidth,
                viewfinderHeight,
              ) * 0.68,
            )

            return {
              width: edge,
              height: edge,
            }
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

    if (!scanner || !cameraRunning) {
      return
    }

    try {
      await scanner.stop()
    } catch {
      // O scanner pode já ter sido interrompido pelo navegador.
    } finally {
      setCameraRunning(false)
    }
  }

  async function scanFile(file: File) {
    try {
      setScannerError(null)

      if (cameraRunning) {
        await stopCamera()
      }

      const scanner = ensureScanner()
      const decodedText = await scanner.scanFile(
        file,
        true,
      )

      await dispatchScan(decodedText, 'file')
    } catch (error) {
      setScannerError(
        error instanceof Error
          ? error.message
          : 'Nenhum QR Code válido foi encontrado na imagem.',
      )
    }
  }

  async function submitManual(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const value = manualCode.trim()

    if (!value) {
      return
    }

    await dispatchScan(value, 'manual')
    setManualCode('')
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanLine
            size={16}
            className="text-slate-500"
          />
          <div>
            <div className="text-xs font-bold text-slate-900">
              Leitura do patrimônio
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              Câmera, imagem ou código manual
            </div>
          </div>
        </div>

        {cameraRunning && (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700">
            câmera ativa
          </span>
        )}
      </header>

      <div className="p-3 sm:p-4">
        <div
          id={scannerId}
          className={`overflow-hidden rounded-2xl bg-slate-950 ${
            cameraRunning
              ? 'min-h-[260px]'
              : 'h-0'
          }`}
        />

        {scannerError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {scannerError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {!cameraRunning ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={disabled || cameraStarting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40"
            >
              <Camera size={15} />
              {cameraStarting
                ? 'Abrindo...'
                : 'Usar câmera'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
            >
              <CameraOff size={15} />
              Parar câmera
            </button>
          )}

          <label
            className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 ${
              disabled
                ? 'pointer-events-none opacity-40'
                : ''
            }`}
          >
            <FileImage size={15} />
            Ler imagem
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0]

                if (file) {
                  void scanFile(file)
                }

                event.currentTarget.value = ''
              }}
            />
          </label>

          <div className="col-span-2 sm:col-span-1">
            <form
              onSubmit={(event) =>
                void submitManual(event)
              }
              className="flex h-11"
            >
              <div className="relative min-w-0 flex-1">
                <Keyboard
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={manualCode}
                  onChange={(event) =>
                    setManualCode(
                      event.target.value,
                    )
                  }
                  disabled={disabled}
                  className="h-11 w-full rounded-l-xl border border-r-0 border-slate-200 bg-white pl-9 pr-2 text-xs outline-none focus:border-sky-400 disabled:bg-slate-50"
                  placeholder="WIS-DT-000001"
                />
              </div>

              <button
                type="submit"
                disabled={
                  disabled || !manualCode.trim()
                }
                className="rounded-r-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                OK
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
