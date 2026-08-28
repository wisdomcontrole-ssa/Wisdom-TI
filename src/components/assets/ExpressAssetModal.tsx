import { Camera, PackagePlus } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { FormModal } from '../ui/FormModal'
import {
  listAssetTypes,
  listEnvironments,
  listUnits,
} from '../../data/asset-service'
import { createExpressAsset } from '../../data/field-ops-service'
import { uploadEvidence } from '../../data/evidence-service'
import { prepareEvidenceFile } from '../../lib/evidence-image'
import type {
  AssetTypeRecord,
  EnvironmentRecord,
  UnitRecord,
} from '../../types/assets'
import type { EntryOrigin } from '../../types/field-ops'

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

export function ExpressAssetModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (assetId: string, warning?: string) => void
}) {
  const [types, setTypes] = useState<AssetTypeRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])

  const [typeId, setTypeId] = useState('')
  const [serial, setSerial] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [origin, setOrigin] = useState<EntryOrigin>('purchase')
  const [unitId, setUnitId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let active = true

    async function bootstrap() {
      try {
        setLoading(true)
        setErrorMessage(null)

        const [typeRows, unitRows, environmentRows] =
          await Promise.all([
            listAssetTypes(),
            listUnits(),
            listEnvironments(),
          ])

        if (!active) return

        setTypes(typeRows)
        setUnits(unitRows.filter((item) => item.active))
        setEnvironments(
          environmentRows.filter((item) => item.active),
        )
        setTypeId(typeRows[0]?.id ?? '')
        setSerial('')
        setManufacturer('')
        setModel('')
        setOrigin('purchase')
        setUnitId('')
        setEnvironmentId('')
        setNotes('')
        setPhoto(null)
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
      environments.filter((item) => item.unit_id === unitId),
    [environments, unitId],
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!typeId) {
      setErrorMessage('Selecione o tipo do ativo.')
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

      let warning: string | undefined

      if (photo) {
        try {
          const prepared = await prepareEvidenceFile(photo)
          await uploadEvidence({
            context: { assetId: asset.id },
            file: prepared,
            categoryCode: 'registration',
            captureMethod: 'camera',
            caption: 'Foto do pré-cadastro Express',
          })
        } catch (error) {
          warning =
            error instanceof Error
              ? `Ativo criado, mas a foto não foi enviada: ${error.message}`
              : 'Ativo criado, mas a foto não foi enviada.'
        }
      }

      onCreated(asset.id, warning)
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
      description="Pré-cadastro rápido para recebimento em campo. O código patrimonial é definitivo e a ficha fica pendente para complementação."
      onClose={onClose}
      widthClassName="max-w-2xl"
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
            form="m12-express-form"
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
        id="m12-express-form"
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

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

        <Field label="Número de série">
          <input
            className={inputClass}
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
            autoCapitalize="characters"
            placeholder="Leitura rápida ou digitação"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fabricante">
            <input
              className={inputClass}
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Modelo">
            <input
              className={inputClass}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unidade inicial">
            <select
              className={inputClass}
              value={unitId}
              onChange={(event) => {
                setUnitId(event.target.value)
                setEnvironmentId('')
              }}
            >
              <option value="">Sem unidade definida</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
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
              onChange={(event) => setEnvironmentId(event.target.value)}
            >
              <option value="">Sem ambiente definido</option>
              {filteredEnvironments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Observação rápida">
          <textarea
            className={textareaClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: recebido na portaria, NF pendente, doação..."
          />
        </Field>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Foto do recebimento
          </span>
          <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
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
          {photo && (
            <div className="mt-2 truncate text-xs text-slate-500">
              {photo.name}
            </div>
          )}
        </label>
      </form>
    </FormModal>
  )
}
