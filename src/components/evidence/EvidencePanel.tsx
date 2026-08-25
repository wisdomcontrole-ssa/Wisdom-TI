import {
  Camera,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  Images,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { FormModal } from '../ui/FormModal'
import {
  fetchEvidenceBlob,
  getDriveUrl,
  listEvidence,
  revokeEvidence,
  uploadEvidence,
} from '../../data/evidence-service'
import { prepareEvidenceFile } from '../../lib/evidence-image'
import type {
  EvidenceCaptureMethod,
  EvidenceCategoryCode,
  EvidenceContext,
  EvidenceRecord,
} from '../../types/evidence'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const categoryLabels: Record<
  EvidenceCategoryCode,
  string
> = {
  registration: 'Cadastro',
  audit: 'Auditoria',
  movement: 'Movimentação',
  maintenance: 'Manutenção',
  disposal: 'Descarte',
  stock: 'Estoque',
  other: 'Outros',
}

const allCategories =
  Object.keys(
    categoryLabels,
  ) as EvidenceCategoryCode[]

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`
}

function localDateTimeValue() {
  const now = new Date()
  const offset =
    now.getTimezoneOffset() * 60_000

  return new Date(
    now.getTime() - offset,
  )
    .toISOString()
    .slice(0, 16)
}

function evidenceDate(
  evidence: EvidenceRecord,
) {
  return new Date(
    evidence.captured_at ??
      evidence.created_at,
  ).toLocaleString('pt-BR')
}

function isImage(
  evidence: EvidenceRecord,
) {
  return evidence.mime_type.startsWith(
    'image/',
  )
}

export function EvidencePanel({
  context,
  canUpload,
  canManage = canUpload,
  title = 'Fotos e evidências',
  description = 'Arquivos rastreáveis armazenados no Google Drive.',
  defaultCategory = 'other',
  categoryOptions = allCategories,
  compact = false,
}: {
  context: EvidenceContext
  canUpload: boolean
  canManage?: boolean
  title?: string
  description?: string
  defaultCategory?: EvidenceCategoryCode
  categoryOptions?: EvidenceCategoryCode[]
  compact?: boolean
}) {
  const {
    assetId = null,
    auditId = null,
    auditItemId = null,
    stockUnitId = null,
  } = context

  const [items, setItems] =
    useState<EvidenceRecord[]>([])
  const [loading, setLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null)
  const [uploadOpen, setUploadOpen] =
    useState(false)
  const [previewTarget, setPreviewTarget] =
    useState<EvidenceRecord | null>(null)
  const [revokeTarget, setRevokeTarget] =
    useState<EvidenceRecord | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const rows = await listEvidence({
          assetId,
          auditId,
          auditItemId,
          stockUnitId,
        })

        if (!active) {
          return
        }

        setItems(rows)
        setErrorMessage(null)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as evidências.',
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
  }, [
    assetId,
    auditId,
    auditItemId,
    stockUnitId,
  ])

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const rows = await listEvidence({
        assetId,
        auditId,
        auditItemId,
        stockUnitId,
      })

      setItems(rows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar as evidências.',
      )
    } finally {
      setLoading(false)
    }
  }

  const activeCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'active',
      ).length,
    [items],
  )

  const bodyPadding = compact
    ? 'p-3 sm:p-4'
    : 'p-4 sm:p-5'

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <Images size={16} />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-950">
              {title}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
            {activeCount} ativas
          </span>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
            aria-label="Atualizar evidências"
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? 'animate-spin'
                  : undefined
              }
            />
          </button>

          {canUpload && (
            <button
              type="button"
              onClick={() =>
                setUploadOpen(true)
              }
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white"
            >
              <Upload size={14} />
              Adicionar
            </button>
          )}
        </div>
      </header>

      <div className={bodyPadding}>
        {errorMessage && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
            {successMessage}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="grid min-h-32 place-items-center text-slate-400">
            <RefreshCw
              size={17}
              className="animate-spin"
            />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <Images
              size={22}
              className="mx-auto text-slate-300"
            />
            <div className="mt-3 text-sm font-semibold text-slate-600">
              Nenhuma evidência registrada
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              Fotos e documentos enviados aparecerão aqui.
            </div>
          </div>
        ) : (
          <div
            className={
              compact
                ? 'space-y-2'
                : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
            }
          >
            {items.map((item) => (
              <EvidenceCard
                key={item.id}
                evidence={item}
                compact={compact}
                canManage={
                  canManage &&
                  item.status === 'active'
                }
                onPreview={() =>
                  setPreviewTarget(item)
                }
                onRevoke={() =>
                  setRevokeTarget(item)
                }
              />
            ))}
          </div>
        )}
      </div>

      <EvidenceUploadModal
        open={uploadOpen}
        context={{
          assetId,
          auditId,
          auditItemId,
          stockUnitId,
        }}
        defaultCategory={defaultCategory}
        categoryOptions={categoryOptions}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false)
          setSuccessMessage(
            'Evidência enviada e registrada com sucesso.',
          )
          void refresh()
        }}
      />

      {previewTarget && (
        <EvidencePreviewModal
          key={previewTarget.id}
          evidence={previewTarget}
          onClose={() =>
            setPreviewTarget(null)
          }
        />
      )}

      <EvidenceRevokeModal
        evidence={revokeTarget}
        onClose={() =>
          setRevokeTarget(null)
        }
        onRevoked={() => {
          setRevokeTarget(null)
          setSuccessMessage(
            'Evidência revogada. O histórico foi preservado.',
          )
          void refresh()
        }}
      />
    </section>
  )
}

function EvidenceCard({
  evidence,
  compact,
  canManage,
  onPreview,
  onRevoke,
}: {
  evidence: EvidenceRecord
  compact: boolean
  canManage: boolean
  onPreview: () => void
  onRevoke: () => void
}) {
  const driveUrl = getDriveUrl(evidence)
  const image = isImage(evidence)

  const cardClass =
    evidence.status === 'revoked'
      ? 'border-slate-200 bg-slate-50 opacity-70'
      : 'border-slate-200 bg-white'

  return (
    <article
      className={`rounded-2xl border ${cardClass} ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            image
              ? 'bg-sky-50 text-sky-600'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {image ? (
            <FileImage size={17} />
          ) : (
            <FileText size={17} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-slate-500">
              {categoryLabels[
                evidence.category_code
              ] ?? evidence.category_code}
            </span>

            {evidence.status ===
              'revoked' && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-red-700">
                revogada
              </span>
            )}
          </div>

          <div className="mt-2 truncate text-xs font-bold text-slate-800">
            {evidence.original_name}
          </div>

          <div className="mt-1 text-[10px] text-slate-400">
            {evidenceDate(evidence)} ·{' '}
            {formatBytes(
              evidence.byte_size,
            )}
          </div>
        </div>
      </div>

      {evidence.caption && (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">
          {evidence.caption}
        </p>
      )}

      {evidence.status === 'revoked' &&
        evidence.revoke_reason && (
          <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-[10px] leading-4 text-red-700">
            Revogação: {evidence.revoke_reason}
          </div>
        )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600"
        >
          <Eye size={13} />
          Visualizar
        </button>

        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600"
          >
            <ExternalLink size={13} />
            Drive
          </a>
        )}

        {canManage && (
          <button
            type="button"
            onClick={onRevoke}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-[10px] font-bold text-red-700"
          >
            <Trash2 size={13} />
            Revogar
          </button>
        )}
      </div>
    </article>
  )
}

function EvidenceUploadModal({
  open,
  context,
  defaultCategory,
  categoryOptions,
  onClose,
  onUploaded,
}: {
  open: boolean
  context: EvidenceContext
  defaultCategory: EvidenceCategoryCode
  categoryOptions: EvidenceCategoryCode[]
  onClose: () => void
  onUploaded: () => void
}) {
  const [category, setCategory] =
    useState<EvidenceCategoryCode>(
      defaultCategory,
    )
  const [selected, setSelected] =
    useState<{
      file: File
      method: EvidenceCaptureMethod
    } | null>(null)
  const [caption, setCaption] =
    useState('')
  const [capturedAt, setCapturedAt] =
    useState(localDateTimeValue)
  const [saving, setSaving] =
    useState(false)
  const [preparing, setPreparing] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    queueMicrotask(() => {
      setCategory(defaultCategory)
      setSelected(null)
      setCaption('')
      setCapturedAt(
        localDateTimeValue(),
      )
      setErrorMessage(null)
      setSaving(false)
      setPreparing(false)
    })
  }, [defaultCategory, open])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!selected) {
      setErrorMessage(
        'Selecione uma foto ou documento.',
      )
      return
    }

    try {
      setPreparing(true)
      setSaving(true)
      setErrorMessage(null)

      const file =
        await prepareEvidenceFile(
          selected.file,
        )

      setPreparing(false)

      await uploadEvidence({
        context,
        file,
        categoryCode: category,
        captureMethod: selected.method,
        caption,
        capturedAt:
          capturedAt || undefined,
      })

      onUploaded()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a evidência.',
      )
    } finally {
      setPreparing(false)
      setSaving(false)
    }
  }

  function choose(
    file: File | undefined,
    method: EvidenceCaptureMethod,
  ) {
    if (!file) {
      return
    }

    setSelected({
      file,
      method,
    })
    setErrorMessage(null)
  }

  return (
    <FormModal
      open={open}
      title="Adicionar evidência"
      description="Fotos são otimizadas no navegador antes do envio. Limite final: 5 MB."
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="evidence-upload-form"
            disabled={
              saving || !selected
            }
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {preparing
              ? 'Otimizando...'
              : saving
                ? 'Enviando...'
                : 'Enviar evidência'}
          </button>
        </div>
      }
    >
      <form
        id="evidence-upload-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white">
            <Camera size={15} />
            Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={saving}
              onChange={(event) => {
                choose(
                  event.target.files?.[0],
                  'camera',
                )
                event.currentTarget.value = ''
              }}
            />
          </label>

          <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
            <FileImage size={15} />
            Galeria
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={saving}
              onChange={(event) => {
                choose(
                  event.target.files?.[0],
                  'gallery',
                )
                event.currentTarget.value = ''
              }}
            />
          </label>

          <label className="col-span-2 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 sm:col-span-1">
            <FileText size={15} />
            Arquivo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              className="sr-only"
              disabled={saving}
              onChange={(event) => {
                choose(
                  event.target.files?.[0],
                  'file',
                )
                event.currentTarget.value = ''
              }}
            />
          </label>
        </div>

        {selected && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Arquivo selecionado
            </div>
            <div className="mt-1 truncate text-xs font-bold text-slate-800">
              {selected.file.name}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              {formatBytes(
                selected.file.size,
              )}{' '}
              · {selected.file.type ||
                'tipo não informado'}
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Categoria
          </span>
          <select
            className={inputClass}
            value={category}
            disabled={saving}
            onChange={(event) =>
              setCategory(
                event.target
                  .value as EvidenceCategoryCode,
              )
            }
          >
            {categoryOptions.map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {categoryLabels[value]}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Data/hora da captura
          </span>
          <input
            type="datetime-local"
            className={inputClass}
            value={capturedAt}
            disabled={saving}
            onChange={(event) =>
              setCapturedAt(
                event.target.value,
              )
            }
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Descrição
          </span>
          <textarea
            value={caption}
            disabled={saving}
            onChange={(event) =>
              setCaption(
                event.target.value,
              )
            }
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50"
            placeholder="Ex.: etiqueta patrimonial, estado físico, divergência encontrada..."
          />
        </label>
      </form>
    </FormModal>
  )
}

function EvidencePreviewModal({
  evidence,
  onClose,
}: {
  evidence: EvidenceRecord
  onClose: () => void
}) {
  const [objectUrl, setObjectUrl] =
    useState<string | null>(null)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true
    let url: string | null = null

    async function load() {
      try {
        const blob =
          await fetchEvidenceBlob(
            evidence.id,
          )

        if (!active) {
          return
        }

        url = URL.createObjectURL(blob)
        setObjectUrl(url)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível abrir a evidência.',
        )
      }
    }

    void load()

    return () => {
      active = false

      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [evidence.id])

  const image = isImage(evidence)
  const pdf =
    evidence.mime_type ===
    'application/pdf'

  return (
    <FormModal
      open
      title="Visualizar evidência"
      description={`${evidence.original_name} · ${evidenceDate(
        evidence,
      )}`}
      onClose={onClose}
      widthClassName="max-w-5xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {getDriveUrl(evidence) && (
            <a
              href={
                getDriveUrl(evidence) ??
                undefined
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              <ExternalLink size={14} />
              Abrir no Drive
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
          >
            Fechar
          </button>
        </div>
      }
    >
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : !objectUrl ? (
        <div className="grid min-h-[45vh] place-items-center text-slate-400">
          <RefreshCw
            size={20}
            className="animate-spin"
          />
        </div>
      ) : image ? (
        <div className="grid min-h-[45vh] place-items-center rounded-2xl bg-slate-100 p-3">
          <img
            src={objectUrl}
            alt={
              evidence.caption ??
              evidence.original_name
            }
            className="max-h-[68vh] max-w-full rounded-xl object-contain"
          />
        </div>
      ) : pdf ? (
        <iframe
          src={objectUrl}
          title={evidence.original_name}
          className="h-[68vh] w-full rounded-2xl border border-slate-200"
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          Este tipo de arquivo não possui preview interno.
        </div>
      )}

      {evidence.caption && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          {evidence.caption}
        </div>
      )}
    </FormModal>
  )
}

function EvidenceRevokeModal({
  evidence,
  onClose,
  onRevoked,
}: {
  evidence: EvidenceRecord | null
  onClose: () => void
  onRevoked: () => void
}) {
  const [reason, setReason] =
    useState('')
  const [saving, setSaving] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!evidence) {
      return
    }

    queueMicrotask(() => {
      setReason('')
      setErrorMessage(null)
      setSaving(false)
    })
  }, [evidence])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!evidence) {
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      await revokeEvidence(
        evidence.id,
        reason,
      )

      onRevoked()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível revogar a evidência.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={Boolean(evidence)}
      title="Revogar evidência"
      description="O registro e o arquivo são preservados para rastreabilidade. A justificativa fica vinculada ao histórico."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="evidence-revoke-form"
            disabled={
              saving || !reason.trim()
            }
            className="h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving
              ? 'Revogando...'
              : 'Confirmar revogação'}
          </button>
        </div>
      }
    >
      <form
        id="evidence-revoke-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {evidence && (
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="truncate text-xs font-bold text-slate-800">
              {evidence.original_name}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              {categoryLabels[
                evidence.category_code
              ]}{' '}
              · {evidenceDate(evidence)}
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Justificativa
          </span>
          <textarea
            value={reason}
            disabled={saving}
            onChange={(event) =>
              setReason(
                event.target.value,
              )
            }
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50"
            required
          />
        </label>
      </form>
    </FormModal>
  )
}
