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
  type ReactNode,
} from 'react'
import {
  Link,
  useParams,
} from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AssetAgentPanel } from '../components/agents/AssetAgentPanel'
import { AssetBindingsCard } from '../components/assets/AssetBindingsCard'
import {
  AssetEditModal,
  cleanAssetNotes,
} from '../components/assets/AssetEditModal'
import { AssetQrLabelCard } from '../components/assets/AssetQrLabelCard'
import { AssetSmartMetadataCard } from '../components/assets/AssetSmartMetadataCard'
import { AssetTechnicalOverviewCard } from '../components/assets/AssetTechnicalOverviewCard'
import { EvidencePanel } from '../components/evidence/EvidencePanel'
import { AssetLifecyclePanel } from '../components/maintenance/AssetLifecyclePanel'
import { FormModal } from '../components/ui/FormModal'
import {
  getLatestAssetSnapshot,
} from '../data/agent-service'
import {
  getAssetById,
  listAssetMovements,
  listAssetTypes,
  listEnvironments,
  listUnits,
  moveAsset,
} from '../data/asset-service'
import {
  getAssetSmartProfile,
} from '../data/asset-smart-service'
import {
  getAssetTechnicalProfile,
  type AssetTechnicalProfileRecord,
} from '../data/ocr-intelligence-service'
import type {
  AgentInventorySnapshotRecord,
} from '../types/agent'
import type {
  AssetSmartProfile,
} from '../types/asset-smart'
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

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
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

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-black uppercase tracking-[0.09em] text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 truncate text-sm font-semibold text-slate-800 ${
          mono ? 'font-mono' : ''
        }`}
        title={value || '—'}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function primaryThirdPartyCode(
  profile: AssetSmartProfile | null,
) {
  if (!profile) return null

  const preferred =
    profile.identifiers.find(
      (item) =>
        item.identifier_type === 'patrimony',
    ) ??
    profile.identifiers.find(
      (item) =>
        item.identifier_type === 'tombamento',
    ) ??
    profile.identifiers.find(
      (item) =>
        item.identifier_type ===
        'internal_serial',
    ) ??
    profile.identifiers.find(
      (item) =>
        item.identifier_type === 'other',
    )

  return preferred?.identifier_value ?? null
}

export function AssetDetailPage() {
  const { assetId } = useParams()
  const { hasPermission } = useAuth()

  const [asset, setAsset] =
    useState<AssetRecord | null>(null)
  const [types, setTypes] =
    useState<AssetTypeRecord[]>([])
  const [units, setUnits] =
    useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [movements, setMovements] =
    useState<AssetMovementRecord[]>([])
  const [
    technicalProfile,
    setTechnicalProfile,
  ] =
    useState<AssetTechnicalProfileRecord | null>(
      null,
    )
  const [smartProfile, setSmartProfile] =
    useState<AssetSmartProfile | null>(null)
  const [snapshot, setSnapshot] =
    useState<AgentInventorySnapshotRecord | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)
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

    const [
      technicalRow,
      smartRow,
      snapshotRow,
    ] = await Promise.all([
      getAssetTechnicalProfile(id)
        .catch(() => null),
      getAssetSmartProfile(id)
        .catch(() => null),
      getLatestAssetSnapshot(id)
        .catch(() => null),
    ])

    return {
      assetRow,
      typeRows,
      unitRows,
      environmentRows,
      movementRows,
      technicalRow,
      smartRow,
      snapshotRow,
    }
  }

  useEffect(() => {
    if (!assetId) return

    let active = true

    async function bootstrap(id: string) {
      try {
        const data = await fetchData(id)
        if (!active) return

        setAsset(data.assetRow)
        setTypes(data.typeRows)
        setUnits(data.unitRows)
        setEnvironments(
          data.environmentRows,
        )
        setMovements(data.movementRows)
        setTechnicalProfile(
          data.technicalRow,
        )
        setSmartProfile(data.smartRow)
        setSnapshot(data.snapshotRow)
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o ativo.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrap(assetId)

    return () => {
      active = false
    }
  }, [assetId])

  async function refresh() {
    if (!assetId) return

    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await fetchData(assetId)

      setAsset(data.assetRow)
      setTypes(data.typeRows)
      setUnits(data.unitRows)
      setEnvironments(
        data.environmentRows,
      )
      setMovements(data.movementRows)
      setTechnicalProfile(
        data.technicalRow,
      )
      setSmartProfile(data.smartRow)
      setSnapshot(data.snapshotRow)
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
        types.map((type) => [
          type.id,
          type,
        ]),
      ),
    [types],
  )

  const unitMap = useMemo(
    () =>
      new Map(
        units.map((unit) => [
          unit.id,
          unit,
        ]),
      ),
    [units],
  )

  const environmentMap = useMemo(
    () =>
      new Map(
        environments.map(
          (environment) => [
            environment.id,
            environment,
          ],
        ),
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
          {errorMessage ??
            'Ativo não encontrado.'}
        </div>
      </div>
    )
  }

  const type =
    typeMap.get(asset.asset_type_id)
  const unit = unitMap.get(
    asset.current_unit_id ?? '',
  )
  const environment = environmentMap.get(
    asset.current_environment_id ?? '',
  )
  const thirdPartyCode =
    primaryThirdPartyCode(smartProfile)
  const visibleNotes =
    cleanAssetNotes(asset.notes)

  return (
    <div className="space-y-5">
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
                Código interno ·{' '}
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
            <RefreshCw
              size={15}
              className={
                loading
                  ? 'animate-spin'
                  : undefined
              }
            />
          </button>

          {hasPermission('assets.update') && (
            <button
              type="button"
              onClick={() =>
                setEditOpen(true)
              }
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
                onClick={() =>
                  setMoveOpen(true)
                }
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem
              label="Tipo"
              value={type?.name ?? '—'}
            />
            <InfoItem
              label="Estado"
              value={
                statusLabels[asset.status]
              }
            />
            <InfoItem
              label="Número de série"
              value={
                asset.serial_number ?? '—'
              }
              mono
            />
            <InfoItem
              label="Código de terceiro"
              value={thirdPartyCode ?? '—'}
              mono
            />
            <InfoItem
              label="Hostname"
              value={
                asset.hostname ?? '—'
              }
              mono
            />
            <InfoItem
              label="Aquisição"
              value={
                asset.acquired_at
                  ? new Date(
                      `${asset.acquired_at}T00:00:00`,
                    ).toLocaleDateString(
                      'pt-BR',
                    )
                  : '—'
              }
            />
          </div>
        </section>

        <section className="self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
            <MapPin size={13} />
            Local atual
          </div>

          <div className="mt-2 text-base font-black text-slate-950">
            {environment?.name ??
              unit?.name ??
              'Sem local definido'}
          </div>

          {environment && unit && (
            <div className="mt-1 text-xs text-slate-500">
              {unit.name}
            </div>
          )}

          <div className="mt-3 text-[10px] text-slate-400">
            {asset.status === 'stock'
              ? 'Equipamento em estoque'
              : 'Localização patrimonial atual'}
          </div>
        </section>
      </div>

      <AssetTechnicalOverviewCard
        asset={asset}
        profile={technicalProfile}
        snapshot={snapshot}
        canManage={hasPermission(
          'assets.update',
        )}
        onChanged={() =>
          void refresh()
        }
      />

      {visibleNotes && (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
            Observações do técnico
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {visibleNotes}
          </p>
        </section>
      )}

      <AssetQrLabelCard
        asset={asset}
        typeName={type?.name ?? 'Ativo'}
      />

      <AssetSmartMetadataCard
        assetId={asset.id}
      />

      <AssetAgentPanel asset={asset} />

      <AssetBindingsCard
        assetId={asset.id}
      />

      <EvidencePanel
        context={{
          assetId: asset.id,
        }}
        canUpload={
          hasPermission('assets.update')
        }
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
                  movement.to_environment_id ??
                    '',
                )

              return (
                <div
                  key={movement.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[150px_1fr]"
                >
                  <div className="text-[11px] font-semibold text-slate-400">
                    {new Date(
                      movement.moved_at,
                    ).toLocaleString(
                      'pt-BR',
                    )}
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

      <AssetEditModal
        open={editOpen}
        asset={asset}
        types={types}
        technicalProfile={technicalProfile}
        onClose={() =>
          setEditOpen(false)
        }
        onSaved={() => void refresh()}
      />

      <MoveAssetModal
        open={moveOpen}
        asset={asset}
        units={units.filter(
          (item) => item.active,
        )}
        environments={environments.filter(
          (item) => item.active,
        )}
        onClose={() =>
          setMoveOpen(false)
        }
        onSaved={() => void refresh()}
      />
    </div>
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
  const [saving, setSaving] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [unitId, setUnitId] =
    useState('')
  const [
    environmentId,
    setEnvironmentId,
  ] = useState('')
  const [reason, setReason] =
    useState('')

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setUnitId(
        asset.current_unit_id ?? '',
      )
      setEnvironmentId(
        asset.current_environment_id ??
          '',
      )
      setReason('')
      setErrorMessage(null)
    })
  }, [asset, open])

  const filteredEnvironments =
    environments.filter(
      (environment) =>
        !unitId ||
        environment.unit_id === unitId,
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
            disabled={
              saving || !reason.trim()
            }
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
        onSubmit={(event) =>
          void submit(event)
        }
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
              setUnitId(
                event.target.value,
              )
              setEnvironmentId('')
            }}
          >
            <option value="">
              Sem unidade
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
            <option value="">
              Sem ambiente
            </option>
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
