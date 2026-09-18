import {
  Barcode,
  Camera,
  ChevronDown,
  Loader2,
  PackagePlus,
  ReceiptText,
  ScanText,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  listAssetTypes,
  listEnvironments,
  listUnits,
  updateAsset,
} from '../../data/asset-service'
import {
  addAssetExternalIdentifier,
  addPurchaseDocumentToAsset,
  ensureExternalOrganization,
  recordAssetLabelRead,
  setAssetSmartCore,
} from '../../data/asset-smart-service'
import {
  listTechnicalEntryCatalog,
  type TechnicalEntryCatalog,
} from '../../data/entry-catalog-service'
import {
  recordOcrIntelligenceExtraction,
  setAssetTechnicalProfile,
} from '../../data/ocr-intelligence-service'
import {
  buildAssetPrefill,
  type AssetPrefill,
  type EquipmentCategory,
} from '../../features/ocr-intelligence'
import {
  analyzePurchaseDocument,
} from '../../features/purchase-document-ocr'
import {
  uploadEvidence,
} from '../../data/evidence-service'
import {
  createExpressAsset,
} from '../../data/field-ops-service'
import {
  prepareEvidenceFile,
} from '../../lib/evidence-image'
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
import {
  SmartLabelReader,
} from './SmartLabelReader'

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'
const textareaClass =
  'min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

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
        <span className="mt-1.5 block text-[11px] leading-4 text-slate-400">
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

interface OcrSnapshot {
  file: File
  analysis: AssetLabelAnalysis
}

type PlacementMode = 'stock' | 'in_use'

const categoryAliases: Partial<
  Record<EquipmentCategory, string[]>
> = {
  desktop: ['desktop', 'computador', 'pc', 'workstation'],
  notebook: ['notebook', 'laptop', 'ultrabook'],
  server: ['servidor', 'server'],
  monitor: ['monitor', 'display'],
  printer: ['impressora', 'printer'],
  switch: ['switch'],
  router: ['roteador', 'router'],
  access_point: ['access point', 'access_point', 'ap'],
  firewall: ['firewall'],
  ups: ['nobreak', 'ups'],
  stabilizer: ['estabilizador', 'stabilizer'],
  power_strip: ['filtro de linha', 'power strip'],
  projector: ['projetor', 'projector'],
  keyboard: ['teclado', 'keyboard'],
  mouse: ['mouse'],
  scanner: ['scanner'],
  barcode_scanner: ['leitor de codigo', 'barcode scanner'],
  webcam: ['webcam'],
  dock: ['dock', 'docking station'],
  nas: ['nas'],
}

function normalizeTypeToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findTypeIdForCategory(
  category: EquipmentCategory,
  types: AssetTypeRecord[],
) {
  const aliases = categoryAliases[category] ?? []

  if (aliases.length === 0) return undefined

  const normalizedAliases = aliases.map(normalizeTypeToken)

  return types.find((type) => {
    const code = normalizeTypeToken(type.code)
    const name = normalizeTypeToken(type.name)

    return normalizedAliases.some(
      (alias) =>
        code === alias ||
        name === alias ||
        name.includes(alias),
    )
  })?.id
}

function optionalNumber(value: string) {
  const normalized = value
    .trim()
    .replace(',', '.')

  if (!normalized) return undefined

  const number = Number(normalized)
  return Number.isFinite(number)
    ? number
    : undefined
}

function optionalInteger(value: string) {
  const number = optionalNumber(value)

  return number === undefined
    ? undefined
    : Math.round(number)
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
  const [types, setTypes] = useState<AssetTypeRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [catalog, setCatalog] =
    useState<TechnicalEntryCatalog>(emptyCatalog)

  const [typeId, setTypeId] = useState('')
  const [serial, setSerial] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [productNumber, setProductNumber] = useState('')
  const [serviceTag, setServiceTag] = useState('')
  const [electricalRating, setElectricalRating] = useState('')
  const [ocrPrefill, setOcrPrefill] =
    useState<AssetPrefill | null>(null)

  const [processorManufacturer, setProcessorManufacturer] =
    useState('')
  const [processorModel, setProcessorModel] = useState('')
  const [memoryTotalGb, setMemoryTotalGb] = useState('')
  const [memoryType, setMemoryType] = useState('')
  const [memorySpeedMhz, setMemorySpeedMhz] = useState('')
  const [storageCapacityGb, setStorageCapacityGb] = useState('')
  const [storageType, setStorageType] = useState('')
  const [storageInterface, setStorageInterface] = useState('')
  const [storageFormFactor, setStorageFormFactor] = useState('')
  const [motherboardManufacturer, setMotherboardManufacturer] =
    useState('')
  const [motherboardModel, setMotherboardModel] = useState('')
  const [operatingSystem, setOperatingSystem] = useState('')
  const [wifiManufacturer, setWifiManufacturer] = useState('')
  const [wifiModel, setWifiModel] = useState('')
  const [macAddress, setMacAddress] = useState('')

  const [origin, setOrigin] = useState<EntryOrigin>('purchase')
  const [placementMode, setPlacementMode] =
    useState<PlacementMode>('stock')
  const [unitId, setUnitId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const [acquiredAt, setAcquiredAt] = useState('')
  const [warrantyExpiresAt, setWarrantyExpiresAt] = useState('')

  const [ownershipType, setOwnershipType] =
    useState<OwnershipType>('own')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationAcronym, setOrganizationAcronym] = useState('')
  const [organizationCity, setOrganizationCity] = useState('')
  const [organizationState, setOrganizationState] = useState('')
  const [externalIdentifierType, setExternalIdentifierType] =
    useState<ExternalIdentifierType>('patrimony')
  const [externalIdentifierValue, setExternalIdentifierValue] =
    useState('')
  const [serialScannerOpen, setSerialScannerOpen] =
    useState(false)
  const [thirdPartyScannerOpen, setThirdPartyScannerOpen] =
    useState(false)

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceSeries, setInvoiceSeries] = useState('')
  const [invoiceAccessKey, setInvoiceAccessKey] = useState('')
  const [invoiceIssuer, setInvoiceIssuer] = useState('')
  const [invoiceTaxId, setInvoiceTaxId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceReading, setInvoiceReading] = useState(false)
  const [invoiceReadStatus, setInvoiceReadStatus] = useState('')

  const [ocrSnapshot, setOcrSnapshot] =
    useState<OcrSnapshot | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let active = true

    queueMicrotask(() => {
      if (!active) return

      setLoading(true)
      setErrorMessage(null)
      setSerial('')
      setManufacturer('')
      setModel('')
      setProductNumber('')
      setServiceTag('')
      setElectricalRating('')
      setOcrPrefill(null)
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
      setOrigin('purchase')
      setPlacementMode('stock')
      setUnitId('')
      setEnvironmentId('')
      setNotes('')
      setPhoto(null)
      setAcquiredAt('')
      setWarrantyExpiresAt('')
      setOwnershipType('own')
      setOrganizationName('')
      setOrganizationAcronym('')
      setOrganizationCity('')
      setOrganizationState('')
      setExternalIdentifierType('patrimony')
      setExternalIdentifierValue('')
      setSerialScannerOpen(false)
      setThirdPartyScannerOpen(false)
      setInvoiceNumber('')
      setInvoiceSeries('')
      setInvoiceAccessKey('')
      setInvoiceIssuer('')
      setInvoiceTaxId('')
      setInvoiceDate('')
      setInvoiceFile(null)
      setInvoiceReading(false)
      setInvoiceReadStatus('')
      setOcrSnapshot(null)
      setAdvancedOpen(false)
    })

    async function bootstrap() {
      try {
        const [
          typeRows,
          unitRows,
          environmentRows,
          catalogRows,
        ] = await Promise.all([
          listAssetTypes(),
          listUnits(),
          listEnvironments(),
          listTechnicalEntryCatalog(),
        ])

        if (!active) return

        setTypes(typeRows)
        setUnits(
          unitRows.filter((item) => item.active),
        )
        setEnvironments(
          environmentRows.filter((item) => item.active),
        )
        setCatalog(catalogRows)
        setTypeId(typeRows[0]?.id ?? '')
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível preparar o cadastro.',
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

  const filteredEnvironments = useMemo(
    () =>
      environments.filter(
        (item) => item.unit_id === unitId,
      ),
    [environments, unitId],
  )

  const stockEnvironments = useMemo(
    () =>
      filteredEnvironments
        .slice()
        .sort((a, b) => {
          const aStock = a.environment_type === 'stock' ? 0 : 1
          const bStock = b.environment_type === 'stock' ? 0 : 1

          return (
            aStock - bStock ||
            a.name.localeCompare(b.name, 'pt-BR')
          )
        }),
    [filteredEnvironments],
  )

  function applyOcr(
    data: ReviewedLabelData,
    file: File,
    analysis: AssetLabelAnalysis,
  ) {
    const intelligenceInput = [
      data.processor && `Processador: ${data.processor}`,
      data.memory && `Memória: ${data.memory}`,
      data.storage && `Armazenamento: ${data.storage}`,
      data.motherboard && `Placa-mãe: ${data.motherboard}`,
      data.operatingSystem &&
        `Sistema operacional: ${data.operatingSystem}`,
      data.networkAdapter && `Rede/Wi-Fi: ${data.networkAdapter}`,
      analysis.rawText,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n')

    const prefill = buildAssetPrefill(intelligenceInput)

    setOcrPrefill(prefill)
    setManufacturer(
      data.manufacturer ||
        prefill.manufacturer ||
        '',
    )
    setModel(
      data.model ||
        prefill.model ||
        '',
    )
    setSerial(
      data.serialNumber ||
        prefill.serialNumber ||
        '',
    )
    setServiceTag(data.serviceTag)
    setProductNumber(
      data.productNumber ||
        prefill.partNumber ||
        prefill.sku ||
        '',
    )
    setElectricalRating(data.electricalRating)

    setProcessorManufacturer(
      prefill.processor?.manufacturer ?? '',
    )
    setProcessorModel(
      prefill.processor?.model ?? '',
    )
    setMemoryTotalGb(
      prefill.memory?.totalGb !== undefined
        ? String(prefill.memory.totalGb)
        : '',
    )
    setMemoryType(prefill.memory?.type ?? '')
    setMemorySpeedMhz(
      prefill.memory?.speedMhz !== undefined
        ? String(prefill.memory.speedMhz)
        : '',
    )
    setStorageCapacityGb(
      prefill.storage?.capacityGb !== undefined
        ? String(prefill.storage.capacityGb)
        : '',
    )
    setStorageType(prefill.storage?.type ?? '')
    setStorageInterface(prefill.storage?.interface ?? '')
    setStorageFormFactor(prefill.storage?.formFactor ?? '')
    setMotherboardManufacturer(
      prefill.motherboard?.manufacturer ?? '',
    )
    setMotherboardModel(
      prefill.motherboard?.model ?? '',
    )
    setOperatingSystem(prefill.operatingSystem ?? '')
    setWifiManufacturer(prefill.wifi?.manufacturer ?? '')
    setWifiModel(prefill.wifi?.model ?? '')
    setMacAddress(prefill.macAddress ?? '')

    const inferredTypeId = findTypeIdForCategory(
      prefill.type ?? 'unknown',
      types,
    )

    if (inferredTypeId) {
      setTypeId(inferredTypeId)
    }

    setNotes((current) => {
      const cleanCurrent = current
        .replace(
          /(?:\r?\n)?\[OCR NÃO CLASSIFICADO\][\s\S]*?\[\/OCR NÃO CLASSIFICADO\](?:\r?\n)?/g,
          '\n',
        )
        .trim()

      const remaining = prefill.observations?.trim()

      if (!remaining) return cleanCurrent

      return [
        cleanCurrent,
        '[OCR NÃO CLASSIFICADO]',
        remaining,
        '[/OCR NÃO CLASSIFICADO]',
      ]
        .filter(Boolean)
        .join('\n')
    })

    setPhoto(file)
    setOcrSnapshot({ file, analysis })
  }

  async function readInvoice(file: File) {
    try {
      setInvoiceReading(true)
      setInvoiceReadStatus('Preparando leitura')
      setErrorMessage(null)
      setInvoiceFile(file)

      const result = await analyzePurchaseDocument(
        file,
        (progress, status) => {
          setInvoiceReadStatus(
            `${status} · ${Math.round(progress * 100)}%`,
          )
        },
      )

      if (result.number) setInvoiceNumber(result.number)
      if (result.series) setInvoiceSeries(result.series)
      if (result.accessKey) setInvoiceAccessKey(result.accessKey)
      if (result.issuerName) setInvoiceIssuer(result.issuerName)
      if (result.issuerTaxId) setInvoiceTaxId(result.issuerTaxId)
      if (result.issueDate) setInvoiceDate(result.issueDate)

      setInvoiceReadStatus(
        'Leitura concluída. Revise os campos antes de salvar.',
      )
    } catch (error) {
      setInvoiceReadStatus('')
      setErrorMessage(
        error instanceof Error
          ? `Nota fiscal: ${error.message}`
          : 'Não foi possível ler a nota fiscal.',
      )
    } finally {
      setInvoiceReading(false)
    }
  }

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

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!typeId) {
      setErrorMessage('Selecione o tipo do ativo.')
      return
    }

    if (placementMode === 'in_use' && !unitId) {
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
        'Informe a instituição responsável pelo equipamento cedido, emprestado ou de terceiro.',
      )
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      const asset = await createExpressAsset({
        assetTypeId: typeId,
        manufacturer,
        model,
        serialNumber: serial,
        entryOrigin: origin,
        unitId: unitId || undefined,
        environmentId: environmentId || undefined,
        notes,
      })

      const warnings: string[] = []

      if (placementMode === 'in_use') {
        try {
          await updateAsset(asset.id, {
            asset_type_id: typeId,
            manufacturer,
            model,
            serial_number: serial,
            status: 'active',
            notes,
            acquired_at: acquiredAt || undefined,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Situação inicial: ${error.message}`
              : 'Não foi possível marcar o ativo como em uso.',
          )
        }
      }

      let organizationId: string | null = null

      if (organizationName.trim()) {
        try {
          organizationId =
            await ensureExternalOrganization({
              name: organizationName,
              acronym: organizationAcronym,
              city: organizationCity,
              state: organizationState,
            })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Instituição: ${error.message}`
              : 'Não foi possível registrar a instituição.',
          )
        }
      }

      try {
        await setAssetSmartCore({
          assetId: asset.id,
          productNumber,
          serviceTag,
          electricalRating,
          acquiredAt,
          warrantyExpiresAt,
          ownershipType,
          ownerOrganizationId: organizationId,
        })
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Dados complementares: ${error.message}`
            : 'Dados complementares não foram salvos.',
        )
      }

      if (hasTechnicalData) {
        try {
          await setAssetTechnicalProfile({
            assetId: asset.id,
            processorManufacturer,
            processorModel,
            memoryTotalGb: optionalNumber(memoryTotalGb),
            memoryType,
            memorySpeedMhz: optionalInteger(memorySpeedMhz),
            storageCapacityGb: optionalNumber(storageCapacityGb),
            storageType,
            storageInterface,
            storageFormFactor,
            motherboardManufacturer,
            motherboardModel,
            operatingSystem,
            wifiManufacturer,
            wifiModel,
            macAddress,
            source: ocrPrefill ? 'ocr' : 'manual',
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Perfil técnico: ${error.message}`
              : 'Perfil técnico não foi salvo.',
          )
        }
      }

      if (ocrPrefill) {
        try {
          await recordOcrIntelligenceExtraction({
            assetId: asset.id,
            extraction: ocrPrefill.extraction,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Rastreabilidade OCR: ${error.message}`
              : 'Rastreabilidade OCR não foi salva.',
          )
        }
      }

      if (externalIdentifierValue.trim()) {
        try {
          await addAssetExternalIdentifier({
            assetId: asset.id,
            organizationId,
            identifierType: externalIdentifierType,
            identifierValue: externalIdentifierValue,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Código de terceiro: ${error.message}`
              : 'Código de terceiro não foi salvo.',
          )
        }
      }

      let labelEvidenceId: string | null = null
      const labelPhoto = ocrSnapshot?.file ?? photo

      if (labelPhoto) {
        try {
          const prepared = await prepareEvidenceFile(labelPhoto)
          const evidence = await uploadEvidence({
            context: { assetId: asset.id },
            file: prepared,
            categoryCode: 'registration',
            captureMethod: 'camera',
            caption: ocrSnapshot
              ? 'Etiqueta original analisada pelo OCR'
              : 'Foto do pré-cadastro Express',
          })

          labelEvidenceId = evidence.id
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Foto da etiqueta: ${error.message}`
              : 'Foto da etiqueta não foi enviada.',
          )
        }
      }

      if (ocrSnapshot) {
        try {
          const confidence = Object.fromEntries(
            Object.entries(ocrSnapshot.analysis.fields).map(
              ([key, value]) => [
                key,
                value
                  ? {
                      score: value.score,
                      confidence: value.confidence,
                      requiresReview: value.requiresReview,
                    }
                  : null,
              ],
            ),
          )

          await recordAssetLabelRead({
            assetId: asset.id,
            evidenceId: labelEvidenceId,
            engine: ocrSnapshot.analysis.engine,
            engineVersion: ocrSnapshot.analysis.engineVersion,
            rawText: ocrSnapshot.analysis.rawText,
            barcodes: ocrSnapshot.analysis.barcodes,
            detectedData: ocrSnapshot.analysis.fields,
            confidence,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Histórico OCR: ${error.message}`
              : 'Histórico OCR não foi registrado.',
          )
        }
      }

      if (invoiceNumber.trim()) {
        let invoiceEvidenceId: string | null = null

        if (invoiceFile) {
          try {
            const prepared = await prepareEvidenceFile(invoiceFile)
            const evidence = await uploadEvidence({
              context: { assetId: asset.id },
              file: prepared,
              categoryCode: 'other',
              captureMethod: invoiceFile.type.startsWith('image/')
                ? 'camera'
                : 'file',
              caption: `Documento fiscal ${invoiceNumber.trim()}`,
            })

            invoiceEvidenceId = evidence.id
          } catch (error) {
            warnings.push(
              error instanceof Error
                ? `Arquivo da nota fiscal: ${error.message}`
                : 'Arquivo da nota fiscal não foi enviado.',
            )
          }
        }

        try {
          await addPurchaseDocumentToAsset({
            assetId: asset.id,
            documentType: 'invoice',
            number: invoiceNumber,
            series: invoiceSeries,
            accessKey: invoiceAccessKey,
            issuerName: invoiceIssuer,
            issuerTaxId: invoiceTaxId,
            issueDate: invoiceDate,
            evidenceId: invoiceEvidenceId,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Nota fiscal: ${error.message}`
              : 'Nota fiscal não foi vinculada.',
          )
        }
      }

      onCreated(
        asset.id,
        warnings.length > 0
          ? warnings.join('\n')
          : undefined,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o pré-cadastro.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Novo ativo Express"
      description="Cadastro rápido com OCR, catálogos assistidos, localização de estoque e leitura de nota fiscal."
      onClose={onClose}
      widthClassName="max-w-4xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="m17-express-form"
            disabled={saving || loading || !typeId}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            <PackagePlus size={16} />
            {saving ? 'Cadastrando...' : 'Criar pré-cadastro'}
          </button>
        </div>
      }
    >
      <form
        id="m17-express-form"
        onSubmit={(event) => void submit(event)}
        className="space-y-5"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <SmartLabelReader
          disabled={saving}
          onApply={applyOcr}
        />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            Código interno do patrimônio
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            Gerado automaticamente ao salvar
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Padrão TIPO-000000. Códigos antigos continuam reconhecidos por compatibilidade.
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo do ativo">
            <select
              className={inputClass}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
              required
            >
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Origem da entrada">
            <select
              className={inputClass}
              value={origin}
              onChange={(event) =>
                setOrigin(event.target.value as EntryOrigin)
              }
            >
              <option value="purchase">Compra</option>
              <option value="donation">Doação</option>
              <option value="used">Equipamento usado</option>
              <option value="transfer">Transferência</option>
              <option value="other">Outra origem</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Fabricante"
            hint="Escolha uma sugestão ou digite outro fabricante. Valores já usados também passam a aparecer nas próximas buscas."
          >
            <input
              className={inputClass}
              list="m17-manufacturers"
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
              placeholder="Pesquisar ou digitar fabricante"
            />
            <Datalist
              id="m17-manufacturers"
              values={catalog.manufacturers}
            />
          </Field>

          <Field label="Modelo">
            <input
              className={inputClass}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Modelo do equipamento"
            />
          </Field>

          <Field
            label="Número de série do fabricante"
            hint="Pode ser digitado ou lido diretamente do código de barras original do equipamento."
          >
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={serial}
                onChange={(event) => setSerial(event.target.value)}
                autoCapitalize="characters"
              />
              <button
                type="button"
                onClick={() =>
                  setSerialScannerOpen((current) => !current)
                }
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
              >
                <Barcode size={15} />
                Ler
              </button>
            </div>
          </Field>

          {serialScannerOpen && (
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-bold text-slate-700">
                Ler número de série
              </div>
              <InventoryScanner
                compact
                onScan={async (value) => {
                  setSerial(value)
                  setSerialScannerOpen(false)
                }}
              />
            </div>
          )}

          <Field label="Código de serviço do fabricante (opcional)">
            <input
              className={inputClass}
              value={serviceTag}
              onChange={(event) => setServiceTag(event.target.value)}
              autoCapitalize="characters"
            />
          </Field>

          <Field label="Código do produto/peça do fabricante (opcional)">
            <input
              className={inputClass}
              value={productNumber}
              onChange={(event) => setProductNumber(event.target.value)}
            />
          </Field>

          <Field label="Alimentação / tensão">
            <input
              className={inputClass}
              value={electricalRating}
              onChange={(event) => setElectricalRating(event.target.value)}
              placeholder="Ex.: 100-240V · 50/60Hz"
            />
          </Field>
        </div>

        <section className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.08em] text-sky-700">
                Configuração técnica
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                O OCR preenche quando conseguir. Se não detectar, escolha uma sugestão ou digite manualmente.
              </p>
            </div>
            {ocrPrefill && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                OCR aplicado
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Fabricante do processador">
              <input
                className={inputClass}
                list="m17-cpu-manufacturers"
                value={processorManufacturer}
                onChange={(event) =>
                  setProcessorManufacturer(event.target.value)
                }
                placeholder="Intel, AMD..."
              />
              <Datalist
                id="m17-cpu-manufacturers"
                values={catalog.processorManufacturers}
              />
            </Field>

            <div className="sm:col-span-1 lg:col-span-2">
              <Field label="Processador / modelo">
                <input
                  className={inputClass}
                  list="m17-cpu-models"
                  value={processorModel}
                  onChange={(event) =>
                    setProcessorModel(event.target.value)
                  }
                  placeholder="Ex.: Intel Core i5-10400"
                />
                <Datalist
                  id="m17-cpu-models"
                  values={catalog.processorModels}
                />
              </Field>
            </div>

            <Field label="Memória total (GB)">
              <input
                className={inputClass}
                list="m17-memory-sizes"
                inputMode="decimal"
                value={memoryTotalGb}
                onChange={(event) => setMemoryTotalGb(event.target.value)}
                placeholder="Ex.: 8"
              />
              <Datalist
                id="m17-memory-sizes"
                values={catalog.memorySizesGb}
              />
            </Field>

            <Field label="Tipo de memória">
              <input
                className={inputClass}
                list="m17-memory-types"
                value={memoryType}
                onChange={(event) => setMemoryType(event.target.value)}
                placeholder="Ex.: DDR4"
              />
              <Datalist
                id="m17-memory-types"
                values={catalog.memoryTypes}
              />
            </Field>

            <Field label="Velocidade da memória (MHz)">
              <input
                className={inputClass}
                list="m17-memory-speeds"
                inputMode="numeric"
                value={memorySpeedMhz}
                onChange={(event) => setMemorySpeedMhz(event.target.value)}
                placeholder="Ex.: 3200"
              />
              <Datalist
                id="m17-memory-speeds"
                values={catalog.memorySpeedsMhz}
              />
            </Field>

            <Field label="Armazenamento (GB)">
              <input
                className={inputClass}
                list="m17-storage-capacities"
                inputMode="decimal"
                value={storageCapacityGb}
                onChange={(event) => setStorageCapacityGb(event.target.value)}
                placeholder="Ex.: 512"
              />
              <Datalist
                id="m17-storage-capacities"
                values={catalog.storageCapacitiesGb}
              />
            </Field>

            <Field label="Tipo de armazenamento">
              <input
                className={inputClass}
                list="m17-storage-types"
                value={storageType}
                onChange={(event) => setStorageType(event.target.value)}
                placeholder="SSD, HDD..."
              />
              <Datalist
                id="m17-storage-types"
                values={catalog.storageTypes}
              />
            </Field>

            <Field label="Interface">
              <input
                className={inputClass}
                list="m17-storage-interfaces"
                value={storageInterface}
                onChange={(event) => setStorageInterface(event.target.value)}
                placeholder="SATA, NVMe..."
              />
              <Datalist
                id="m17-storage-interfaces"
                values={catalog.storageInterfaces}
              />
            </Field>

            <Field label="Formato do armazenamento">
              <input
                className={inputClass}
                list="m17-storage-form-factors"
                value={storageFormFactor}
                onChange={(event) => setStorageFormFactor(event.target.value)}
                placeholder='M.2, 2.5"...'
              />
              <Datalist
                id="m17-storage-form-factors"
                values={catalog.storageFormFactors}
              />
            </Field>

            <Field label="Sistema operacional">
              <input
                className={inputClass}
                list="m17-operating-systems"
                value={operatingSystem}
                onChange={(event) => setOperatingSystem(event.target.value)}
                placeholder="Windows 11 Pro..."
              />
              <Datalist
                id="m17-operating-systems"
                values={catalog.operatingSystems}
              />
            </Field>

            <Field label="Fabricante da placa-mãe">
              <input
                className={inputClass}
                list="m17-manufacturers"
                value={motherboardManufacturer}
                onChange={(event) =>
                  setMotherboardManufacturer(event.target.value)
                }
              />
            </Field>

            <Field label="Modelo da placa-mãe">
              <input
                className={inputClass}
                value={motherboardModel}
                onChange={(event) => setMotherboardModel(event.target.value)}
              />
            </Field>

            <Field label="Fabricante Wi-Fi">
              <input
                className={inputClass}
                list="m17-manufacturers"
                value={wifiManufacturer}
                onChange={(event) => setWifiManufacturer(event.target.value)}
              />
            </Field>

            <Field label="Modelo Wi-Fi">
              <input
                className={inputClass}
                value={wifiModel}
                onChange={(event) => setWifiModel(event.target.value)}
              />
            </Field>

            <Field label="MAC address">
              <input
                className={inputClass}
                value={macAddress}
                onChange={(event) =>
                  setMacAddress(event.target.value.toUpperCase())
                }
                placeholder="AA:BB:CC:DD:EE:FF"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
            Destino inicial
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Diferencie equipamento guardado no estoque de equipamento já em uso.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPlacementMode('stock')}
              className={`rounded-xl border p-3 text-left transition ${
                placementMode === 'stock'
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-sm font-bold text-slate-900">
                Estoque
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Computador/equipamento disponível, ainda sem uso em unidade.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPlacementMode('in_use')}
              className={`rounded-xl border p-3 text-left transition ${
                placementMode === 'in_use'
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-sm font-bold text-slate-900">
                Em uso
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Já será associado a uma unidade física.
              </div>
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label={
                placementMode === 'stock'
                  ? 'Unidade física onde fica o estoque (opcional)'
                  : 'Unidade inicial'
              }
            >
              <select
                className={inputClass}
                value={unitId}
                onChange={(event) => {
                  setUnitId(event.target.value)
                  setEnvironmentId('')
                }}
              >
                <option value="">
                  {placementMode === 'stock'
                    ? 'Estoque sem unidade física definida'
                    : 'Selecione a unidade'}
                </option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={
                placementMode === 'stock'
                  ? 'Local / estante / prateleira (opcional)'
                  : 'Ambiente inicial'
              }
              hint={
                placementMode === 'stock'
                  ? 'Locais de estoque podem ser cadastrados na tela Estoque.'
                  : undefined
              }
            >
              <select
                className={inputClass}
                value={environmentId}
                disabled={!unitId}
                onChange={(event) => setEnvironmentId(event.target.value)}
              >
                <option value="">
                  {placementMode === 'stock'
                    ? 'Sem posição física definida'
                    : 'Sem ambiente definido'}
                </option>
                {stockEnvironments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name}
                    {environment.environment_type === 'stock'
                      ? ' · estoque'
                      : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <Field label="Observação rápida">
          <textarea
            className={textareaClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: recebido na portaria, NF pendente, doação..."
          />
        </Field>

        {!ocrSnapshot && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Foto do recebimento
            </span>
            <div className="flex min-h-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
                <Camera size={17} />
                {photo ? 'Trocar foto' : 'Tirar foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) =>
                    setPhoto(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>
            </div>
          </label>
        )}

        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
        >
          <div>
            <div className="text-sm font-black text-slate-900">
              Aquisição, garantia e código de terceiro
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Nota fiscal, garantia, posse e código de terceiro.
            </div>
          </div>
          <ChevronDown
            size={17}
            className={`transition ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {advancedOpen && (
          <div className="space-y-5 rounded-2xl border border-slate-200 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data de aquisição">
                <input
                  type="date"
                  className={inputClass}
                  value={acquiredAt}
                  onChange={(event) => setAcquiredAt(event.target.value)}
                />
              </Field>

              <Field label="Garantia até">
                <input
                  type="date"
                  className={inputClass}
                  value={warrantyExpiresAt}
                  onChange={(event) =>
                    setWarrantyExpiresAt(event.target.value)
                  }
                />
              </Field>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">
                Posse / custódia e código de terceiro
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Situação">
                  <select
                    className={inputClass}
                    value={ownershipType}
                    onChange={(event) =>
                      setOwnershipType(
                        event.target.value as OwnershipType,
                      )
                    }
                  >
                    <option value="own">Próprio</option>
                    <option value="ceded">Cedido para nós</option>
                    <option value="loaned">Emprestado para nós</option>
                    <option value="commodatum">Comodato</option>
                    <option value="leased">Locado</option>
                    <option value="third_party">Terceiro</option>
                    <option value="other">Outro</option>
                  </select>
                </Field>

                <Field label="Instituição responsável/de origem (quando houver)">
                  <input
                    className={inputClass}
                    value={organizationName}
                    onChange={(event) =>
                      setOrganizationName(event.target.value)
                    }
                    placeholder="Nome do órgão/instituição"
                  />
                </Field>

                <Field label="Sigla">
                  <input
                    className={inputClass}
                    value={organizationAcronym}
                    onChange={(event) =>
                      setOrganizationAcronym(event.target.value)
                    }
                  />
                </Field>

                <Field label="Cidade">
                  <input
                    className={inputClass}
                    value={organizationCity}
                    onChange={(event) =>
                      setOrganizationCity(event.target.value)
                    }
                  />
                </Field>

                <Field label="UF">
                  <input
                    className={inputClass}
                    maxLength={2}
                    value={organizationState}
                    onChange={(event) =>
                      setOrganizationState(
                        event.target.value.toUpperCase(),
                      )
                    }
                  />
                </Field>

                <Field
                  label="Classificação do código de terceiro"
                  hint="A classificação mantém a rastreabilidade histórica; o campo principal é sempre tratado no sistema como Código de terceiro."
                >
                  <select
                    className={inputClass}
                    value={externalIdentifierType}
                    onChange={(event) =>
                      setExternalIdentifierType(
                        event.target.value as ExternalIdentifierType,
                      )
                    }
                  >
                    <option value="patrimony">Código patrimonial do terceiro</option>
                    <option value="tombamento">Tombamento do terceiro</option>
                    <option value="internal_serial">Código interno do terceiro / anterior</option>
                    <option value="contract">Contrato / convênio</option>
                    <option value="other">Outro código de terceiro</option>
                  </select>
                </Field>

                <div className="sm:col-span-2">
                  <Field
                    label="Código de terceiro (opcional)"
                    hint="Use o número da plaqueta, etiqueta patrimonial ou código de barras da empresa/órgão que cedeu o equipamento."
                  >
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        value={externalIdentifierValue}
                        onChange={(event) =>
                          setExternalIdentifierValue(event.target.value)
                        }
                        placeholder="Ex.: 00457821"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setThirdPartyScannerOpen((current) => !current)
                        }
                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                      >
                        <Barcode size={15} />
                        Ler
                      </button>
                    </div>
                  </Field>

                  {thirdPartyScannerOpen && (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 text-xs font-bold text-slate-700">
                        Ler código de terceiro
                      </div>
                      <InventoryScanner
                        compact
                        onScan={async (value) => {
                          setExternalIdentifierValue(value)
                          setThirdPartyScannerOpen(false)
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <ReceiptText size={15} className="text-slate-500" />
                <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">
                  Nota fiscal
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Preenchimento por foto
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-500">
                      Usa o mesmo OCR local já utilizado na etiqueta. Revise os campos antes de salvar.
                    </div>
                  </div>

                  <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-slate-700 shadow-sm ${invoiceReading ? 'pointer-events-none opacity-60' : ''}`}>
                    {invoiceReading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ScanText size={15} />
                    )}
                    {invoiceReading
                      ? 'Lendo...'
                      : 'Fotografar e preencher'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={invoiceReading}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0]
                        if (file) void readInvoice(file)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                </div>

                {invoiceReadStatus && (
                  <div className="mt-2 text-[11px] font-semibold text-sky-700">
                    {invoiceReadStatus}
                  </div>
                )}
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Número">
                  <input
                    className={inputClass}
                    value={invoiceNumber}
                    onChange={(event) => setInvoiceNumber(event.target.value)}
                  />
                </Field>

                <Field label="Série">
                  <input
                    className={inputClass}
                    value={invoiceSeries}
                    onChange={(event) => setInvoiceSeries(event.target.value)}
                  />
                </Field>

                <Field label="Data de emissão">
                  <input
                    type="date"
                    className={inputClass}
                    value={invoiceDate}
                    onChange={(event) => setInvoiceDate(event.target.value)}
                  />
                </Field>

                <Field label="Emitente">
                  <input
                    className={inputClass}
                    value={invoiceIssuer}
                    onChange={(event) => setInvoiceIssuer(event.target.value)}
                  />
                </Field>

                <Field label="CNPJ/CPF emitente">
                  <input
                    className={inputClass}
                    value={invoiceTaxId}
                    onChange={(event) => setInvoiceTaxId(event.target.value)}
                  />
                </Field>

                <Field label="Chave NF-e">
                  <input
                    className={inputClass}
                    value={invoiceAccessKey}
                    onChange={(event) => setInvoiceAccessKey(event.target.value)}
                  />
                </Field>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Foto/PDF da nota
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="block w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                  onChange={(event) =>
                    setInvoiceFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>
            </div>
          </div>
        )}
      </form>
    </FormModal>
  )
}
