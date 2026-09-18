import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relative) {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8',
  )
}

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(message)
  }
}

const express = read(
  'src/components/assets/ExpressAssetModal.tsx',
)
const detail = read(
  'src/pages/AssetDetailPage.tsx',
)
const edit = read(
  'src/components/assets/AssetEditModal.tsx',
)
const overview = read(
  'src/components/assets/AssetTechnicalOverviewCard.tsx',
)
const service = read(
  'src/data/ocr-intelligence-service.ts',
)

assert(
  express.includes(
    'Código de terceiro',
  ) &&
    express.includes(
      'setThirdPartyScannerOpen',
    ),
  'Express precisa expor Código de terceiro com leitura por código de barras.',
)

assert(
  express.includes(
    'Leitura aplicada ao cadastro',
  ) &&
    express.includes(
      'Refazer leitura',
    ),
  'Express precisa dar retorno visual depois de Aplicar dados revisados.',
)

assert(
  express.includes(
    'reviewed.memory.trim()',
  ) &&
    express.includes(
      'reviewed.storage.trim()',
    ) &&
    express.includes(
      'reviewed.operatingSystem.trim()',
    ),
  'Dados revisados do OCR precisam alimentar diretamente a configuração técnica.',
)

assert(
  !express.includes(
    '[OCR NÃO CLASSIFICADO]',
  ),
  'Texto bruto/não classificado do OCR não deve ser gravado em Observações no Express.',
)

assert(
  service.includes(
    'getAssetTechnicalProfile',
  ),
  'Serviço precisa ler asset_technical_profiles.',
)

assert(
  detail.includes(
    'AssetTechnicalOverviewCard',
  ) &&
    detail.includes(
      'Código de terceiro',
    ) &&
    detail.includes(
      'cleanAssetNotes',
    ),
  'Ficha do ativo precisa destacar configuração técnica, Código de terceiro e ocultar bloco OCR legado.',
)

assert(
  edit.includes(
    'Memória total (GB)',
  ) &&
    edit.includes(
      'Armazenamento (GB)',
    ) &&
    edit.includes(
      'setAssetTechnicalProfile',
    ),
  'Editar ativo precisa permitir editar configuração técnica e persistir o perfil.',
)

assert(
  overview.includes(
    'Cadastrado / esperado',
  ) &&
    overview.includes(
      'Detectado pelo agente',
    ) &&
    overview.includes(
      'Confirmar inventário detectado',
    ),
  'Ficha precisa cruzar cadastro técnico com inventário do agente.',
)

assert(
  overview.includes(
    'adoptDetectedInventory',
  ) &&
    overview.includes(
      'setAssetTechnicalProfile',
    ),
  'Confirmação do inventário detectado precisa atualizar baseline e configuração técnica.',
)

console.log(
  'M17.2 source test: OK',
)
