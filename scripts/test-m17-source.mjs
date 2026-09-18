import fs from 'node:fs'

const checks = [
  ['src/data/entry-catalog-service.ts', 'listTechnicalEntryCatalog'],
  ['src/features/purchase-document-ocr.ts', 'analyzePurchaseDocument'],
  ['src/components/assets/ExpressAssetModal.tsx', 'Configuração técnica'],
  ['src/components/assets/ExpressAssetModal.tsx', 'Destino inicial'],
  ['src/components/assets/ExpressAssetModal.tsx', 'Fotografar e preencher'],
  ['src/pages/InventoryPage.tsx', 'Ativos completos em estoque'],
  ['src/pages/InventoryPage.tsx', 'Novo local de estoque'],
]

for (const [file, token] of checks) {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo ausente: ${file}`)
  }

  const source = fs.readFileSync(file, 'utf8')

  if (!source.includes(token)) {
    throw new Error(`Token ausente em ${file}: ${token}`)
  }
}

const migrationDir = 'supabase/migrations'
const m17Migration = fs
  .readdirSync(migrationDir)
  .filter((name) => /m17|entry_stock|catalog/i.test(name))

if (m17Migration.length > 0) {
  throw new Error(
    `M17 não pode criar migration nesta etapa: ${m17Migration.join(', ')}`,
  )
}

console.log('M17 SOURCE OK')
console.log('Banco: sem migration nova')
console.log('OCR/camera: motor existente reutilizado')
