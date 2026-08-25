import {
  Printer,
  QrCode as QrCodeIcon,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import type { AssetRecord } from '../../types/assets'

export function AssetQrLabelCard({
  asset,
  typeName,
}: {
  asset: AssetRecord
  typeName: string
}) {
  const qrTarget = `${window.location.origin}/ativo/${asset.asset_code}`
  const labelId = `asset-label-${asset.id}`

  function printLabel() {
    const label = document.getElementById(labelId)

    if (!label) {
      return
    }

    const popup = window.open(
      '',
      '_blank',
      'width=560,height=420',
    )

    if (!popup) {
      return
    }

    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${asset.asset_code}</title>
        <style>
          @page { size: 60mm 35mm; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            width: 60mm;
            height: 35mm;
            font-family: Arial, Helvetica, sans-serif;
          }
          .wisdom-label {
            box-sizing: border-box;
            width: 60mm;
            height: 35mm;
            padding: 3mm;
            display: grid;
            grid-template-columns: 25mm 1fr;
            gap: 3mm;
            align-items: center;
            border: 0.25mm solid #d1d5db;
          }
          .qr-wrap svg {
            width: 24mm !important;
            height: 24mm !important;
          }
          .brand {
            font-size: 8pt;
            font-weight: 800;
            letter-spacing: .08em;
          }
          .code {
            margin-top: 2mm;
            font-family: Consolas, monospace;
            font-size: 10pt;
            font-weight: 800;
          }
          .desc {
            margin-top: 1.5mm;
            font-size: 7pt;
            line-height: 1.25;
          }
          button { display: none !important; }
        </style>
      </head>
      <body>
        ${label.outerHTML}
        <script>
          window.addEventListener('load', () => {
            window.print();
            window.setTimeout(() => window.close(), 400);
          });
        </script>
      </body>
      </html>
    `)

    popup.document.close()
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
          <QrCodeIcon size={14} />
          QR patrimonial
        </div>

        <button
          type="button"
          onClick={printLabel}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <Printer size={14} />
          Imprimir etiqueta
        </button>
      </div>

      <div
        id={labelId}
        className="wisdom-label mt-4 grid grid-cols-[150px_1fr] items-center gap-4 rounded-2xl border border-slate-200 p-4"
      >
        <div className="qr-wrap rounded-xl bg-white p-2">
          <QRCode
            value={qrTarget}
            size={136}
            level="M"
            style={{
              height: 'auto',
              maxWidth: '100%',
              width: '100%',
            }}
          />
        </div>

        <div className="min-w-0">
          <div className="brand text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            Wisdom TI
          </div>

          <div className="code mt-2 break-all font-mono text-sm font-black text-slate-950">
            {asset.asset_code}
          </div>

          <div className="desc mt-2 text-xs leading-5 text-slate-500">
            {typeName}
            {asset.manufacturer
              ? ` · ${asset.manufacturer}`
              : ''}
            {asset.model ? ` ${asset.model}` : ''}
          </div>

          {asset.serial_number && (
            <div className="desc mt-1 truncate font-mono text-[10px] text-slate-400">
              SN {asset.serial_number}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 break-all font-mono text-[10px] text-slate-400">
        {qrTarget}
      </div>
    </section>
  )
}
