import {
  ArrowLeft,
  Edit3,
  History,
  MapPin,
  Monitor,
  MoveRight,
  RefreshCw,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  Link,
  useParams,
} from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AssetAgentPanel } from '../components/agents/AssetAgentPanel'
import { InstalledComponentsCard } from '../components/assets/InstalledComponentsCard'
import { AssetQrLabelCard } from '../components/assets/AssetQrLabelCard'
import { EvidencePanel } from '../components/evidence/EvidencePanel'
import { AssetLifecyclePanel } from '../components/maintenance/AssetLifecyclePanel'
import { FormModal } from '../components/ui/FormModal'
import {
  getAssetById,
  listAssetMovements,
  listAssetTypes,
  listEnvironments,
  listUnits,
  moveAsset,
  updateAsset,
} from '../data/asset-service'
import type {
  AssetMovementRecord,
  AssetRecord,
  AssetStatus,
  AssetTypeRecord,
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const statusLabels: Record<AssetStatus, string> = {
  active: 'Ativo',
  stock: 'Estoque',
  maintenance: 'Manutenção',
  retired: 'Baixado',
  disposed: 'Descartado',
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value || '—'}
      </div>
    </div>
  )
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

export function AssetDetailPage() {
  const { assetId } = useParams()
  const { hasPermission } = useAuth()

  const [asset, setAsset] =
    useState<AssetRecord | null>(null)
  const [types, setTypes] =
    useState<AssetTypeRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [movements, setMovements] =
    useState<AssetMovementRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [editOpen, setEditOpen] =
    useState(false)
  const [moveOpen, setMoveOpen] =
    useState(false)

  async function fetchData(id: string) {
    const [
      assetRow,
      typeRows,
      unitRows,
      environmentRows,
      movementRows,
    ] = await Promise.all([
      getAssetById(id),
      listAssetTypes(),
      listUnits(),
      listEnvironments(),
      listAssetMovements(id),
    ])

    return {
      assetRow,
      typeRows,
      unitRows,
      environmentRows,
      movementRows,
    }
  }

  useEffect(() => {
    if (!assetId) {
      return
    }

    let active = true

    async function bootstrap(id: string) {
      try {
        const data = await fetchData(id)

        if (!active) {
          return
        }

        setAsset(data.assetRow)
        setTypes(data.typeRows)
        setUnits(data.unitRows)
        setEnvironments(data.environmentRows)
        setMovements(data.movementRows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o ativo.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrap(assetId)

    return () => {
      active = false
    }
  }, [assetId])

  async function refresh() {
    if (!assetId) {
      return
    }

    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await fetchData(assetId)

      setAsset(data.assetRow)
      setTypes(data.typeRows)
      setUnits(data.unitRows)
      setEnvironments(data.environmentRows)
      setMovements(data.movementRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o ativo.',
      )
    } finally {
      setLoading(false)
    }
  }

  const typeMap = useMemo(
    () =>
      new Map(
        types.map((type) => [type.id, type]),
      ),
    [types],
  )

  const unitMap = useMemo(
    () =>
      new Map(
        units.map((unit) => [unit.id, unit]),
      ),
    [units],
  )

  const environmentMap = useMemo(
    () =>
      new Map(
        environments.map((environment) => [
          environment.id,
          environment,
        ]),
      ),
    [environments],
  )

  if (loading && !asset) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <RefreshCw
          size={18}
          className="animate-spin text-slate-400"
        />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <Link
          to="/patrimonio"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={15} />
          Patrimônio
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {errorMessage ?? 'Ativo não encontrado.'}
        </div>
      </div>
    )
  }

  const type = typeMap.get(asset.asset_type_id)
  const unit = unitMap.get(
    asset.current_unit_id ?? '',
  )
  const environment = environmentMap.get(
    asset.current_environment_id ?? '',
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/patrimonio"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Patrimônio
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-sky-400">
              <Monitor size={19} />
            </div>

            <div>
              <div className="font-mono text-xs font-bold text-slate-400">
                {asset.asset_code}
              </div>
              <h1 className="mt-0.5 text-2xl font-bold tracking-[-0.035em] text-slate-950">
                {asset.manufacturer ||
                  type?.name ||
                  'Ativo'}{' '}
                {asset.model ?? ''}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
            aria-label="Atualizar"
          >
            <RefreshCw size={15} />
          </button>

          {hasPermission('assets.update') && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <Edit3 size={15} />
              Editar
            </button>
          )}

          {hasPermission('assets.move') &&
            asset.status !== 'retired' &&
            asset.status !== 'disposed' && (
            <button
              type="button"
              onClick={() => setMoveOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm"
            >
              <MoveRight size={15} />
              Movimentar
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem
              label="Tipo"
              value={type?.name ?? '—'}
            />
            <InfoItem
              label="Estado"
              value={statusLabels[asset.status]}
            />
            <InfoItem
              label="Número de série"
              value={asset.serial_number ?? '—'}
            />
            <InfoItem
              label="Hostname"
              value={asset.hostname ?? '—'}
            />
            <InfoItem
              label="Sistema operacional"
              value={asset.os_name ?? '—'}
            />
            <InfoItem
              label="Aquisição"
              value={
                asset.acquired_at
                  ? new Date(
                      `${asset.acquired_at}T00:00:00`,
                    ).toLocaleDateString('pt-BR')
                  : '—'
              }
            />
          </div>

          {asset.notes && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Observações
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {asset.notes}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
            <MapPin size={14} />
            Local atual
          </div>

          <div className="mt-4 text-lg font-bold text-slate-950">
            {environment?.name ??
              unit?.name ??
              'Sem local definido'}
          </div>

          {environment && unit && (
            <div className="mt-1 text-sm text-slate-500">
              {unit.name}
            </div>
          )}
        </section>
      </div>

      <AssetQrLabelCard
        asset={asset}
        typeName={type?.name ?? 'Ativo'}
      />

      <EvidencePanel
        context={{
          assetId: asset.id,
        }}
        canUpload={hasPermission('assets.update')}
        canManage={
          hasPermission('assets.update') ||
          hasPermission('assets.retire')
        }
        defaultCategory="registration"
        categoryOptions={[
          'registration',
          'movement',
          'maintenance',
          'disposal',
          'other',
        ]}
        title="Fotos e evidências"
        description="Cadastro, movimentação, manutenção e descarte vinculados ao patrimônio."
      />

      <AssetLifecyclePanel
        asset={asset}
        onChanged={() => void refresh()}
      />

      <AssetAgentPanel asset={asset} />

      <InstalledComponentsCard assetId={asset.id} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <History size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Histórico de localização
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Registro não destrutivo de movimentações
            </p>
          </div>
        </header>

        {movements.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400">
            Nenhuma movimentação registrada.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {movements.map((movement) => {
              const fromUnit = unitMap.get(
                movement.from_unit_id ?? '',
              )
              const fromEnvironment =
                environmentMap.get(
                  movement.from_environment_id ??
                    '',
                )
              const toUnit = unitMap.get(
                movement.to_unit_id ?? '',
              )
              const toEnvironment =
                environmentMap.get(
                  movement.to_environment_id ?? '',
                )

              return (
                <div
                  key={movement.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[150px_1fr]"
                >
                  <div className="text-[11px] font-semibold text-slate-400">
                    {new Date(
                      movement.moved_at,
                    ).toLocaleString('pt-BR')}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {fromEnvironment?.name ??
                        fromUnit?.name ??
                        'Sem local'}
                      <span className="px-2 text-slate-300">
                        →
                      </span>
                      {toEnvironment?.name ??
                        toUnit?.name ??
                        'Sem local'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {movement.reason}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <EditAssetModal
        open={editOpen}
        asset={asset}
        types={types}
        onClose={() => setEditOpen(false)}
        onSaved={() => void refresh()}
      />

      <MoveAssetModal
        open={moveOpen}
        asset={asset}
        units={units.filter((item) => item.active)}
        environments={environments.filter(
          (item) => item.active,
        )}
        onClose={() => setMoveOpen(false)}
        onSaved={() => void refresh()}
      />
    </div>
  )
}

function EditAssetModal({
  open,
  asset,
  types,
  onClose,
  onSaved,
}: {
  open: boolean
  asset: AssetRecord
  types: AssetTypeRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [typeId, setTypeId] = useState(
    asset.asset_type_id,
  )
  const [manufacturer, setManufacturer] =
    useState(asset.manufacturer ?? '')
  const [model, setModel] = useState(
    asset.model ?? '',
  )
  const [serial, setSerial] = useState(
    asset.serial_number ?? '',
  )
  const [hostname, setHostname] = useState(
    asset.hostname ?? '',
  )
  const [osName, setOsName] = useState(
    asset.os_name ?? '',
  )
  const [acquiredAt, setAcquiredAt] = useState(
    asset.acquired_at ?? '',
  )
  const [notes, setNotes] = useState(
    asset.notes ?? '',
  )

  useEffect(() => {
    if (!open) {
      return
    }

    queueMicrotask(() => {
      setTypeId(asset.asset_type_id)
      setManufacturer(asset.manufacturer ?? '')
      setModel(asset.model ?? '')
      setSerial(asset.serial_number ?? '')
      setHostname(asset.hostname ?? '')
      setOsName(asset.os_name ?? '')
      setAcquiredAt(asset.acquired_at ?? '')
      setNotes(asset.notes ?? '')
      setErrorMessage(null)
    })
  }, [asset, open])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await updateAsset(asset.id, {
        asset_type_id: typeId,
        manufacturer,
        model,
        serial_number: serial,
        hostname,
        os_name: osName,
        status: asset.status,
        acquired_at: acquiredAt,
        notes,
      })

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o ativo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Editar ativo"
      description={asset.asset_code}
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
            form="edit-asset-form"
            disabled={saving}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      }
    >
      <form
        id="edit-asset-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              className={inputClass}
              value={typeId}
              onChange={(event) =>
                setTypeId(event.target.value)
              }
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
                setModel(event.target.value)
              }
            />
          </Field>

          <Field label="Número de série">
            <input
              className={inputClass}
              value={serial}
              onChange={(event) =>
                setSerial(event.target.value)
              }
            />
          </Field>

          <Field label="Data de aquisição">
            <input
              className={inputClass}
              type="date"
              value={acquiredAt}
              onChange={(event) =>
                setAcquiredAt(event.target.value)
              }
            />
          </Field>

          <Field label="Hostname">
            <input
              className={inputClass}
              value={hostname}
              onChange={(event) =>
                setHostname(event.target.value)
              }
            />
          </Field>

          <Field label="Sistema operacional">
            <input
              className={inputClass}
              value={osName}
              onChange={(event) =>
                setOsName(event.target.value)
              }
            />
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
          />
        </Field>
      </form>
    </FormModal>
  )
}

function MoveAssetModal({
  open,
  asset,
  units,
  environments,
  onClose,
  onSaved,
}: {
  open: boolean
  asset: AssetRecord
  units: UnitRecord[]
  environments: EnvironmentRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [unitId, setUnitId] = useState('')
  const [environmentId, setEnvironmentId] =
    useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    queueMicrotask(() => {
      setUnitId(asset.current_unit_id ?? '')
      setEnvironmentId(
        asset.current_environment_id ?? '',
      )
      setReason('')
      setErrorMessage(null)
    })
  }, [asset, open])

  const filteredEnvironments = environments.filter(
    (environment) =>
      !unitId || environment.unit_id === unitId,
  )

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await moveAsset(
        asset.id,
        unitId || null,
        environmentId || null,
        reason,
      )

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível movimentar o ativo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Movimentar ativo"
      description={`${asset.asset_code} · a justificativa ficará no histórico.`}
      onClose={onClose}
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
            form="move-asset-form"
            disabled={saving || !reason.trim()}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Movimentando...'
              : 'Confirmar movimentação'}
          </button>
        </div>
      }
    >
      <form
        id="move-asset-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Unidade de destino">
          <select
            className={inputClass}
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value)
              setEnvironmentId('')
            }}
          >
            <option value="">Sem unidade</option>
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

        <Field label="Ambiente de destino">
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
            <option value="">Sem ambiente</option>
            {filteredEnvironments.map(
              (environment) => (
                <option
                  key={environment.id}
                  value={environment.id}
                >
                  {environment.name}
                </option>
              ),
            )}
          </select>
        </Field>

        <Field label="Justificativa">
          <textarea
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            required
          />
        </Field>
      </form>
    </FormModal>
  )
}