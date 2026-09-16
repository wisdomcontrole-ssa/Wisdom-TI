import {
  Camera,
  ChevronDown,
  PackagePlus,
  ReceiptText,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  listAssetTypes,
  listEnvironments,
  listUnits,
} from '../../data/asset-service'
import {
  addAssetExternalIdentifier,
  addPurchaseDocumentToAsset,
  ensureExternalOrganization,
  recordAssetLabelRead,
  setAssetSmartCore,
} from '../../data/asset-smart-service'
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
import { FormModal } from '../ui/FormModal'
import {
  SmartLabelReader,
} from './SmartLabelReader'

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'
const textareaClass =
  'min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}

function TechnicalValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  if (!value) return null

  return (
    <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 font-semibold text-slate-800">
        {value}
      </div>
    </div>
  )
}

interface OcrSnapshot {
  file: File
  analysis: AssetLabelAnalysis
}

const categoryAliases: Partial<
  Record<EquipmentCategory, string[]>
> = {
  desktop: [
    'desktop',
    'computador',
    'pc',
    'workstation',
  ],
  notebook: [
    'notebook',
    'laptop',
    'ultrabook',
  ],
  server: ['servidor', 'server'],
  monitor: ['monitor', 'display'],
  printer: ['impressora', 'printer'],
  switch: ['switch'],
  router: ['roteador', 'router'],
  access_point: [
    'access point',
    'access_point',
    'ap',
  ],
  firewall: ['firewall'],
  ups: ['nobreak', 'ups'],
  stabilizer: [
    'estabilizador',
    'stabilizer',
  ],
  power_strip: [
    'filtro de linha',
    'power strip',
  ],
  projector: ['projetor', 'projector'],
  keyboard: ['teclado', 'keyboard'],
  mouse: ['mouse'],
  scanner: ['scanner'],
  barcode_scanner: [
    'leitor de codigo',
    'barcode scanner',
  ],
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
  const aliases =
    categoryAliases[category] ?? []

  if (aliases.length === 0) {
    return undefined
  }

  const normalizedAliases =
    aliases.map(normalizeTypeToken)

  return types.find((type) => {
    const code =
      normalizeTypeToken(type.code)
    const name =
      normalizeTypeToken(type.name)

    return normalizedAliases.some(
      (alias) =>
        code === alias ||
        name === alias ||
        name.includes(alias),
    )
  })?.id
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

  const [typeId, setTypeId] = useState('')
  const [serial, setSerial] = useState('')
  const [manufacturer, setManufacturer] =
    useState('')
  const [model, setModel] = useState('')
  const [productNumber, setProductNumber] =
    useState('')
  const [serviceTag, setServiceTag] =
    useState('')
  const [
    electricalRating,
    setElectricalRating,
  ] = useState('')
  const [ocrPrefill, setOcrPrefill] =
    useState<AssetPrefill | null>(null)
  const [origin, setOrigin] =
    useState<EntryOrigin>('purchase')
  const [unitId, setUnitId] =
    useState('')
  const [
    environmentId,
    setEnvironmentId,
  ] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] =
    useState<File | null>(null)

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
  const [
    organizationCity,
    setOrganizationCity,
  ] = useState('')
  const [
    organizationState,
    setOrganizationState,
  ] = useState('')
  const [
    externalIdentifierType,
    setExternalIdentifierType,
  ] =
    useState<ExternalIdentifierType>(
      'patrimony',
    )
  const [
    externalIdentifierValue,
    setExternalIdentifierValue,
  ] = useState('')

  const [invoiceNumber, setInvoiceNumber] =
    useState('')
  const [invoiceSeries, setInvoiceSeries] =
    useState('')
  const [
    invoiceAccessKey,
    setInvoiceAccessKey,
  ] = useState('')
  const [invoiceIssuer, setInvoiceIssuer] =
    useState('')
  const [invoiceTaxId, setInvoiceTaxId] =
    useState('')
  const [invoiceDate, setInvoiceDate] =
    useState('')
  const [invoiceFile, setInvoiceFile] =
    useState<File | null>(null)

  const [ocrSnapshot, setOcrSnapshot] =
    useState<OcrSnapshot | null>(null)
  const [advancedOpen, setAdvancedOpen] =
    useState(false)

  const [saving, setSaving] =
    useState(false)
  const [loading, setLoading] =
    useState(false)
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
      setOrigin('purchase')
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
      setExternalIdentifierType(
        'patrimony',
      )
      setExternalIdentifierValue('')
      setInvoiceNumber('')
      setInvoiceSeries('')
      setInvoiceAccessKey('')
      setInvoiceIssuer('')
      setInvoiceTaxId('')
      setInvoiceDate('')
      setInvoiceFile(null)
      setOcrSnapshot(null)
      setAdvancedOpen(false)
    })

    async function bootstrap() {
      try {
        const [
          typeRows,
          unitRows,
          environmentRows,
        ] = await Promise.all([
          listAssetTypes(),
          listUnits(),
          listEnvironments(),
        ])

        if (!active) return

        setTypes(typeRows)
        setUnits(
          unitRows.filter(
            (item) => item.active,
          ),
        )
        setEnvironments(
          environmentRows.filter(
            (item) => item.active,
          ),
        )
        setTypeId(typeRows[0]?.id ?? '')
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível preparar o cadastro.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
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
        (item) =>
          item.unit_id === unitId,
      ),
    [environments, unitId],
  )

  function applyOcr(
    data: ReviewedLabelData,
    file: File,
    analysis: AssetLabelAnalysis,
  ) {
    const intelligenceInput = [
      data.processor &&
        'Processador: ' +
          data.processor,
      data.memory &&
        'Memória: ' +
          data.memory,
      data.storage &&
        'Armazenamento: ' +
          data.storage,
      data.motherboard &&
        'Placa-mãe: ' +
          data.motherboard,
      data.operatingSystem &&
        'Sistema operacional: ' +
          data.operatingSystem,
      data.networkAdapter &&
        'Rede/Wi-Fi: ' +
          data.networkAdapter,
      analysis.rawText,
    ]
      .filter(
        (value): value is string =>
          Boolean(value),
      )
      .join('\n')

    const prefill =
      buildAssetPrefill(
        intelligenceInput,
      )

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
    setElectricalRating(
      data.electricalRating,
    )

    const inferredTypeId =
      findTypeIdForCategory(
        prefill.type ?? 'unknown',
        types,
      )

    if (inferredTypeId) {
      setTypeId(inferredTypeId)
    }

    setNotes((current) => {
      const withoutOldOcr =
        current
          .replace(
            /(?:\r?\n)?\[ESPECIFICAÇÕES OCR\][\s\S]*?\[\/ESPECIFICAÇÕES OCR\](?:\r?\n)?/g,
            '\n',
          )
          .replace(
            /(?:\r?\n)?\[OCR NÃO CLASSIFICADO\][\s\S]*?\[\/OCR NÃO CLASSIFICADO\](?:\r?\n)?/g,
            '\n',
          )
          .trim()

      const remaining =
        prefill.observations?.trim()

      if (!remaining) {
        return withoutOldOcr
      }

      const block = [
        '[OCR NÃO CLASSIFICADO]',
        remaining,
        '[/OCR NÃO CLASSIFICADO]',
      ].join('\n')

      return [
        withoutOldOcr,
        block,
      ]
        .filter(Boolean)
        .join('\n\n')
    })

    setPhoto(file)
    setOcrSnapshot({
      file,
      analysis,
    })
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

      const asset =
        await createExpressAsset({
          assetTypeId: typeId,
          manufacturer,
          model,
          serialNumber: serial,
          entryOrigin: origin,
          unitId:
            unitId || undefined,
          environmentId:
            environmentId ||
            undefined,
          notes,
        })

      const warnings: string[] = []

      let organizationId:
        | string
        | null = null

      if (organizationName.trim()) {
        try {
          organizationId =
            await ensureExternalOrganization({
              name: organizationName,
              acronym:
                organizationAcronym,
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
          ownerOrganizationId:
            organizationId,
        })
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Dados complementares: ${error.message}`
            : 'Dados complementares não foram salvos.',
        )
      }

      if (ocrPrefill) {
        try {
          await setAssetTechnicalProfile({
            assetId: asset.id,
            processorManufacturer:
              ocrPrefill.processor
                ?.manufacturer,
            processorModel:
              ocrPrefill.processor?.model,
            memoryTotalGb:
              ocrPrefill.memory?.totalGb,
            memoryType:
              ocrPrefill.memory?.type,
            memorySpeedMhz:
              ocrPrefill.memory
                ?.speedMhz,
            storageCapacityGb:
              ocrPrefill.storage
                ?.capacityGb,
            storageType:
              ocrPrefill.storage?.type,
            storageInterface:
              ocrPrefill.storage
                ?.interface,
            storageFormFactor:
              ocrPrefill.storage
                ?.formFactor,
            motherboardManufacturer:
              ocrPrefill.motherboard
                ?.manufacturer,
            motherboardModel:
              ocrPrefill.motherboard
                ?.model,
            operatingSystem:
              ocrPrefill.operatingSystem,
            wifiManufacturer:
              ocrPrefill.wifi
                ?.manufacturer,
            wifiModel:
              ocrPrefill.wifi?.model,
            macAddress:
              ocrPrefill.macAddress,
            source: 'ocr',
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? 'Perfil técnico: ' +
                  error.message
              : 'Perfil técnico não foi salvo.',
          )
        }

        try {
          await recordOcrIntelligenceExtraction({
            assetId: asset.id,
            extraction:
              ocrPrefill.extraction,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? 'Rastreabilidade OCR: ' +
                  error.message
              : 'Rastreabilidade OCR não foi salva.',
          )
        }
      }
      if (externalIdentifierValue.trim()) {
        try {
          await addAssetExternalIdentifier({
            assetId: asset.id,
            organizationId,
            identifierType:
              externalIdentifierType,
            identifierValue:
              externalIdentifierValue,
          })
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Identificador externo: ${error.message}`
              : 'Identificador externo não foi salvo.',
          )
        }
      }

      let labelEvidenceId:
        | string
        | null = null

      const labelPhoto =
        ocrSnapshot?.file ?? photo

      if (labelPhoto) {
        try {
          const prepared =
            await prepareEvidenceFile(
              labelPhoto,
            )

          const evidence =
            await uploadEvidence({
              context: {
                assetId: asset.id,
              },
              file: prepared,
              categoryCode:
                'registration',
              captureMethod: 'camera',
              caption: ocrSnapshot
                ? 'Etiqueta original analisada pelo OCR'
                : 'Foto do pré-cadastro Express',
            })

          labelEvidenceId =
            evidence.id
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
          const confidence =
            Object.fromEntries(
              Object.entries(
                ocrSnapshot.analysis
                  .fields,
              ).map(([key, value]) => [
                key,
                value
                  ? {
                      score:
                        value.score,
                      confidence:
                        value.confidence,
                      requiresReview:
                        value.requiresReview,
                    }
                  : null,
              ]),
            )

          await recordAssetLabelRead({
            assetId: asset.id,
            evidenceId:
              labelEvidenceId,
            engine:
              ocrSnapshot.analysis.engine,
            engineVersion:
              ocrSnapshot.analysis
                .engineVersion,
            rawText:
              ocrSnapshot.analysis
                .rawText,
            barcodes:
              ocrSnapshot.analysis
                .barcodes,
            detectedData:
              ocrSnapshot.analysis
                .fields,
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
        let invoiceEvidenceId:
          | string
          | null = null

        if (invoiceFile) {
          try {
            const prepared =
              await prepareEvidenceFile(
                invoiceFile,
              )

            const evidence =
              await uploadEvidence({
                context: {
                  assetId: asset.id,
                },
                file: prepared,
                categoryCode: 'other',
                captureMethod: 'file',
                caption:
                  `Documento fiscal ${invoiceNumber.trim()}`,
              })

            invoiceEvidenceId =
              evidence.id
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
            accessKey:
              invoiceAccessKey,
            issuerName:
              invoiceIssuer,
            issuerTaxId:
              invoiceTaxId,
            issueDate: invoiceDate,
            evidenceId:
              invoiceEvidenceId,
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
      description="Pré-cadastro rápido com leitura inteligente de etiqueta, rastreio fiscal e posse institucional."
      onClose={onClose}
      widthClassName="max-w-3xl"
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
            form="m13-express-form"
            disabled={
              saving ||
              loading ||
              !typeId
            }
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            <PackagePlus size={16} />
            {saving
              ? 'Cadastrando...'
              : 'Criar pré-cadastro'}
          </button>
        </div>
      }
    >
      <form
        id="m13-express-form"
        onSubmit={(event) =>
          void submit(event)
        }
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
            Padrão WIS-TIPO-000000. Este é o identificador interno da instituição e não precisa ser digitado.
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

          <Field label="Origem da entrada">
            <select
              className={inputClass}
              value={origin}
              onChange={(event) =>
                setOrigin(
                  event.target
                    .value as EntryOrigin,
                )
              }
            >
              <option value="purchase">
                Compra
              </option>
              <option value="donation">
                Doação
              </option>
              <option value="used">
                Equipamento usado
              </option>
              <option value="transfer">
                Transferência
              </option>
              <option value="other">
                Outra origem
              </option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fabricante">
            <input
              className={inputClass}
              value={manufacturer}
              onChange={(event) =>
                setManufacturer(
                  event.target.value,
                )
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

          <Field label="Número de série do fabricante">
            <input
              className={inputClass}
              value={serial}
              onChange={(event) =>
                setSerial(
                  event.target.value,
                )
              }
              autoCapitalize="characters"
            />
          </Field>

          <Field label="Código de serviço do fabricante (opcional)">
            <input
              className={inputClass}
              value={serviceTag}
              onChange={(event) =>
                setServiceTag(
                  event.target.value,
                )
              }
              autoCapitalize="characters"
            />
          </Field>

          <Field label="Código do produto/peça do fabricante (opcional)">
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

          <Field label="Alimentação / tensão">
            <input
              className={inputClass}
              value={
                electricalRating
              }
              onChange={(event) =>
                setElectricalRating(
                  event.target.value,
                )
              }
              placeholder="Ex.: 100-240V · 50/60Hz"
            />
          </Field>
        </div>

        {ocrPrefill && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="text-xs font-black uppercase tracking-[0.08em] text-emerald-700">
              Dados técnicos identificados
            </div>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <TechnicalValue
                label="Processador"
                value={[
                  ocrPrefill.processor
                    ?.manufacturer,
                  ocrPrefill.processor?.model,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <TechnicalValue
                label="Memória"
                value={[
                  ocrPrefill.memory
                    ?.totalGb !== undefined
                    ? String(
                        ocrPrefill.memory
                          .totalGb,
                      ) + ' GB'
                    : '',
                  ocrPrefill.memory?.type,
                  ocrPrefill.memory
                    ?.speedMhz !== undefined
                    ? String(
                        ocrPrefill.memory
                          .speedMhz,
                      ) + ' MHz'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <TechnicalValue
                label="Armazenamento"
                value={[
                  ocrPrefill.storage
                    ?.type,
                  ocrPrefill.storage
                    ?.capacityGb !==
                  undefined
                    ? String(
                        ocrPrefill.storage
                          .capacityGb,
                      ) + ' GB'
                    : '',
                  ocrPrefill.storage
                    ?.interface,
                  ocrPrefill.storage
                    ?.formFactor,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <TechnicalValue
                label="Placa-mãe"
                value={[
                  ocrPrefill.motherboard
                    ?.manufacturer,
                  ocrPrefill.motherboard
                    ?.model,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <TechnicalValue
                label="Sistema operacional"
                value={
                  ocrPrefill.operatingSystem ||
                  ''
                }
              />
              <TechnicalValue
                label="Wi-Fi"
                value={[
                  ocrPrefill.wifi
                    ?.manufacturer,
                  ocrPrefill.wifi?.model,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <TechnicalValue
                label="MAC"
                value={
                  ocrPrefill.macAddress ||
                  ''
                }
              />
              <TechnicalValue
                label="Confiança"
                value={
                  String(
                    Math.round(
                      ocrPrefill.extraction
                        .confidence * 100,
                    ),
                  ) + '%'
                }
              />
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unidade inicial">
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
                Sem unidade definida
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

          <Field label="Ambiente inicial">
            <select
              className={inputClass}
              value={environmentId}
              disabled={!unitId}
              onChange={(event) =>
                setEnvironmentId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Sem ambiente definido
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
                    {
                      environment.name
                    }
                  </option>
                ),
              )}
            </select>
          </Field>
        </div>

        <Field label="Observação rápida">
          <textarea
            className={textareaClass}
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
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
                {photo
                  ? 'Trocar foto'
                  : 'Tirar foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) =>
                    setPhoto(
                      event
                        .currentTarget
                        .files?.[0] ??
                        null,
                    )
                  }
                />
              </label>
            </div>
          </label>
        )}

        <button
          type="button"
          onClick={() =>
            setAdvancedOpen(
              (current) => !current,
            )
          }
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
        >
          <div>
            <div className="text-sm font-black text-slate-900">
              Aquisição, garantia e identificação externa
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Nota fiscal, garantia, posse e códigos externos ou anteriores.
            </div>
          </div>
          <ChevronDown
            size={17}
            className={`transition ${
              advancedOpen
                ? 'rotate-180'
                : ''
            }`}
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
                  onChange={(event) =>
                    setAcquiredAt(
                      event.target
                        .value,
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
                      event.target
                        .value,
                    )
                  }
                />
              </Field>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">
                Posse / custódia e referência externa
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Situação">
                  <select
                    className={inputClass}
                    value={
                      ownershipType
                    }
                    onChange={(event) =>
                      setOwnershipType(
                        event.target
                          .value as OwnershipType,
                      )
                    }
                  >
                    <option value="own">
                      Próprio
                    </option>
                    <option value="ceded">
                      Cedido para nós
                    </option>
                    <option value="loaned">
                      Emprestado para nós
                    </option>
                    <option value="commodatum">
                      Comodato
                    </option>
                    <option value="leased">
                      Locado
                    </option>
                    <option value="third_party">
                      Terceiro
                    </option>
                    <option value="other">
                      Outro
                    </option>
                  </select>
                </Field>

                <Field label="Instituição responsável/de origem (quando houver)">
                  <input
                    className={inputClass}
                    value={
                      organizationName
                    }
                    onChange={(event) =>
                      setOrganizationName(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Nome do órgão/instituição"
                  />
                </Field>

                <Field label="Sigla">
                  <input
                    className={inputClass}
                    value={
                      organizationAcronym
                    }
                    onChange={(event) =>
                      setOrganizationAcronym(
                        event.target
                          .value,
                      )
                    }
                  />
                </Field>

                <Field label="Cidade">
                  <input
                    className={inputClass}
                    value={
                      organizationCity
                    }
                    onChange={(event) =>
                      setOrganizationCity(
                        event.target
                          .value,
                      )
                    }
                  />
                </Field>

                <Field label="UF">
                  <input
                    className={inputClass}
                    maxLength={2}
                    value={
                      organizationState
                    }
                    onChange={(event) =>
                      setOrganizationState(
                        event.target
                          .value
                          .toUpperCase(),
                      )
                    }
                  />
                </Field>

                <Field label="Tipo da identificação externa/anterior">
                  <select
                    className={inputClass}
                    value={
                      externalIdentifierType
                    }
                    onChange={(event) =>
                      setExternalIdentifierType(
                        event.target
                          .value as ExternalIdentifierType,
                      )
                    }
                  >
                    <option value="patrimony">
                      Patrimônio de outro órgão
                    </option>
                    <option value="tombamento">
                      Tombamento de outro órgão
                    </option>
                    <option value="internal_serial">
                      Número interno anterior
                    </option>
                    <option value="contract">
                      Número de contrato
                    </option>
                    <option value="other">
                      Outra identificação
                    </option>
                  </select>
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Número externo / identificação anterior (opcional)">
                    <input
                      className={inputClass}
                      value={
                        externalIdentifierValue
                      }
                      onChange={(event) =>
                        setExternalIdentifierValue(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Ex.: patrimônio anterior, código de doação ou número de outro órgão"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <ReceiptText
                  size={15}
                  className="text-slate-500"
                />
                <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">
                  Nota fiscal
                </div>
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Número">
                  <input
                    className={inputClass}
                    value={
                      invoiceNumber
                    }
                    onChange={(event) =>
                      setInvoiceNumber(
                        event.target
                          .value,
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
                        event.target
                          .value,
                      )
                    }
                  />
                </Field>

                <Field label="Data de emissão">
                  <input
                    type="date"
                    className={inputClass}
                    value={
                      invoiceDate
                    }
                    onChange={(event) =>
                      setInvoiceDate(
                        event.target
                          .value,
                      )
                    }
                  />
                </Field>

                <Field label="Emitente">
                  <input
                    className={inputClass}
                    value={
                      invoiceIssuer
                    }
                    onChange={(event) =>
                      setInvoiceIssuer(
                        event.target
                          .value,
                      )
                    }
                  />
                </Field>

                <Field label="CNPJ/CPF emitente">
                  <input
                    className={inputClass}
                    value={
                      invoiceTaxId
                    }
                    onChange={(event) =>
                      setInvoiceTaxId(
                        event.target
                          .value,
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
                        event.target
                          .value,
                      )
                    }
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
                    setInvoiceFile(
                      event
                        .currentTarget
                        .files?.[0] ??
                        null,
                    )
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
