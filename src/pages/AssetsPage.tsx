import {
  ChevronRight,
  Filter,
  Monitor,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { FormModal } from '../components/ui/FormModal'
import { PageHeader } from '../components/ui/PageHeader'
import {
  createAsset,
  listAssets,
  listAssetTypes,
  listEnvironments,
  listUnits,
} from '../data/asset-service'
import type {
  AssetRecord,
  AssetStatus,
  AssetTypeRecord,
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const statusLabels: Record<AssetStatus, string> = {
  active: 'Ativo',
  stock: 'Estoque',
  maintenance: 'Manutenção',
  retired: 'Baixado',
  disposed: 'Descartado',
}

const statusClass: Record<AssetStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  stock: 'bg-sky-50 text-sky-700',
  maintenance: 'bg-amber-50 text-amber-700',
  retired: 'bg-slate-100 text-slate-600',
  disposed: 'bg-red-50 text-red-700',
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

export function AssetsPage() {
  const { hasPermission } = useAuth()

  const [assets, setAssets] = useState<AssetRecord[]>(
    [],
  )
  const [types, setTypes] =
    useState<AssetTypeRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<
    AssetStatus | 'all'
  >('all')
  const [unitId, setUnitId] = useState('all')

  const [createOpen, setCreateOpen] =
    useState(false)

  const canCreate = hasPermission('assets.create')

  async function fetchData() {
    const [
      assetRows,
      typeRows,
      unitRows,
      environmentRows,
    ] = await Promise.all([
      listAssets(),
      listAssetTypes(),
      listUnits(),
      listEnvironments(),
    ])

    return {
      assetRows,
      typeRows,
      unitRows,
      environmentRows,
    }
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data = await fetchData()

        if (!active) {
          return
        }

        setAssets(data.assetRows)
        setTypes(data.typeRows)
        setUnits(data.unitRows)
        setEnvironments(data.environmentRows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o patrimônio.',
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
  }, [])

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await fetchData()

      setAssets(data.assetRows)
      setTypes(data.typeRows)
      setUnits(data.unitRows)
      setEnvironments(data.environmentRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o patrimônio.',
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

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase()

    return assets.filter((asset) => {
      if (
        status !== 'all' &&
        asset.status !== status
      ) {
        return false
      }

      if (
        unitId !== 'all' &&
        asset.current_unit_id !== unitId
      ) {
        return false
      }

      if (!term) {
        return true
      }

      const haystack = [
        asset.asset_code,
        asset.manufacturer,
        asset.model,
        asset.serial_number,
        asset.hostname,
        typeMap.get(asset.asset_type_id)?.name,
        unitMap.get(asset.current_unit_id ?? '')?.name,
        environmentMap.get(
          asset.current_environment_id ?? '',
        )?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [
    assets,
    environmentMap,
    search,
    status,
    typeMap,
    unitId,
    unitMap,
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Patrimônio"
        description="Cadastro e localização atual dos ativos controlados."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw
                size={15}
                className={
                  loading ? 'animate-spin' : undefined
                }
              />
              Atualizar
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus size={15} />
                Novo ativo
              </button>
            )}
          </div>
        }
      />

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[1fr_180px_220px]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              placeholder="Buscar código, serial, modelo ou ambiente"
            />
          </div>

          <div className="relative">
            <Filter
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as
                    | AssetStatus
                    | 'all',
                )
              }
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-600 outline-none"
            >
              <option value="all">
                Todos os estados
              </option>
              <option value="active">Ativo</option>
              <option value="stock">Estoque</option>
              <option value="maintenance">
                Manutenção
              </option>
              <option value="retired">Baixado</option>
              <option value="disposed">
                Descartado
              </option>
            </select>
          </div>

          <select
            value={unitId}
            onChange={(event) =>
              setUnitId(event.target.value)
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none"
          >
            <option value="all">
              Todas as unidades
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
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Ativos controlados
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {filteredAssets.length} registros exibidos
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <RefreshCw
              size={18}
              className="animate-spin text-slate-400"
            />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <Monitor size={19} />
              </div>
              <div className="mt-4 text-sm font-bold text-slate-900">
                Nenhum ativo encontrado
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Ajuste os filtros ou cadastre o primeiro ativo.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    <th className="px-5 py-3">
                      Código
                    </th>
                    <th className="px-4 py-3">
                      Ativo
                    </th>
                    <th className="px-4 py-3">
                      Serial
                    </th>
                    <th className="px-4 py-3">
                      Local
                    </th>
                    <th className="px-4 py-3">
                      Estado
                    </th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.map((asset) => {
                    const type = typeMap.get(
                      asset.asset_type_id,
                    )
                    const unit = unitMap.get(
                      asset.current_unit_id ?? '',
                    )
                    const environment =
                      environmentMap.get(
                        asset.current_environment_id ??
                          '',
                      )

                    return (
                      <tr
                        key={asset.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <Link
                            to={`/patrimonio/${asset.id}`}
                            className="font-mono text-xs font-bold text-slate-950 hover:text-sky-700"
                          >
                            {asset.asset_code}
                          </Link>
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm font-semibold text-slate-800">
                            {asset.manufacturer ||
                              type?.name ||
                              'Ativo'}{' '}
                            {asset.model ?? ''}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {type?.name ?? 'Tipo'}
                            {asset.hostname
                              ? ` · ${asset.hostname}`
                              : ''}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-500">
                          {asset.serial_number || '—'}
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-xs font-semibold text-slate-700">
                            {environment?.name ??
                              unit?.name ??
                              'Sem local'}
                          </div>
                          {environment && unit && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {unit.name}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass[asset.status]}`}
                          >
                            {
                              statusLabels[
                                asset.status
                              ]
                            }
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            to={`/patrimonio/${asset.id}`}
                            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Abrir ativo"
                          >
                            <ChevronRight
                              size={15}
                            />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredAssets.map((asset) => {
                const type = typeMap.get(
                  asset.asset_type_id,
                )
                const unit = unitMap.get(
                  asset.current_unit_id ?? '',
                )
                const environment =
                  environmentMap.get(
                    asset.current_environment_id ??
                      '',
                  )

                return (
                  <Link
                    key={asset.id}
                    to={`/patrimonio/${asset.id}`}
                    className="flex items-center gap-3 p-4 transition hover:bg-slate-50"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                      <Monitor size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11px] font-bold text-slate-500">
                        {asset.asset_code}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold text-slate-900">
                        {asset.manufacturer ||
                          type?.name ||
                          'Ativo'}{' '}
                        {asset.model ?? ''}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-400">
                        {environment?.name ??
                          unit?.name ??
                          'Sem local'}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-bold ${statusClass[asset.status]}`}
                    >
                      {statusLabels[asset.status]}
                    </span>

                    <ChevronRight
                      size={16}
                      className="text-slate-300"
                    />
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </section>

      <CreateAssetModal
        open={createOpen}
        types={types}
        units={units.filter((unit) => unit.active)}
        environments={environments.filter(
          (environment) => environment.active,
        )}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void refresh()}
      />
    </div>
  )
}

function CreateAssetModal({
  open,
  types,
  units,
  environments,
  onClose,
  onSaved,
}: {
  open: boolean
  types: AssetTypeRecord[]
  units: UnitRecord[]
  environments: EnvironmentRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [typeId, setTypeId] = useState('')
  const [manufacturer, setManufacturer] =
    useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [hostname, setHostname] = useState('')
  const [osName, setOsName] = useState('')
  const [status, setStatus] =
    useState<AssetStatus>('active')
  const [unitId, setUnitId] = useState('')
  const [environmentId, setEnvironmentId] =
    useState('')
  const [acquiredAt, setAcquiredAt] =
    useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    queueMicrotask(() => {
      setTypeId(types[0]?.id ?? '')
      setManufacturer('')
      setModel('')
      setSerial('')
      setHostname('')
      setOsName('')
      setStatus('active')
      setUnitId('')
      setEnvironmentId('')
      setAcquiredAt('')
      setNotes('')
      setErrorMessage(null)
    })
  }, [open, types])

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

      await createAsset({
        asset_type_id: typeId,
        manufacturer,
        model,
        serial_number: serial,
        hostname,
        os_name: osName,
        status,
        current_unit_id: unitId || undefined,
        current_environment_id:
          environmentId || undefined,
        acquired_at: acquiredAt || undefined,
        notes,
      })

      onClose()
      onSaved()
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
      title="Novo ativo"
      description="O código Wisdom será gerado automaticamente pelo banco."
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
            form="create-asset-form"
            disabled={saving || !typeId}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Cadastrar ativo'}
          </button>
        </div>
      }
    >
      <form
        id="create-asset-form"
        onSubmit={submit}
        className="space-y-5"
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

          <Field label="Estado">
            <select
              className={inputClass}
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value as AssetStatus,
                )
              }
            >
              <option value="active">Ativo</option>
              <option value="stock">Estoque</option>
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
              placeholder="Windows 11 Pro"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unidade">
            <select
              className={inputClass}
              value={unitId}
              onChange={(event) => {
                setUnitId(event.target.value)
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

          <Field label="Ambiente">
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
                Sem ambiente definido
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
        </div>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </Field>
      </form>
    </FormModal>
  )
}