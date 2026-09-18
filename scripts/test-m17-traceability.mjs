import fs from 'node:fs'

const read = (path) =>
  fs.readFileSync(path, 'utf8')

const express = read(
  'src/components/assets/ExpressAssetModal.tsx',
)
const scanner = read(
  'src/components/field/InventoryScanner.tsx',
)
const auditScanner = read(
  'src/components/audits/AuditScanner.tsx',
)
const auditPage = read(
  'src/pages/AuditExecutionPage.tsx',
)
const fieldOps = read(
  'src/data/field-ops-service.ts',
)
const labels = read(
  'src/pages/LabelsPage.tsx',
)
const smart = read(
  'src/components/assets/AssetSmartMetadataCard.tsx',
)
const qrCard = read(
  'src/components/assets/AssetQrLabelCard.tsx',
)
const scanPage = read(
  'src/pages/FieldScannerPage.tsx',
)

const checks = [
  [
    'Express: Código de terceiro continua no cadastro',
    express.includes(
      'thirdPartyCode',
    ) &&
      express.includes(
        'addAssetExternalIdentifier',
      ),
  ],
  [
    'Express: leitura de serial por código de barras',
    express.includes(
      'serialScannerOpen',
    ) &&
      express.includes(
        'setSerialScannerOpen',
      ),
  ],
  [
    'Express: leitura de código de terceiro',
    express.includes(
      'thirdPartyScannerOpen',
    ) &&
      express.includes(
        'setThirdPartyScannerOpen',
      ),
  ],
  [
    'Scanner: Code 128',
    scanner.includes(
      'Html5QrcodeSupportedFormats.CODE_128',
    ),
  ],
  [
    'Scanner: Code 39',
    scanner.includes(
      'Html5QrcodeSupportedFormats.CODE_39',
    ),
  ],
  [
    'Scanner: EAN 13',
    scanner.includes(
      'Html5QrcodeSupportedFormats.EAN_13',
    ),
  ],
  [
    'Scanner: texto universal',
    scanner.includes(
      'código de terceiro',
    ),
  ],
  [
    'Auditoria: Code 128',
    auditScanner.includes(
      'Html5QrcodeSupportedFormats.CODE_128',
    ),
  ],
  [
    'Auditoria: sem prefixo institucional antigo',
    !auditScanner.includes(
      'WIS-DT-000001',
    ),
  ],
  [
    'Auditoria: pré-resolve serial/terceiro',
    auditPage.includes(
      'resolveInventoryCode(value)',
    ),
  ],
  [
    'Resolver: identificadores de terceiro',
    fieldOps.includes(
      "from('asset_external_identifiers')",
    ),
  ],
  [
    'Resolver: serial fabricante',
    fieldOps.includes(
      "ilike('serial_number'",
    ),
  ],
  [
    'Resolver: ambiguidade terceiro',
    fieldOps.includes(
      'Código de terceiro associado a mais de um ativo',
    ),
  ],
  [
    'Resolver: ambiguidade serial',
    fieldOps.includes(
      'Número de série associado a mais de um ativo',
    ),
  ],
  [
    'Etiquetas: terceiro no catálogo',
    fieldOps.includes(
      'thirdPartyCode',
    ),
  ],
  [
    'Etiquetas: terceiro impresso',
    labels.includes(
      'Terceiro:',
    ),
  ],
  [
    'Ficha: Código de terceiro',
    smart.includes(
      'Códigos de terceiro e referências',
    ),
  ],
  [
    'Ficha: scanner terceiro',
    smart.includes(
      '<InventoryScanner',
    ),
  ],
  [
    'Etiqueta individual: terceiro',
    qrCard.includes(
      'Terceiro:',
    ),
  ],
  [
    'Scanner de campo: instrução barcode',
    scanPage.includes(
      'código de barras',
    ),
  ],
]

const failed = checks.filter(
  ([, ok]) => !ok,
)

for (const [label, ok] of checks) {
  console.log(
    `${ok ? '[OK]' : '[ERRO]'} ${label}`,
  )
}

if (failed.length > 0) {
  process.exitCode = 1
  throw new Error(
    `M17 rastreabilidade incompleta: ${failed.length} verificação(ões) falharam.`,
  )
}

console.log(
  '[OK] M17 rastreabilidade multichave validada.',
)
