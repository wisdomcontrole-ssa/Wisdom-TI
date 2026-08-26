import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { FormModal } from '../ui/FormModal'
import { createMaintenanceOrder } from '../../data/maintenance-service'
import type { AssetRecord } from '../../types/assets'
import type {
  MaintenancePriority,
  MaintenanceType,
} from '../../types/maintenance'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

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

export function MaintenanceCreateModal({
  open,
  assets,
  currentUserId,
  initialAssetId = '',
  onClose,
  onCreated,
}: {
  open: boolean
  assets: AssetRecord[]
  currentUserId: string | null
  initialAssetId?: string
  onClose: () => void
  onCreated: (maintenanceId: string) => void
}) {
  const eligibleAssets = useMemo(
    () => assets.filter((asset) => asset.status !== 'disposed'),
    [assets],
  )

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [assetId, setAssetId] = useState('')
  const [maintenanceType, setMaintenanceType] =
    useState<MaintenanceType>('corrective')
  const [priority, setPriority] =
    useState<MaintenancePriority>('normal')
  const [symptom, setSymptom] = useState('')
  const [externalService, setExternalService] =
    useState(false)
  const [providerName, setProviderName] = useState('')
  const [providerReference, setProviderReference] =
    useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    queueMicrotask(() => {
      const preferred =
        initialAssetId &&
        eligibleAssets.some((asset) => asset.id === initialAssetId)
          ? initialAssetId
          : (eligibleAssets[0]?.id ?? '')

      setAssetId(preferred)
      setMaintenanceType('corrective')
      setPriority('normal')
      setSymptom('')
      setExternalService(false)
      setProviderName('')
      setProviderReference('')
      setNotes('')
      setErrorMessage(null)
    })
  }, [eligibleAssets, initialAssetId, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!assetId) {
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      const result = await createMaintenanceOrder({
        assetId,
        maintenanceType,
        priority,
        symptom,
        assignedTo: currentUserId,
        externalService,
        providerName,
        providerReference,
        notes,
      })

      onCreated(result.maintenance_id)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir a manutenção.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Nova manutenção"
      description="A abertura altera o ativo para Manutenção e inicia a trilha de ciclo de vida."
      onClose={onClose}
      widthClassName="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="maintenance-create-form"
            disabled={saving || !assetId || !symptom.trim()}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Abrindo...' : 'Abrir manutenção'}
          </button>
        </div>
      }
    >
      <form
        id="maintenance-create-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Ativo">
          <select
            className={inputClass}
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            required
          >
            {eligibleAssets.length === 0 && (
              <option value="">Nenhum ativo disponível</option>
            )}
            {eligibleAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.asset_code} ·{' '}
                {[asset.manufacturer, asset.model]
                  .filter(Boolean)
                  .join(' ') || 'Sem descrição'}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              className={inputClass}
              value={maintenanceType}
              onChange={(event) =>
                setMaintenanceType(
                  event.target.value as MaintenanceType,
                )
              }
            >
              <option value="corrective">Corretiva</option>
              <option value="preventive">Preventiva</option>
              <option value="inspection">Inspeção</option>
              <option value="upgrade">Upgrade</option>
            </select>
          </Field>

          <Field label="Prioridade">
            <select
              className={inputClass}
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as MaintenancePriority,
                )
              }
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </Field>
        </div>

        <Field label="Defeito, sintoma ou objetivo">
          <textarea
            value={symptom}
            onChange={(event) => setSymptom(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Descreva objetivamente o motivo da manutenção."
            required
          />
        </Field>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={externalService}
            onChange={(event) =>
              setExternalService(event.target.checked)
            }
            className="size-4 rounded border-slate-300"
          />
          Atendimento por fornecedor externo
        </label>

        {externalService && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fornecedor / assistência">
              <input
                className={inputClass}
                value={providerName}
                onChange={(event) =>
                  setProviderName(event.target.value)
                }
              />
            </Field>

            <Field label="Ordem / protocolo externo">
              <input
                className={inputClass}
                value={providerReference}
                onChange={(event) =>
                  setProviderReference(event.target.value)
                }
              />
            </Field>
          </div>
        )}

        <Field label="Observações iniciais">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </Field>
      </form>
    </FormModal>
  )
}