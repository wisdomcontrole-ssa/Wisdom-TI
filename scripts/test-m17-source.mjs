import fs from 'node:fs'

const read = (path) => {
  if (!fs.existsSync(path)) {
    throw new Error(`Arquivo ausente: ${path}`)
  }

  return fs.readFileSync(path, 'utf8')
}

const catalog = read(
  'src/data/entry-catalog-service.ts',
)
const purchaseOcr = read(
  'src/features/purchase-document-ocr.ts',
)
const express = read(
  'src/components/assets/ExpressAssetModal.tsx',
)
const inventory = read(
  'src/pages/InventoryPage.tsx',
)

const checks = [
  [
    'Catálogo técnico assistido',
    catalog.includes(
      'listTechnicalEntryCatalog',
    ),
  ],
  [
    'OCR de documento de aquisição',
    purchaseOcr.includes(
      'analyzePurchaseDocument',
    ),
  ],
  [
    'Express mantém configuração técnica editável',
    express.includes(
      'setAssetTechnicalProfile',
    ) &&
      express.includes(
        'technicalOpen',
      ),
  ],
  [
    'Express mantém destino inicial',
    express.includes(
      'Destino inicial',
    ) &&
      express.includes(
        "setPlacementMode('stock')",
      ),
  ],
  [
    'Express mantém leitura/preenchimento de nota fiscal',
    express.includes(
      'analyzePurchaseDocument',
    ) &&
      express.includes(
        'invoiceFile',
      ),
  ],
  [
    'Estoque lista ativos completos',
    inventory.includes(
      'Ativos completos em estoque',
    ),
  ],
  [
    'Estoque permite criar local físico',
    inventory.includes(
      'Novo local de estoque',
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
    `M17 base incompleta: ${failed.length} verificação(ões) falharam.`,
  )
}

const migrationDir = 'supabase/migrations'
const m17Migration = fs
  .readdirSync(migrationDir)
  .filter((name) =>
    /m17|entry_stock|catalog/i.test(name),
  )

if (m17Migration.length > 0) {
  throw new Error(
    `M17 não pode criar migration nesta etapa: ${m17Migration.join(', ')}`,
  )
}

console.log('M17 SOURCE OK')
console.log('Banco: sem migration nova')
console.log(
  'OCR/camera: motor existente reutilizado',
)
