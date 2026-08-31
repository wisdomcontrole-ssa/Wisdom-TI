import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Edit3,
  FileText,
  Fingerprint,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { useAuth } from '../../auth/useAuth'
import {
  addAssetExternalIdentifier,
  addPurchaseDocumentToAsset,
  ensureExternalOrganization,
  getAssetSmartProfile,
  retireAssetExternalIdentifier,
  setAssetSmartCore,
} from '../../data/asset-smart-service'
import {
  uploadEvidence,
} from '../../data/evidence-service'
import {
  prepareEvidenceFile,
} from '../../lib/evidence-image'
import type {
  AssetExternalIdentifier,
  AssetSmartProfile,
  ExternalIdentifierType,
  OwnershipType,
} from '../../types/asset-smart'
import { FormModal } from '../ui/FormModal'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

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
  patrimony: 'Patrimônio',
  tombamento: 'Tombamento',
  internal_serial: 'Serial interno',
  contract: 'Contrato',
  other: 'Outro',
}

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

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-bold text-slate-800">
        {value}
      </div>
    </div>
  )
}

export function AssetSmartMetadataCard({
  assetId,
}: {
  assetId: string
}) {
  const { hasPermission } = useAuth()
  const canUpdate =
    hasPermission('assets.update')

  const [profile, setProfile] =
    useState<AssetSmartProfile | null>(
      null,
    )
  const [loading, setLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [editOpen, setEditOpen] =
    useState(false)
  const [
    identifierOpen,
    setIdentifierOpen,
  ] = useState(false)
  const [
    documentOpen,
    setDocumentOpen,
  ] = useState(false)
  const [
    retireTarget,
    setRetireTarget,
  ] =
    useState<AssetExternalIdentifier | null>(
      null,
    )

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data =
          await getAssetSmartProfile(
            assetId,
          )

        if (!active) return
        setProfile(data)
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os dados complementares.',
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
  }, [assetId])

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const data =
        await getAssetSmartProfile(
          assetId,
        )

      setProfile(data)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar os dados.',
      )
    } finally {
      setLoading(false)
    }
  }

  const ownerOrganization =
    profile?.organizations.find(
      (item) =>
        item.id ===
        profile.core
          .owner_organization_id,
    )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Fingerprint size={15} />
            Identificação, aquisição e custódia
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Serial, garantia, nota fiscal e patrimônio de instituições externas.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void refresh()
            }
            className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />
          </button>

          {canUpdate && profile && (
            <button
              type="button"
              onClick={() =>
                setEditOpen(true)
              }
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white"
            >
              <Edit3 size={14} />
              Editar
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {!profile ? (
        <div className="grid min-h-28 place-items-center">
          <RefreshCw
            size={16}
            className="animate-spin text-slate-400"
          />
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info
              icon={<Fingerprint size={14} />}
              label="Serial"
              value={
                profile.core
                  .serial_number ||
                'Não informado'
              }
            />
            <Info
              icon={<BadgeCheck size={14} />}
              label="Service Tag"
              value={
                profile.core
                  .service_tag ||
                'Não informado'
              }
            />
            <Info
              icon={<FileText size={14} />}
              label="Product / Part No."
              value={
                profile.core
                  .product_number ||
                'Não informado'
              }
            />
            <Info
              icon={
                <CalendarClock size={14} />
              }
              label="Garantia até"
              value={
                profile.core
                  .warranty_expires_at ||
                'Não informada'
              }
            />
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-slate-400">
              <Building2 size={14} />
              Posse / custódia
            </div>
            <div className="mt-2 text-sm font-bold text-slate-900">
              {
                ownershipLabels[
                  profile.core
                    .ownership_type
                ]
              }
            </div>
            {ownerOrganization && (
              <div className="mt-1 text-sm text-slate-600">
                {ownerOrganization.name}
                {ownerOrganization.acronym
                  ? ` · ${ownerOrganization.acronym}`
                  : ''}
              </div>
            )}
            {profile.core
              .electrical_rating && (
              <div className="mt-2 text-xs text-slate-500">
                Alimentação:{' '}
                {
                  profile.core
                    .electrical_rating
                }
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">
                Identificadores externos
              </div>
              {canUpdate && (
                <button
                  type="button"
                  onClick={() =>
                    setIdentifierOpen(
                      true,
                    )
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-700"
                >
                  <Plus size={12} />
                  Adicionar
                </button>
              )}
            </div>

            {profile.identifiers
              .length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">
                Nenhum patrimônio de outra instituição vinculado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {profile.identifiers.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-black text-slate-950">
                          {
                            item.identifier_value
                          }
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {
                            identifierLabels[
                              item.identifier_type
                            ]
                          }{' '}
                          ·{' '}
                          {item.organization
                            ?.name ??
                            'Instituição'}
                        </div>
                      </div>

                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() =>
                            setRetireTarget(
                              item,
                            )
                          }
                          className="grid size-8 place-items-center rounded-lg border border-red-200 text-red-600"
                        >
                          <Trash2
                            size={12}
                          />
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">
                Documentos de aquisição
              </div>
              {canUpdate && (
                <button
                  type="button"
                  onClick={() =>
                    setDocumentOpen(true)
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-700"
                >
                  <Plus size={12} />
                  Adicionar
                </button>
              )}
            </div>

            {profile.purchaseDocuments
              .length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">
                Nenhuma nota fiscal ou documento vinculado.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {profile.purchaseDocuments.map(
                  (document) => (
                    <div
                      key={document.id}
                      className="p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-950">
                          {
                            document.number
                          }
                        </span>
                        {document.series && (
                          <span className="text-xs text-slate-500">
                            Série{' '}
                            {
                              document.series
                            }
                          </span>
                        )}
                        {document.evidence_id && (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">
                            Arquivo anexado
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {document.issuer_name ??
                          'Emitente não informado'}
                        {document.issue_date
                          ? ` · ${document.issue_date}`
                          : ''}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {editOpen && profile && (
        <CoreEditModal
          profile={profile}
          onClose={() =>
            setEditOpen(false)
          }
          onDone={() => {
            setEditOpen(false)
            void refresh()
          }}
        />
      )}

      {identifierOpen &&
        profile && (
          <IdentifierModal
            assetId={assetId}
            organizations={
              profile.organizations
            }
            onClose={() =>
              setIdentifierOpen(false)
            }
            onDone={() => {
              setIdentifierOpen(false)
              void refresh()
            }}
          />
        )}

      {documentOpen && (
        <DocumentModal
          assetId={assetId}
          onClose={() =>
            setDocumentOpen(false)
          }
          onDone={() => {
            setDocumentOpen(false)
            void refresh()
          }}
        />
      )}

      {retireTarget && (
        <RetireIdentifierModal
          target={retireTarget}
          onClose={() =>
            setRetireTarget(null)
          }
          onDone={() => {
            setRetireTarget(null)
            void refresh()
          }}
        />
      )}
    </section>
  )
}

function CoreEditModal({
  profile,
  onClose,
  onDone,
}: {
  profile: AssetSmartProfile
  onClose: () => void
  onDone: () => void
}) {
  const [productNumber, setProductNumber] =
    useState(
      profile.core.product_number ?? '',
    )
  const [serviceTag, setServiceTag] =
    useState(
      profile.core.service_tag ?? '',
    )
  const [
    electricalRating,
    setElectricalRating,
  ] = useState(
    profile.core.electrical_rating ??
      '',
  )
  const [acquiredAt, setAcquiredAt] =
    useState(
      profile.core.acquired_at ?? '',
    )
  const [
    warrantyExpiresAt,
    setWarrantyExpiresAt,
  ] = useState(
    profile.core
      .warranty_expires_at ?? '',
  )
  const [ownershipType, setOwnershipType] =
    useState<OwnershipType>(
      profile.core.ownership_type,
    )
  const [
    ownerOrganizationId,
    setOwnerOrganizationId,
  ] = useState(
    profile.core
      .owner_organization_id ?? '',
  )
  const [saving, setSaving] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await setAssetSmartCore({
        assetId: profile.core.id,
        productNumber,
        serviceTag,
        electricalRating,
        acquiredAt,
        warrantyExpiresAt,
        ownershipType,
        ownerOrganizationId:
          ownerOrganizationId || null,
      })

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title="Identificação e custódia"
      onClose={onClose}
      widthClassName="max-w-2xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="m13-core-edit"
            disabled={saving}
            className="h-10 flex-1 rounded-xl bg-slate-950 font-bold text-white disabled:opacity-40"
          >
            {saving
              ? 'Salvando...'
              : 'Salvar'}
          </button>
        </div>
      }
    >
      <form
        id="m13-core-edit"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) =>
          void submit(event)
        }
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">
            {errorMessage}
          </div>
        )}

        <Field label="Service Tag">
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

        <Field label="Posse">
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

        {ownershipType !== 'own' && (
          <div className="sm:col-span-2">
            <Field label="Instituição proprietária/responsável">
              <select
                className={inputClass}
                value={
                  ownerOrganizationId
                }
                onChange={(event) =>
                  setOwnerOrganizationId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Selecione
                </option>
                {profile.organizations.map(
                  (organization) => (
                    <option
                      key={
                        organization.id
                      }
                      value={
                        organization.id
                      }
                    >
                      {
                        organization.name
                      }
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
        )}
      </form>
    </FormModal>
  )
}

function IdentifierModal({
  assetId,
  organizations,
  onClose,
  onDone,
}: {
  assetId: string
  organizations:
    AssetSmartProfile['organizations']
  onClose: () => void
  onDone: () => void
}) {
  const [
    organizationId,
    setOrganizationId,
  ] = useState('')
  const [
    newOrganizationName,
    setNewOrganizationName,
  ] = useState('')
  const [
    newAcronym,
    setNewAcronym,
  ] = useState('')
  const [
    identifierType,
    setIdentifierType,
  ] =
    useState<ExternalIdentifierType>(
      'patrimony',
    )
  const [
    identifierValue,
    setIdentifierValue,
  ] = useState('')
  const [saving, setSaving] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      let resolvedOrganizationId =
        organizationId

      if (!resolvedOrganizationId) {
        if (!newOrganizationName.trim()) {
          throw new Error(
            'Selecione ou informe a instituição.',
          )
        }

        resolvedOrganizationId =
          await ensureExternalOrganization({
            name: newOrganizationName,
            acronym: newAcronym,
          })
      }

      await addAssetExternalIdentifier({
        assetId,
        organizationId:
          resolvedOrganizationId,
        identifierType,
        identifierValue,
      })

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível adicionar o identificador.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title="Adicionar identificador externo"
      description="Patrimônio, tombamento ou código utilizado por outra instituição."
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="m13-identifier"
            disabled={
              saving ||
              !identifierValue.trim()
            }
            className="h-10 flex-1 rounded-xl bg-slate-950 font-bold text-white disabled:opacity-40"
          >
            {saving
              ? 'Salvando...'
              : 'Adicionar'}
          </button>
        </div>
      }
    >
      <form
        id="m13-identifier"
        className="space-y-4"
        onSubmit={(event) =>
          void submit(event)
        }
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Instituição já cadastrada">
          <select
            className={inputClass}
            value={organizationId}
            onChange={(event) =>
              setOrganizationId(
                event.target.value,
              )
            }
          >
            <option value="">
              Cadastrar nova abaixo
            </option>
            {organizations.map(
              (organization) => (
                <option
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </option>
              ),
            )}
          </select>
        </Field>

        {!organizationId && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nova instituição">
              <input
                className={inputClass}
                value={
                  newOrganizationName
                }
                onChange={(event) =>
                  setNewOrganizationName(
                    event.target.value,
                  )
                }
              />
            </Field>
            <Field label="Sigla">
              <input
                className={inputClass}
                value={newAcronym}
                onChange={(event) =>
                  setNewAcronym(
                    event.target.value,
                  )
                }
              />
            </Field>
          </div>
        )}

        <Field label="Tipo">
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

        <Field label="Código">
          <input
            className={inputClass}
            value={identifierValue}
            onChange={(event) =>
              setIdentifierValue(
                event.target.value,
              )
            }
            required
          />
        </Field>
      </form>
    </FormModal>
  )
}

function DocumentModal({
  assetId,
  onClose,
  onDone,
}: {
  assetId: string
  onClose: () => void
  onDone: () => void
}) {
  const [number, setNumber] =
    useState('')
  const [series, setSeries] =
    useState('')
  const [accessKey, setAccessKey] =
    useState('')
  const [issuerName, setIssuerName] =
    useState('')
  const [issuerTaxId, setIssuerTaxId] =
    useState('')
  const [issueDate, setIssueDate] =
    useState('')
  const [file, setFile] =
    useState<File | null>(null)
  const [saving, setSaving] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      let evidenceId:
        | string
        | null = null

      if (file) {
        const prepared =
          await prepareEvidenceFile(file)

        const evidence =
          await uploadEvidence({
            context: { assetId },
            file: prepared,
            categoryCode: 'other',
            captureMethod: 'file',
            caption:
              `Documento fiscal ${number.trim()}`,
          })

        evidenceId = evidence.id
      }

      await addPurchaseDocumentToAsset({
        assetId,
        documentType: 'invoice',
        number,
        series,
        accessKey,
        issuerName,
        issuerTaxId,
        issueDate,
        evidenceId,
      })

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível vincular o documento.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title="Adicionar nota fiscal"
      onClose={onClose}
      widthClassName="max-w-2xl"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="m13-document"
            disabled={
              saving || !number.trim()
            }
            className="h-10 flex-1 rounded-xl bg-slate-950 font-bold text-white disabled:opacity-40"
          >
            {saving
              ? 'Salvando...'
              : 'Adicionar'}
          </button>
        </div>
      }
    >
      <form
        id="m13-document"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) =>
          void submit(event)
        }
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">
            {errorMessage}
          </div>
        )}

        <Field label="Número">
          <input
            className={inputClass}
            value={number}
            onChange={(event) =>
              setNumber(event.target.value)
            }
            required
          />
        </Field>

        <Field label="Série">
          <input
            className={inputClass}
            value={series}
            onChange={(event) =>
              setSeries(event.target.value)
            }
          />
        </Field>

        <Field label="Data">
          <input
            type="date"
            className={inputClass}
            value={issueDate}
            onChange={(event) =>
              setIssueDate(
                event.target.value,
              )
            }
          />
        </Field>

        <Field label="Emitente">
          <input
            className={inputClass}
            value={issuerName}
            onChange={(event) =>
              setIssuerName(
                event.target.value,
              )
            }
          />
        </Field>

        <Field label="CNPJ/CPF">
          <input
            className={inputClass}
            value={issuerTaxId}
            onChange={(event) =>
              setIssuerTaxId(
                event.target.value,
              )
            }
          />
        </Field>

        <Field label="Chave NF-e">
          <input
            className={inputClass}
            value={accessKey}
            onChange={(event) =>
              setAccessKey(
                event.target.value,
              )
            }
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Foto/PDF">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="block w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
              onChange={(event) =>
                setFile(
                  event.currentTarget
                    .files?.[0] ??
                    null,
                )
              }
            />
          </Field>
        </div>
      </form>
    </FormModal>
  )
}

function RetireIdentifierModal({
  target,
  onClose,
  onDone,
}: {
  target: AssetExternalIdentifier
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] =
    useState('')
  const [saving, setSaving] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await retireAssetExternalIdentifier(
        target.id,
        reason,
      )

      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível retirar o identificador.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title="Retirar identificador externo"
      description={
        target.identifier_value
      }
      onClose={onClose}
      widthClassName="max-w-lg"
      footer={
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="m13-retire-identifier"
            disabled={
              saving || !reason.trim()
            }
            className="h-10 flex-1 rounded-xl bg-red-700 font-bold text-white disabled:opacity-40"
          >
            {saving
              ? 'Salvando...'
              : 'Confirmar'}
          </button>
        </div>
      }
    >
      <form
        id="m13-retire-identifier"
        onSubmit={(event) =>
          void submit(event)
        }
      >
        {errorMessage && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Justificativa">
          <textarea
            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            required
          />
        </Field>
      </form>
    </FormModal>
  )
}
