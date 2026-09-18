import {
  Barcode,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  addAssetExternalIdentifier,
  addPurchaseDocumentToAsset,
  ensureExternalOrganization,
  recordAssetLabelRead,
  setAssetSmartCore,
} from '../../data/asset-smart-service'
import {
  listAssetTypes,
  listEnvironments,
  listUnits,
  updateAsset,
} from '../../data/asset-service'
import {
  listTechnicalEntryCatalog,
  type TechnicalEntryCatalog,
} from '../../data/entry-catalog-service'
import {
  createExpressAsset,
} from '../../data/field-ops-service'
import {
  recordOcrIntelligenceExtraction,
  setAssetTechnicalProfile,
} from '../../data/ocr-intelligence-service'
import {
  uploadEvidence,
} from '../../data/evidence-service'
import {
  buildAssetPrefill,
  type AssetPrefill,
} from '../../features/ocr-intelligence'
import {
  prepareEvidenceFile,
} from '../../lib/evidence-image'
import {
  analyzePurchaseDocument,
} from '../../features/purchase-document-ocr'
import type {
  AssetLabelAnalysis,
  ExternalIdentifierType,
  OwnershipType,
  ReviewedLabelData,
} from '../../types/asset-smart'
import type {
  AssetTypeRecord,
  EnvironmentRecord,
  UnitRecord,
} from '../../types/assets'
import type {
  EntryOrigin,
} from '../../types/field-ops'
import { InventoryScanner } from '../field/InventoryScanner'
import { FormModal } from '../ui/FormModal'
import { SmartLabelReader } from './SmartLabelReader'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const emptyCatalog: TechnicalEntryCatalog = {
  manufacturers: [],
  processorManufacturers: [],
  processorModels: [],
  memorySizesGb: [],
  memoryTypes: [],
  memorySpeedsMhz: [],
  storageCapacitiesGb: [],
  storageTypes: [],
  storageInterfaces: [],
  storageFormFactors: [],
  operatingSystems: [],
}

const entryOriginLabels: Record<
  EntryOrigin,
  string
> = {
  purchase: 'Compra',
  donation: 'Doação',
  used: 'Usado / já existente',
  transfer: 'Transferência',
  other: 'Outro',
}

const ownershipLabels: Record<
  OwnershipType,
  string
> = {
  own: 'Próprio',
  ceded: 'Cedido para nós',
  loaned: 'Emprestado para nós',
  commodatum: 'Comodato',
  leased: 'Locado',
  third_party: 'Terceiro',
  other: 'Outro',
}

const identifierLabels: Record<
  ExternalIdentifierType,
  string
> = {
  patrimony: 'Patrimônio / tag do terceiro',
  tombamento: 'Tombamento do terceiro',
  internal_serial: 'Número anterior do terceiro',
  contract: 'Contrato / convênio',
  other: 'Outro código de terceiro',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[10px] leading-4 text-slate-400">
          {hint}
        </span>
      )}
    </label>
  )
}

function Datalist({
  id,
  values,
}: {
  id: string
  values: Array<string | number>
}) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option
          key={String(value)}
          value={String(value)}
        />
      ))}
    </datalist>
  )
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function parseCapacityGb(
  value: string,
) {
  const match = value
    .replace(',', '.')
    .match(
      /(\d+(?:\.\d+)?)\s*(TB|GB|MB)\b/i,
    )

  if (!match) return undefined

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) {
    return undefined
  }

  const unit = match[2].toUpperCase()

  if (unit === 'TB') {
    return amount * 1024
  }

  if (unit === 'MB') {
    return amount / 1024
  }

  return amount
}

function parseSpeedMhz(
  value: string,
) {
  const match = value.match(
    /\b(\d{3,5})\s*MHZ\b/i,
  )

  if (!match) return undefined

  const speed = Number(match[1])
  return Number.isFinite(speed)
    ? speed
    : undefined
}

function detectMemoryType(
  value: string,
) {
  return value.match(
    /\b(LPDDR5|LPDDR4X|LPDDR4|LPDDR3|DDR5|DDR4|DDR3L|DDR3|DDR2)\b/i,
  )?.[1]?.toUpperCase()
}

function detectStorageType(
  value: string,
) {
  const normalized = normalize(value)

  if (
    normalized.includes('NVME')
  ) {
    return 'SSD NVMe'
  }

  if (/\bSSD\b/.test(normalized)) {
    return 'SSD'
  }

  if (
    /\bHDD\b/.test(normalized) ||
    /\bHD\b/.test(normalized)
  ) {
    return 'HDD'
  }

  if (normalized.includes('EMMC')) {
    return 'eMMC'
  }

  return undefined
}

function detectStorageInterface(
  value: string,
) {
  const normalized = normalize(value)

  if (normalized.includes('NVME')) {
    return 'NVMe'
  }
  if (normalized.includes('SATA')) {
    return 'SATA'
  }
  if (normalized.includes('PCIE')) {
    return 'PCIe'
  }
  if (normalized.includes('SAS')) {
    return 'SAS'
  }
  if (normalized.includes('USB')) {
    return 'USB'
  }

  return undefined
}

function detectProcessorManufacturer(
  value: string,
) {
  const normalized = normalize(value)

  if (normalized.includes('INTEL')) {
    return 'Intel'
  }
  if (
    normalized.includes('AMD') ||
    normalized.includes('RYZEN') ||
    normalized.includes('ATHLON')
  ) {
    return 'AMD'
  }
  if (normalized.includes('APPLE')) {
    return 'Apple'
  }
  if (
    normalized.includes('QUALCOMM')
  ) {
    return 'Qualcomm'
  }

  return undefined
}

function splitKnownManufacturer(
  value: string,
  catalog: TechnicalEntryCatalog,
) {
  const clean = value.trim()
  if (!clean) {
    return {
      manufacturer: '',
      model: '',
    }
  }

  const normalized = normalize(clean)
  const matched =
    catalog.manufacturers.find(
      (manufacturer) =>
        normalized.startsWith(
          normalize(manufacturer),
        ),
    )

  if (!matched) {
    return {
      manufacturer: '',
      model: clean,
    }
  }

  return {
    manufacturer: matched,
    model: clean
      .slice(matched.length)
      .replace(/^[\s:;-]+/, '')
      .trim(),
  }
}

function numberOrUndefined(
  value: string,
) {
  const clean =
    value.trim().replace(',', '.')
  if (!clean) return undefined

  const number = Number(clean)
  return Number.isFinite(number)
    ? number
    : undefined
}

function integerOrUndefined(
  value: string,
) {
  const number =
    numberOrUndefined(value)

  return number === undefined
    ? undefined
    : Math.round(number)
}

function findTypeForPrefill(
  types: AssetTypeRecord[],
  prefill: AssetPrefill,
  reviewed: ReviewedLabelData,
) {
  const category =
    prefill.type &&
    prefill.type !== 'unknown'
      ? normalize(prefill.type)
      : ''

  const aliases: Record<
    string,
    string[]
  > = {
    DESKTOP: [
      'DESKTOP',
      'COMPUTADOR',
      'PC',
    ],
    NOTEBOOK: [
      'NOTEBOOK',
      'LAPTOP',
    ],
    SERVER: [
      'SERVIDOR',
      'SERVER',
    ],
    MONITOR: ['MONITOR'],
    PRINTER: [
      'IMPRESSORA',
      'PRINTER',
    ],
    SWITCH: ['SWITCH'],
    ROUTER: [
      'ROTEADOR',
      'ROUTER',
    ],
    ACCESS_POINT: [
      'ACCESS POINT',
      'ACESS POINT',
      'AP',
    ],
    FIREWALL: ['FIREWALL'],
    UPS: [
      'NOBREAK',
      'UPS',
    ],
    STABILIZER: [
      'ESTABILIZADOR',
    ],
    PROJECTOR: [
      'PROJETOR',
      'PROJECTOR',
    ],
    KEYBOARD: [
      'TECLADO',
      'KEYBOARD',
    ],
    MOUSE: ['MOUSE'],
    SCANNER: ['SCANNER'],
    WEBCAM: ['WEBCAM'],
    NAS: ['NAS'],
  }

  const wanted =
    aliases[category] ?? []

  let match = types.find((type) => {
    const haystack =
      `${type.code} ${type.name}`
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          '',
        )
        .toUpperCase()

    return wanted.some((value) =>
      haystack.includes(value),
    )
  })

  if (!match) {
    const hasComputerSpecs = Boolean(
      reviewed.processor.trim() ||
        reviewed.memory.trim() ||
        reviewed.storage.trim() ||
        prefill.processor?.model ||
        prefill.memory?.totalGb ||
        prefill.storage?.capacityGb,
    )

    if (hasComputerSpecs) {
      match = types.find((type) => {
        const haystack = normalize(
          `${type.code} ${type.name}`,
        )
        return (
          haystack.includes(
            'DESKTOP',
          ) ||
          haystack.includes(
            'COMPUTADOR',
          ) ||
          haystack === 'PC'
        )
      })
    }
  }

  return match?.id
}

function preferredInitialType(
  types: AssetTypeRecord[],
) {
  const computer = types.find((type) => {
    const value = normalize(
      `${type.code} ${type.name}`,
    )

    return (
      value.includes('DESKTOP') ||
      value.includes('COMPUTADOR')
    )
  })

  return (
    computer?.id ??
    types[0]?.id ??
    ''
  )
}

function technicalSummary(input: {
  processorModel: string
  memoryTotalGb: string
  memoryType: string
  storageCapacityGb: string
  storageType: string
  operatingSystem: string
}) {
  return {
    cpu:
      input.processorModel.trim() ||
      'Não informado',
    memory: [
      input.memoryTotalGb.trim()
        ? `${input.memoryTotalGb.trim()} GB`
        : '',
      input.memoryType.trim(),
    ]
      .filter(Boolean)
      .join(' · ') || 'Não informada',
    storage: [
      input.storageCapacityGb.trim()
        ? `${input.storageCapacityGb.trim()} GB`
        : '',
      input.storageType.trim(),
    ]
      .filter(Boolean)
      .join(' · ') ||
      'Não informado',
    os:
      input.operatingSystem.trim() ||
      'Não informado',
  }
}

export function ExpressAssetModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (
    assetId: string,
    warning?: string,
  ) => void
}) {
  const [types, setTypes] =
    useState<AssetTypeRecord[]>([])
  const [units, setUnits] =
    useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [catalog, setCatalog] =
    useState<TechnicalEntryCatalog>(
      emptyCatalog,
    )

  const [loading, setLoading] =
    useState(false)
  const [saving, setSaving] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [typeId, setTypeId] =
    useState('')
  const [entryOrigin, setEntryOrigin] =
    useState<EntryOrigin>('other')
  const [manufacturer, setManufacturer] =
    useState('')
  const [model, setModel] =
    useState('')
  const [serialNumber, setSerialNumber] =
    useState('')
  const [serviceTag, setServiceTag] =
    useState('')
  const [productNumber, setProductNumber] =
    useState('')
  const [
    electricalRating,
    setElectricalRating,
  ] = useState('')

  const [
    thirdPartyCode,
    setThirdPartyCode,
  ] = useState('')
  const [
    identifierType,
    setIdentifierType,
  ] =
    useState<ExternalIdentifierType>(
      'patrimony',
    )
  const [
    serialScannerOpen,
    setSerialScannerOpen,
  ] = useState(false)
  const [
    thirdPartyScannerOpen,
    setThirdPartyScannerOpen,
  ] = useState(false)

  const [placementMode, setPlacementMode] =
    useState<'stock' | 'in_use'>(
      'stock',
    )
  const [unitId, setUnitId] =
    useState('')
  const [
    environmentId,
    setEnvironmentId,
  ] = useState('')
  const [notes, setNotes] =
    useState('')

  const [processorManufacturer, setProcessorManufacturer] =
    useState('')
  const [processorModel, setProcessorModel] =
    useState('')
  const [memoryTotalGb, setMemoryTotalGb] =
    useState('')
  const [memoryType, setMemoryType] =
    useState('')
  const [memorySpeedMhz, setMemorySpeedMhz] =
    useState('')
  const [storageCapacityGb, setStorageCapacityGb] =
    useState('')
  const [storageType, setStorageType] =
    useState('')
  const [storageInterface, setStorageInterface] =
    useState('')
  const [storageFormFactor, setStorageFormFactor] =
    useState('')
  const [motherboardManufacturer, setMotherboardManufacturer] =
    useState('')
  const [motherboardModel, setMotherboardModel] =
    useState('')
  const [operatingSystem, setOperatingSystem] =
    useState('')
  const [wifiManufacturer, setWifiManufacturer] =
    useState('')
  const [wifiModel, setWifiModel] =
    useState('')
  const [macAddress, setMacAddress] =
    useState('')

  const [technicalOpen, setTechnicalOpen] =
    useState(false)
  const [advancedOpen, setAdvancedOpen] =
    useState(false)
  const [ocrApplied, setOcrApplied] =
    useState(false)
  const [ocrMessage, setOcrMessage] =
    useState<string | null>(null)

  const [acquiredAt, setAcquiredAt] =
    useState('')
  const [
    warrantyExpiresAt,
    setWarrantyExpiresAt,
  ] = useState('')
  const [ownershipType, setOwnershipType] =
    useState<OwnershipType>('own')
  const [
    organizationName,
    setOrganizationName,
  ] = useState('')
  const [
    organizationAcronym,
    setOrganizationAcronym,
  ] = useState('')

  const [invoiceNumber, setInvoiceNumber] =
    useState('')
  const [invoiceSeries, setInvoiceSeries] =
    useState('')
  const [
    invoiceAccessKey,
    setInvoiceAccessKey,
  ] = useState('')
  const [
    invoiceIssuerName,
    setInvoiceIssuerName,
  ] = useState('')
  const [
    invoiceIssuerTaxId,
    setInvoiceIssuerTaxId,
  ] = useState('')
  const [
    invoiceIssueDate,
    setInvoiceIssueDate,
  ] = useState('')
  const [
    invoiceFile,
    setInvoiceFile,
  ] = useState<File | null>(null)
  const [
    invoiceReading,
    setInvoiceReading,
  ] = useState(false)
  const [
    invoiceProgress,
    setInvoiceProgress,
  ] = useState(0)
  const [
    invoiceError,
    setInvoiceError,
  ] = useState<string | null>(null)

  const [ocrFile, setOcrFile] =
    useState<File | null>(null)
  const [
    ocrAnalysis,
    setOcrAnalysis,
  ] =
    useState<AssetLabelAnalysis | null>(
      null,
    )
  const [
    ocrPrefill,
    setOcrPrefill,
  ] = useState<AssetPrefill | null>(null)

  useEffect(() => {
    if (!open) return

    let active = true

    async function bootstrap() {
      try {
        setLoading(true)
        setErrorMessage(null)

        const [
          typeRows,
          unitRows,
          environmentRows,
          catalogData,
        ] = await Promise.all([
          listAssetTypes(),
          listUnits(),
          listEnvironments(),
          listTechnicalEntryCatalog(),
        ])

        if (!active) return

        const activeTypes =
          typeRows.filter(
            (item) => item.active,
          )
        const activeUnits =
          unitRows.filter(
            (item) => item.active,
          )
        const activeEnvironments =
          environmentRows.filter(
            (item) => item.active,
          )

        setTypes(activeTypes)
        setUnits(activeUnits)
        setEnvironments(
          activeEnvironments,
        )
        setCatalog(catalogData)

        setTypeId(
          preferredInitialType(
            activeTypes,
          ),
        )
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível preparar o cadastro Express.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setEntryOrigin('other')
      setManufacturer('')
      setModel('')
      setSerialNumber('')
      setServiceTag('')
      setProductNumber('')
      setElectricalRating('')
      setThirdPartyCode('')
      setIdentifierType('patrimony')
      setSerialScannerOpen(false)
      setThirdPartyScannerOpen(false)
      setPlacementMode('stock')
      setUnitId('')
      setEnvironmentId('')
      setNotes('')

      setProcessorManufacturer('')
      setProcessorModel('')
      setMemoryTotalGb('')
      setMemoryType('')
      setMemorySpeedMhz('')
      setStorageCapacityGb('')
      setStorageType('')
      setStorageInterface('')
      setStorageFormFactor('')
      setMotherboardManufacturer('')
      setMotherboardModel('')
      setOperatingSystem('')
      setWifiManufacturer('')
      setWifiModel('')
      setMacAddress('')

      setTechnicalOpen(false)
      setAdvancedOpen(false)
      setOcrApplied(false)
      setOcrMessage(null)

      setAcquiredAt('')
      setWarrantyExpiresAt('')
      setOwnershipType('own')
      setOrganizationName('')
      setOrganizationAcronym('')

      setInvoiceNumber('')
      setInvoiceSeries('')
      setInvoiceAccessKey('')
      setInvoiceIssuerName('')
      setInvoiceIssuerTaxId('')
      setInvoiceIssueDate('')
      setInvoiceFile(null)
      setInvoiceReading(false)
      setInvoiceProgress(0)
      setInvoiceError(null)

      setOcrFile(null)
      setOcrAnalysis(null)
      setOcrPrefill(null)
      setErrorMessage(null)
    })
  }, [open])

  const filteredEnvironments =
    useMemo(() => {
      const rows = environments.filter(
        (environment) =>
          !unitId ||
          environment.unit_id === unitId,
      )

      return [...rows].sort(
        (left, right) => {
          const leftStock =
            left.environment_type ===
            'stock'
              ? 0
              : 1
          const rightStock =
            right.environment_type ===
            'stock'
              ? 0
              : 1

          if (leftStock !== rightStock) {
            return leftStock - rightStock
          }

          return left.name.localeCompare(
            right.name,
            'pt-BR',
          )
        },
      )
    }, [environments, unitId])

  const summary = technicalSummary({
    processorModel,
    memoryTotalGb,
    memoryType,
    storageCapacityGb,
    storageType,
    operatingSystem,
  })

  const hasTechnicalData = Boolean(
    processorManufacturer.trim() ||
      processorModel.trim() ||
      memoryTotalGb.trim() ||
      memoryType.trim() ||
      memorySpeedMhz.trim() ||
      storageCapacityGb.trim() ||
      storageType.trim() ||
      storageInterface.trim() ||
      storageFormFactor.trim() ||
      motherboardManufacturer.trim() ||
      motherboardModel.trim() ||
      operatingSystem.trim() ||
      wifiManufacturer.trim() ||
      wifiModel.trim() ||
      macAddress.trim(),
  )

  function applyOcr(
    reviewed: ReviewedLabelData,
    file: File,
    analysis: AssetLabelAnalysis,
  ) {
    const structuredText = [
      reviewed.manufacturer
        ? `FABRICANTE ${reviewed.manufacturer}`
        : '',
      reviewed.model
        ? `MODELO ${reviewed.model}`
        : '',
      reviewed.serialNumber
        ? `SERIAL ${reviewed.serialNumber}`
        : '',
      reviewed.productNumber
        ? `PART NUMBER ${reviewed.productNumber}`
        : '',
      reviewed.processor
        ? `PROCESSADOR ${reviewed.processor}`
        : '',
      reviewed.memory
        ? `MEMORIA ${reviewed.memory}`
        : '',
      reviewed.storage
        ? `ARMAZENAMENTO ${reviewed.storage}`
        : '',
      reviewed.motherboard
        ? `PLACA-MAE ${reviewed.motherboard}`
        : '',
      reviewed.operatingSystem
        ? `SISTEMA OPERACIONAL ${reviewed.operatingSystem}`
        : '',
      reviewed.networkAdapter
        ? `WIFI ${reviewed.networkAdapter}`
        : '',
      analysis.rawText,
    ]
      .filter(Boolean)
      .join('\n')

    const prefill =
      buildAssetPrefill(structuredText)

    const cpuText =
      reviewed.processor.trim()
    const memoryText =
      reviewed.memory.trim()
    const storageText =
      reviewed.storage.trim()
    const motherboardText =
      reviewed.motherboard.trim()
    const networkText =
      reviewed.networkAdapter.trim()

    const board =
      splitKnownManufacturer(
        motherboardText,
        catalog,
      )
    const network =
      splitKnownManufacturer(
        networkText,
        catalog,
      )

    setManufacturer(
      reviewed.manufacturer.trim() ||
        prefill.manufacturer ||
        '',
    )
    setModel(
      reviewed.model.trim() ||
        prefill.model ||
        '',
    )
    setSerialNumber(
      reviewed.serialNumber.trim() ||
        prefill.serialNumber ||
        '',
    )
    setServiceTag(
      reviewed.serviceTag.trim(),
    )
    setProductNumber(
      reviewed.productNumber.trim() ||
        prefill.partNumber ||
        '',
    )
    setElectricalRating(
      reviewed.electricalRating.trim(),
    )

    setProcessorManufacturer(
      detectProcessorManufacturer(
        cpuText,
      ) ||
        prefill.processor
          ?.manufacturer ||
        '',
    )
    setProcessorModel(
      cpuText ||
        prefill.processor?.model ||
        '',
    )

    const directMemory =
      parseCapacityGb(memoryText)
    setMemoryTotalGb(
      directMemory !== undefined
        ? String(directMemory)
        : prefill.memory?.totalGb !==
            undefined
          ? String(
              prefill.memory.totalGb,
            )
          : '',
    )
    setMemoryType(
      detectMemoryType(memoryText) ||
        prefill.memory?.type ||
        '',
    )
    const directMemorySpeed =
      parseSpeedMhz(memoryText)
    setMemorySpeedMhz(
      directMemorySpeed !== undefined
        ? String(directMemorySpeed)
        : prefill.memory?.speedMhz !==
            undefined
          ? String(
              prefill.memory.speedMhz,
            )
          : '',
    )

    const directStorage =
      parseCapacityGb(storageText)
    setStorageCapacityGb(
      directStorage !== undefined
        ? String(directStorage)
        : prefill.storage
              ?.capacityGb !==
            undefined
          ? String(
              prefill.storage
                .capacityGb,
            )
          : '',
    )
    setStorageType(
      detectStorageType(storageText) ||
        prefill.storage?.type ||
        '',
    )
    setStorageInterface(
      detectStorageInterface(
        storageText,
      ) ||
        prefill.storage?.interface ||
        '',
    )
    setStorageFormFactor(
      prefill.storage?.formFactor ||
        '',
    )

    setMotherboardManufacturer(
      board.manufacturer ||
        prefill.motherboard
          ?.manufacturer ||
        '',
    )
    setMotherboardModel(
      board.model ||
        motherboardText ||
        prefill.motherboard?.model ||
        '',
    )

    setOperatingSystem(
      reviewed.operatingSystem.trim() ||
        prefill.operatingSystem ||
        '',
    )
    setWifiManufacturer(
      network.manufacturer ||
        prefill.wifi?.manufacturer ||
        '',
    )
    setWifiModel(
      network.model ||
        networkText ||
        prefill.wifi?.model ||
        '',
    )
    setMacAddress(
      prefill.macAddress || '',
    )

    const suggestedTypeId =
      findTypeForPrefill(
        types,
        prefill,
        reviewed,
      )

    if (suggestedTypeId) {
      setTypeId(suggestedTypeId)
    }

    setOcrFile(file)
    setOcrAnalysis(analysis)
    setOcrPrefill(prefill)
    setOcrApplied(true)
    setTechnicalOpen(false)
    setOcrMessage(
      'Dados revisados aplicados ao cadastro. Confira identificação e configuração técnica antes de salvar.',
    )
  }

  async function readInvoice(
    file: File,
  ) {
    setInvoiceFile(file)
    setInvoiceError(null)

    if (!file.type.startsWith('image/')) {
      setInvoiceError(
        'PDF foi anexado. O preenchimento automático é feito apenas em imagens/fotos.',
      )
      return
    }

    try {
      setInvoiceReading(true)
      setInvoiceProgress(0)

      const result =
        await analyzePurchaseDocument(
          file,
          (progress) =>
            setInvoiceProgress(progress),
        )

      setInvoiceNumber(
        result.number || invoiceNumber,
      )
      setInvoiceSeries(
        result.series || invoiceSeries,
      )
      setInvoiceAccessKey(
        result.accessKey ||
          invoiceAccessKey,
      )
      setInvoiceIssuerName(
        result.issuerName ||
          invoiceIssuerName,
      )
      setInvoiceIssuerTaxId(
        result.issuerTaxId ||
          invoiceIssuerTaxId,
      )
      setInvoiceIssueDate(
        result.issueDate ||
          invoiceIssueDate,
      )
    } catch (error) {
      setInvoiceError(
        error instanceof Error
          ? error.message
          : 'Não foi possível preencher a nota fiscal.',
      )
    } finally {
      setInvoiceReading(false)
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!typeId) {
      setErrorMessage(
        'Selecione o tipo do ativo.',
      )
      return
    }

    if (
      placementMode === 'in_use' &&
      !unitId
    ) {
      setErrorMessage(
        'Para equipamento em uso, selecione a unidade inicial.',
      )
      return
    }

    if (
      ownershipType !== 'own' &&
      !organizationName.trim()
    ) {
      setErrorMessage(
        'Informe a instituição proprietária/responsável para ativo não próprio.',
      )
      setAdvancedOpen(true)
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      const created =
        await createExpressAsset({
          assetTypeId: typeId,
          manufacturer,
          model,
          serialNumber,
          entryOrigin,
          unitId:
            unitId || undefined,
          environmentId:
            environmentId || undefined,
          notes,
        })

      const warnings: string[] = []

      if (
        placementMode === 'in_use'
      ) {
        try {
          await updateAsset(created.id, {
            asset_type_id: typeId,
            manufacturer,
            model,
            serial_number:
              serialNumber,
            hostname: '',
            os_name:
              operatingSystem,
            status: 'active',
            acquired_at:
              acquiredAt,
            notes,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Ativo criado, mas não foi possível marcar como em uso: ${error.message}`
              : 'Ativo criado, mas não foi possível marcar como em uso.',
          )
        }
      }

      let externalOrganizationId:
        | string
        | null = null

      if (
        organizationName.trim()
      ) {
        try {
          externalOrganizationId =
            await ensureExternalOrganization({
              name: organizationName,
              acronym:
                organizationAcronym,
            })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Instituição não vinculada: ${error.message}`
              : 'Instituição não vinculada.',
          )
        }
      }

      try {
        await setAssetSmartCore({
          assetId: created.id,
          productNumber,
          serviceTag,
          electricalRating,
          acquiredAt,
          warrantyExpiresAt,
          ownershipType,
          ownerOrganizationId:
            ownershipType === 'own'
              ? null
              : externalOrganizationId,
        })
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Dados complementares não salvos: ${error.message}`
            : 'Dados complementares não salvos.',
        )
      }

      if (hasTechnicalData) {
        try {
          await setAssetTechnicalProfile({
            assetId: created.id,
            processorManufacturer,
            processorModel,
            memoryTotalGb:
              numberOrUndefined(
                memoryTotalGb,
              ),
            memoryType,
            memorySpeedMhz:
              integerOrUndefined(
                memorySpeedMhz,
              ),
            storageCapacityGb:
              numberOrUndefined(
                storageCapacityGb,
              ),
            storageType,
            storageInterface,
            storageFormFactor,
            motherboardManufacturer,
            motherboardModel,
            operatingSystem,
            wifiManufacturer,
            wifiModel,
            macAddress,
            source: ocrPrefill
              ? 'ocr'
              : 'manual',
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Configuração técnica não salva: ${error.message}`
              : 'Configuração técnica não salva.',
          )
        }
      } else if (operatingSystem.trim()) {
        try {
          await setAssetTechnicalProfile({
            assetId: created.id,
            operatingSystem,
            source: ocrPrefill
              ? 'ocr'
              : 'manual',
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Sistema operacional não salvo: ${error.message}`
              : 'Sistema operacional não salvo.',
          )
        }
      }

      if (ocrPrefill) {
        try {
          await recordOcrIntelligenceExtraction({
            assetId: created.id,
            extraction:
              ocrPrefill.extraction,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Histórico da interpretação OCR não salvo: ${error.message}`
              : 'Histórico da interpretação OCR não salvo.',
          )
        }
      }

      if (thirdPartyCode.trim()) {
        try {
          await addAssetExternalIdentifier({
            assetId: created.id,
            organizationId:
              externalOrganizationId,
            identifierType,
            identifierValue:
              thirdPartyCode,
            notes:
              'Código de terceiro informado no cadastro Express.',
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Código de terceiro não vinculado: ${error.message}`
              : 'Código de terceiro não vinculado.',
          )
        }
      }

      if (
        ocrFile &&
        ocrAnalysis
      ) {
        try {
          const prepared =
            await prepareEvidenceFile(
              ocrFile,
            )

          const evidence =
            await uploadEvidence({
              context: {
                assetId: created.id,
              },
              file: prepared,
              categoryCode:
                'registration',
              captureMethod: 'camera',
              caption:
                'Etiqueta de identificação lida no cadastro Express',
            })

          await recordAssetLabelRead({
            assetId: created.id,
            evidenceId: evidence.id,
            rawText:
              ocrAnalysis.rawText,
            barcodes:
              ocrAnalysis.barcodes,
            detectedData:
              ocrAnalysis.fields,
            confidence: Object.fromEntries(
              Object.entries(
                ocrAnalysis.fields,
              ).map(
                ([key, field]) => [
                  key,
                  field?.confidence ??
                    null,
                ],
              ),
            ),
            engine:
              ocrAnalysis.engine,
            engineVersion:
              ocrAnalysis.engineVersion,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Leitura da etiqueta não foi anexada ao histórico: ${error.message}`
              : 'Leitura da etiqueta não foi anexada ao histórico.',
          )
        }
      }

      if (
        invoiceNumber.trim()
      ) {
        try {
          let evidenceId:
            | string
            | null = null

          if (invoiceFile) {
            const prepared =
              await prepareEvidenceFile(
                invoiceFile,
              )

            const evidence =
              await uploadEvidence({
                context: {
                  assetId: created.id,
                },
                file: prepared,
                categoryCode: 'other',
                captureMethod:
                  'file',
                caption:
                  `Documento fiscal ${invoiceNumber.trim()}`,
              })

            evidenceId =
              evidence.id
          }

          await addPurchaseDocumentToAsset({
            assetId: created.id,
            documentType: 'invoice',
            number:
              invoiceNumber,
            series:
              invoiceSeries,
            accessKey:
              invoiceAccessKey,
            issuerName:
              invoiceIssuerName,
            issuerTaxId:
              invoiceIssuerTaxId,
            issueDate:
              invoiceIssueDate,
            evidenceId,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Nota fiscal não vinculada: ${error.message}`
              : 'Nota fiscal não vinculada.',
          )
        }
      }

      onCreated(
        created.id,
        warnings.length
          ? warnings.join('\n')
          : undefined,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível cadastrar o ativo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Novo ativo Express"
      description="Leia a etiqueta, confirme os dados principais e salve. O restante pode ser complementado depois."
      onClose={onClose}
      widthClassName="max-w-5xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="express-asset-form"
            disabled={
              saving ||
              loading ||
              !typeId
            }
            className="inline-flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"
          >
            <PackagePlus size={16} />
            {saving
              ? 'Salvando…'
              : 'Cadastrar ativo'}
          </button>
        </div>
      }
    >
      <form
        id="express-asset-form"
        onSubmit={(event) =>
          void submit(event)
        }
        className="space-y-5"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!ocrApplied ? (
          <SmartLabelReader
            disabled={saving}
            onApply={applyOcr}
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={19}
                className="mt-0.5 shrink-0 text-emerald-700"
              />
              <div>
                <div className="text-sm font-black text-emerald-950">
                  Leitura aplicada ao cadastro
                </div>
                <div className="mt-1 text-xs leading-5 text-emerald-800">
                  {ocrMessage}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOcrApplied(false)
                setOcrMessage(null)
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800"
            >
              <RefreshCw size={13} />
              Refazer leitura
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
              Identificação principal
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-400">
              Código interno e QR Code serão gerados automaticamente. Serial e Código de terceiro podem ser lidos por código de barras.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo do ativo">
              <select
                className={inputClass}
                value={typeId}
                onChange={(event) =>
                  setTypeId(
                    event.target.value,
                  )
                }
                required
              >
                <option value="">
                  Selecione
                </option>
                {types.map((type) => (
                  <option
                    key={type.id}
                    value={type.id}
                  >
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Origem">
              <select
                className={inputClass}
                value={entryOrigin}
                onChange={(event) =>
                  setEntryOrigin(
                    event.target
                      .value as EntryOrigin,
                  )
                }
              >
                {Object.entries(
                  entryOriginLabels,
                ).map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Fabricante">
              <input
                className={inputClass}
                list="express-manufacturers"
                value={manufacturer}
                onChange={(event) =>
                  setManufacturer(
                    event.target.value,
                  )
                }
                placeholder="Ex.: Dell, HP, Daten"
              />
              <Datalist
                id="express-manufacturers"
                values={
                  catalog.manufacturers
                }
              />
            </Field>

            <Field label="Modelo">
              <input
                className={inputClass}
                value={model}
                onChange={(event) =>
                  setModel(
                    event.target.value,
                  )
                }
              />
            </Field>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-700">
                Número de série do fabricante
              </div>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={serialNumber}
                  onChange={(event) =>
                    setSerialNumber(
                      event.target.value,
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setSerialScannerOpen(
                      (current) =>
                        !current,
                    )
                  }
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700"
                >
                  <Barcode size={14} />
                  Ler
                </button>
              </div>
              {serialScannerOpen && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <InventoryScanner
                    compact
                    onScan={async (
                      value,
                    ) => {
                      setSerialNumber(
                        value,
                      )
                      setSerialScannerOpen(
                        false,
                      )
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-700">
                Código de terceiro
              </div>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={thirdPartyCode}
                  onChange={(event) =>
                    setThirdPartyCode(
                      event.target.value,
                    )
                  }
                  placeholder="Patrimônio/tag da empresa ou órgão"
                />
                <button
                  type="button"
                  onClick={() =>
                    setThirdPartyScannerOpen(
                      (current) =>
                        !current,
                    )
                  }
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-800"
                >
                  <Barcode size={14} />
                  Ler
                </button>
              </div>
              <div className="mt-1 text-[10px] leading-4 text-slate-400">
                Use a plaqueta/tag fixa de quem cedeu ou doou o equipamento como identificação alternativa.
              </div>
              {thirdPartyScannerOpen && (
                <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50/50 p-2">
                  <InventoryScanner
                    compact
                    onScan={async (
                      value,
                    ) => {
                      setThirdPartyCode(
                        value,
                      )
                      setThirdPartyScannerOpen(
                        false,
                      )
                    }}
                  />
                </div>
              )}
            </div>

            <Field label="Service Tag do fabricante">
              <input
                className={inputClass}
                value={serviceTag}
                onChange={(event) =>
                  setServiceTag(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Product / Part Number">
              <input
                className={inputClass}
                value={productNumber}
                onChange={(event) =>
                  setProductNumber(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Alimentação">
              <input
                className={inputClass}
                value={electricalRating}
                onChange={(event) =>
                  setElectricalRating(
                    event.target.value,
                  )
                }
              />
            </Field>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() =>
              setTechnicalOpen(
                (current) => !current,
              )
            }
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <Settings2 size={16} />
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">
                  Configuração técnica
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {hasTechnicalData
                    ? `${summary.cpu} · ${summary.memory} · ${summary.storage} · ${summary.os}`
                    : 'Nenhuma configuração identificada. Abra para preencher manualmente.'}
                </div>
              </div>
            </div>

            {technicalOpen ? (
              <ChevronUp
                size={16}
                className="shrink-0 text-slate-400"
              />
            ) : (
              <ChevronDown
                size={16}
                className="shrink-0 text-slate-400"
              />
            )}
          </button>

          {technicalOpen && (
            <div className="border-t border-slate-100 p-4">
              <div className="mb-4 rounded-xl bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-800">
                Os dados reconhecidos já aparecem preenchidos abaixo. Use estas opções apenas para revisar ou completar o que faltou.
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Fabricante do processador">
                  <input
                    className={inputClass}
                    list="express-cpu-manufacturers"
                    value={
                      processorManufacturer
                    }
                    onChange={(event) =>
                      setProcessorManufacturer(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-cpu-manufacturers"
                    values={
                      catalog.processorManufacturers
                    }
                  />
                </Field>

                <div className="lg:col-span-2">
                  <Field label="Processador / modelo">
                    <input
                      className={inputClass}
                      list="express-cpu-models"
                      value={processorModel}
                      onChange={(event) =>
                        setProcessorModel(
                          event.target.value,
                        )
                      }
                    />
                    <Datalist
                      id="express-cpu-models"
                      values={
                        catalog.processorModels
                      }
                    />
                  </Field>
                </div>

                <Field label="Memória total (GB)">
                  <input
                    className={inputClass}
                    list="express-memory-sizes"
                    inputMode="decimal"
                    value={memoryTotalGb}
                    onChange={(event) =>
                      setMemoryTotalGb(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-memory-sizes"
                    values={
                      catalog.memorySizesGb
                    }
                  />
                </Field>

                <Field label="Tipo de memória">
                  <input
                    className={inputClass}
                    list="express-memory-types"
                    value={memoryType}
                    onChange={(event) =>
                      setMemoryType(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-memory-types"
                    values={
                      catalog.memoryTypes
                    }
                  />
                </Field>

                <Field label="Velocidade RAM (MHz)">
                  <input
                    className={inputClass}
                    list="express-memory-speeds"
                    inputMode="numeric"
                    value={memorySpeedMhz}
                    onChange={(event) =>
                      setMemorySpeedMhz(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-memory-speeds"
                    values={
                      catalog.memorySpeedsMhz
                    }
                  />
                </Field>

                <Field label="Armazenamento (GB)">
                  <input
                    className={inputClass}
                    list="express-storage-capacities"
                    inputMode="decimal"
                    value={
                      storageCapacityGb
                    }
                    onChange={(event) =>
                      setStorageCapacityGb(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-storage-capacities"
                    values={
                      catalog.storageCapacitiesGb
                    }
                  />
                </Field>

                <Field label="Tipo de armazenamento">
                  <input
                    className={inputClass}
                    list="express-storage-types"
                    value={storageType}
                    onChange={(event) =>
                      setStorageType(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-storage-types"
                    values={
                      catalog.storageTypes
                    }
                  />
                </Field>

                <Field label="Interface">
                  <input
                    className={inputClass}
                    list="express-storage-interfaces"
                    value={
                      storageInterface
                    }
                    onChange={(event) =>
                      setStorageInterface(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-storage-interfaces"
                    values={
                      catalog.storageInterfaces
                    }
                  />
                </Field>

                <Field label="Formato">
                  <input
                    className={inputClass}
                    list="express-storage-form-factors"
                    value={
                      storageFormFactor
                    }
                    onChange={(event) =>
                      setStorageFormFactor(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-storage-form-factors"
                    values={
                      catalog.storageFormFactors
                    }
                  />
                </Field>

                <Field label="Sistema operacional">
                  <input
                    className={inputClass}
                    list="express-operating-systems"
                    value={
                      operatingSystem
                    }
                    onChange={(event) =>
                      setOperatingSystem(
                        event.target.value,
                      )
                    }
                  />
                  <Datalist
                    id="express-operating-systems"
                    values={
                      catalog.operatingSystems
                    }
                  />
                </Field>

                <Field label="Fabricante da placa-mãe">
                  <input
                    className={inputClass}
                    list="express-manufacturers"
                    value={
                      motherboardManufacturer
                    }
                    onChange={(event) =>
                      setMotherboardManufacturer(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Modelo da placa-mãe">
                  <input
                    className={inputClass}
                    value={
                      motherboardModel
                    }
                    onChange={(event) =>
                      setMotherboardModel(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Fabricante Wi-Fi / rede">
                  <input
                    className={inputClass}
                    list="express-manufacturers"
                    value={
                      wifiManufacturer
                    }
                    onChange={(event) =>
                      setWifiManufacturer(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Modelo Wi-Fi / rede">
                  <input
                    className={inputClass}
                    value={wifiModel}
                    onChange={(event) =>
                      setWifiModel(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="MAC address">
                  <input
                    className={inputClass}
                    value={macAddress}
                    onChange={(event) =>
                      setMacAddress(
                        event.target.value.toUpperCase(),
                      )
                    }
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                </Field>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            Destino inicial
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                setPlacementMode('stock')
              }
              className={`rounded-xl border p-3 text-left ${
                placementMode === 'stock'
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-sm font-black text-slate-900">
                Estoque
              </div>
              <div className="mt-1 text-[10px] leading-4 text-slate-500">
                Equipamento completo ainda não está em uso.
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setPlacementMode(
                  'in_use',
                )
              }
              className={`rounded-xl border p-3 text-left ${
                placementMode === 'in_use'
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-sm font-black text-slate-900">
                Em uso
              </div>
              <div className="mt-1 text-[10px] leading-4 text-slate-500">
                Equipamento já ficará ativo na unidade escolhida.
              </div>
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label={
                placementMode === 'stock'
                  ? 'Unidade / depósito (opcional)'
                  : 'Unidade inicial'
              }
            >
              <select
                className={inputClass}
                value={unitId}
                onChange={(event) => {
                  setUnitId(
                    event.target.value,
                  )
                  setEnvironmentId('')
                }}
              >
                <option value="">
                  {placementMode === 'stock'
                    ? 'Sem unidade definida'
                    : 'Selecione'}
                </option>
                {units.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    {unit.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={
                placementMode === 'stock'
                  ? 'Posição física no estoque'
                  : 'Ambiente inicial'
              }
            >
              <select
                className={inputClass}
                value={environmentId}
                onChange={(event) =>
                  setEnvironmentId(
                    event.target.value,
                  )
                }
                disabled={!unitId}
              >
                <option value="">
                  {unitId
                    ? 'Sem ambiente definido'
                    : 'Selecione primeiro a unidade'}
                </option>
                {filteredEnvironments.map(
                  (environment) => (
                    <option
                      key={
                        environment.id
                      }
                      value={
                        environment.id
                      }
                    >
                      {environment
                        .environment_type ===
                      'stock'
                        ? 'Estoque · '
                        : ''}
                      {
                        environment.name
                      }
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
        </section>

        <Field
          label="Observações do técnico"
          hint="Somente observações úteis. Texto bruto do OCR é guardado no histórico de leitura, não neste campo."
        >
          <textarea
            className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
          />
        </Field>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() =>
              setAdvancedOpen(
                (current) => !current,
              )
            }
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div>
              <div className="text-sm font-black text-slate-900">
                Aquisição, custódia e nota fiscal
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Informações opcionais. O Código de terceiro já fica no cadastro principal.
              </div>
            </div>
            {advancedOpen ? (
              <ChevronUp
                size={16}
                className="text-slate-400"
              />
            ) : (
              <ChevronDown
                size={16}
                className="text-slate-400"
              />
            )}
          </button>

          {advancedOpen && (
            <div className="space-y-5 border-t border-slate-100 p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Data de aquisição">
                  <input
                    type="date"
                    className={inputClass}
                    value={acquiredAt}
                    onChange={(event) =>
                      setAcquiredAt(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Garantia até">
                  <input
                    type="date"
                    className={inputClass}
                    value={
                      warrantyExpiresAt
                    }
                    onChange={(event) =>
                      setWarrantyExpiresAt(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Posse / custódia">
                  <select
                    className={inputClass}
                    value={ownershipType}
                    onChange={(event) =>
                      setOwnershipType(
                        event.target
                          .value as OwnershipType,
                      )
                    }
                  >
                    {Object.entries(
                      ownershipLabels,
                    ).map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </Field>

                <Field label="Instituição proprietária / origem">
                  <input
                    className={inputClass}
                    value={
                      organizationName
                    }
                    onChange={(event) =>
                      setOrganizationName(
                        event.target.value,
                      )
                    }
                    placeholder="Ex.: Prefeitura, empresa, órgão"
                  />
                </Field>

                <Field label="Sigla da instituição">
                  <input
                    className={inputClass}
                    value={
                      organizationAcronym
                    }
                    onChange={(event) =>
                      setOrganizationAcronym(
                        event.target.value,
                      )
                    }
                  />
                </Field>

                <Field label="Classificação do Código de terceiro">
                  <select
                    className={inputClass}
                    value={identifierType}
                    onChange={(event) =>
                      setIdentifierType(
                        event.target
                          .value as ExternalIdentifierType,
                      )
                    }
                  >
                    {Object.entries(
                      identifierLabels,
                    ).map(
                      ([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                  <ReceiptText size={14} />
                  Nota fiscal / documento de aquisição
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Número">
                    <input
                      className={inputClass}
                      value={
                        invoiceNumber
                      }
                      onChange={(event) =>
                        setInvoiceNumber(
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Série">
                    <input
                      className={inputClass}
                      value={
                        invoiceSeries
                      }
                      onChange={(event) =>
                        setInvoiceSeries(
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Data de emissão">
                    <input
                      type="date"
                      className={inputClass}
                      value={
                        invoiceIssueDate
                      }
                      onChange={(event) =>
                        setInvoiceIssueDate(
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Emitente">
                    <input
                      className={inputClass}
                      value={
                        invoiceIssuerName
                      }
                      onChange={(event) =>
                        setInvoiceIssuerName(
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="CNPJ/CPF">
                    <input
                      className={inputClass}
                      value={
                        invoiceIssuerTaxId
                      }
                      onChange={(event) =>
                        setInvoiceIssuerTaxId(
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Chave NF-e">
                    <input
                      className={inputClass}
                      value={
                        invoiceAccessKey
                      }
                      onChange={(event) =>
                        setInvoiceAccessKey(
                          event.target.value,
                        )
                      }
                    />
                  </Field>
                </div>

                <label className="mt-4 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-xs font-bold text-slate-700">
                  <ReceiptText size={15} />
                  {invoiceReading
                    ? `Lendo documento… ${Math.round(
                        invoiceProgress *
                          100,
                      )}%`
                    : invoiceFile
                      ? `Arquivo: ${invoiceFile.name}`
                      : 'Fotografar ou anexar nota fiscal'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    className="hidden"
                    disabled={
                      invoiceReading
                    }
                    onChange={(event) => {
                      const selected =
                        event.currentTarget
                          .files?.[0]

                      if (selected) {
                        void readInvoice(
                          selected,
                        )
                      }

                      event.currentTarget.value =
                        ''
                    }}
                  />
                </label>

                {invoiceError && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                    {invoiceError}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </form>
    </FormModal>
  )
}
