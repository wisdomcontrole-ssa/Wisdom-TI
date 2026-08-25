import {
  Building2,
  DoorOpen,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { useAuth } from '../auth/useAuth'
import { FormModal } from '../components/ui/FormModal'
import { PageHeader } from '../components/ui/PageHeader'
import {
  createEnvironment,
  createUnit,
  listEnvironments,
  listUnits,
  updateEnvironment,
  updateUnit,
  type EnvironmentInput,
  type UnitInput,
} from '../data/asset-service'
import type {
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'

const environmentTypes = [
  ['laboratory', 'Laboratório'],
  ['office', 'Escritório'],
  ['secretariat', 'Secretaria'],
  ['storage', 'Depósito'],
  ['classroom', 'Sala'],
  ['network', 'Infraestrutura'],
  ['other', 'Outro'],
] as const

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

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const textareaClass =
  'min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

export function LocationsPage() {
  const { hasPermission } = useAuth()

  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [unitModal, setUnitModal] = useState<{
    record?: UnitRecord
  } | null>(null)

  const [environmentModal, setEnvironmentModal] =
    useState<{
      record?: EnvironmentRecord
    } | null>(null)

  const canManage = hasPermission('locations.manage')

  const fetchData = useCallback(async () => {
    const [unitRows, environmentRows] =
      await Promise.all([
        listUnits(),
        listEnvironments(),
      ])

    return {
      unitRows,
      environmentRows,
    }
  }, [])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data = await fetchData()

        if (!active) {
          return
        }

        setUnits(data.unitRows)
        setEnvironments(data.environmentRows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as localizações.',
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
  }, [fetchData])

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const data = await fetchData()

      setUnits(data.unitRows)
      setEnvironments(data.environmentRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar as localizações.',
      )
    } finally {
      setLoading(false)
    }
  }

  const environmentCountByUnit = useMemo(() => {
    const counts = new Map<string, number>()

    for (const environment of environments) {
      counts.set(
        environment.unit_id,
        (counts.get(environment.unit_id) ?? 0) + 1,
      )
    }

    return counts
  }, [environments])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Estrutura"
        title="Ambientes"
        description="Unidades e locais físicos utilizados pelo patrimônio."
        actions={
          <div className="flex flex-wrap gap-2">
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

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setUnitModal({})}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Building2 size={15} />
                  Nova unidade
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEnvironmentModal({})
                  }
                  disabled={units.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Plus size={15} />
                  Novo ambiente
                </button>
              </>
            )}
          </div>
        }
      />

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
            <RefreshCw
              size={16}
              className="animate-spin"
            />
            Carregando estrutura
          </div>
        </div>
      ) : units.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div>
            <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
              <MapPin size={19} />
            </div>
            <div className="mt-4 text-sm font-bold text-slate-900">
              Nenhuma unidade cadastrada
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Cadastre a primeira unidade para começar a organizar os ambientes.
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {units.map((unit) => {
            const unitEnvironments = environments.filter(
              (environment) =>
                environment.unit_id === unit.id,
            )

            return (
              <section
                key={unit.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                      <Building2 size={17} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-bold text-slate-950">
                          {unit.name}
                        </h2>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            unit.active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {unit.active
                            ? 'Ativa'
                            : 'Inativa'}
                        </span>
                      </div>

                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {unit.code} ·{' '}
                        {environmentCountByUnit.get(
                          unit.id,
                        ) ?? 0}{' '}
                        ambientes
                      </div>

                      {unit.address_text && (
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {unit.address_text}
                        </div>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        setUnitModal({
                          record: unit,
                        })
                      }
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Editar unidade"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </header>

                <div className="divide-y divide-slate-100">
                  {unitEnvironments.length === 0 ? (
                    <div className="px-5 py-6 text-xs text-slate-400">
                      Nenhum ambiente cadastrado nesta unidade.
                    </div>
                  ) : (
                    unitEnvironments.map(
                      (environment) => (
                        <div
                          key={environment.id}
                          className="flex items-center gap-3 px-5 py-3.5"
                        >
                          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                            <DoorOpen size={15} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {environment.name}
                            </div>

                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                              {environment.code} ·{' '}
                              {
                                environment.environment_type
                              }
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              environment.active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {environment.active
                              ? 'Ativo'
                              : 'Inativo'}
                          </span>

                          {canManage && (
                            <button
                              type="button"
                              onClick={() =>
                                setEnvironmentModal({
                                  record: environment,
                                })
                              }
                              className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Editar ambiente"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                      ),
                    )
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <UnitFormModal
        state={unitModal}
        onClose={() => setUnitModal(null)}
        onSaved={() => void refresh()}
      />

      <EnvironmentFormModal
        state={environmentModal}
        units={units.filter((unit) => unit.active)}
        onClose={() => setEnvironmentModal(null)}
        onSaved={() => void refresh()}
      />
    </div>
  )
}

function UnitFormModal({
  state,
  onClose,
  onSaved,
}: {
  state: { record?: UnitRecord } | null
  onClose: () => void
  onSaved: () => void
}) {
  const record = state?.record

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] =
    useState('')
  const [address, setAddress] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!state) {
      return
    }

    queueMicrotask(() => {
      setCode(record?.code ?? '')
      setName(record?.name ?? '')
      setDescription(record?.description ?? '')
      setAddress(record?.address_text ?? '')
      setActive(record?.active ?? true)
      setErrorMessage(null)
    })
  }, [record, state])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const input: UnitInput = {
      code,
      name,
      description,
      address_text: address,
      active,
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      if (record) {
        await updateUnit(record.id, input)
      } else {
        await createUnit(input)
      }

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a unidade.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={Boolean(state)}
      title={
        record ? 'Editar unidade' : 'Nova unidade'
      }
      description="Estrutura física de alto nível da Wisdom."
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
            form="unit-form"
            disabled={saving}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar unidade'}
          </button>
        </div>
      }
    >
      <form
        id="unit-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Código">
            <input
              className={inputClass}
              value={code}
              onChange={(event) =>
                setCode(event.target.value)
              }
              placeholder="CENTRO"
              required
            />
          </Field>

          <Field label="Nome">
            <input
              className={inputClass}
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Unidade Centro"
              required
            />
          </Field>
        </div>

        <Field label="Endereço">
          <input
            className={inputClass}
            value={address}
            onChange={(event) =>
              setAddress(event.target.value)
            }
          />
        </Field>

        <Field label="Observações">
          <textarea
            className={textareaClass}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
          />
        </Field>

        {record && (
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) =>
                setActive(event.target.checked)
              }
            />
            <span className="text-sm font-semibold text-slate-700">
              Unidade ativa
            </span>
          </label>
        )}
      </form>
    </FormModal>
  )
}

function EnvironmentFormModal({
  state,
  units,
  onClose,
  onSaved,
}: {
  state: {
    record?: EnvironmentRecord
  } | null
  units: UnitRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const record = state?.record

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [unitId, setUnitId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('other')
  const [description, setDescription] =
    useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!state) {
      return
    }

    queueMicrotask(() => {
      setUnitId(
        record?.unit_id ?? units[0]?.id ?? '',
      )
      setCode(record?.code ?? '')
      setName(record?.name ?? '')
      setType(
        record?.environment_type ?? 'other',
      )
      setDescription(record?.description ?? '')
      setActive(record?.active ?? true)
      setErrorMessage(null)
    })
  }, [record, state, units])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const input: EnvironmentInput = {
      unit_id: unitId,
      code,
      name,
      environment_type: type,
      description,
      active,
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      if (record) {
        await updateEnvironment(record.id, input)
      } else {
        await createEnvironment(input)
      }

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o ambiente.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={Boolean(state)}
      title={
        record ? 'Editar ambiente' : 'Novo ambiente'
      }
      description="Local físico onde os ativos podem ser vinculados."
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
            form="environment-form"
            disabled={saving}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Salvando...'
              : 'Salvar ambiente'}
          </button>
        </div>
      }
    >
      <form
        id="environment-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Unidade">
          <select
            className={inputClass}
            value={unitId}
            disabled={Boolean(record)}
            onChange={(event) =>
              setUnitId(event.target.value)
            }
            required
          >
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

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Código">
            <input
              className={inputClass}
              value={code}
              onChange={(event) =>
                setCode(event.target.value)
              }
              placeholder="LAB01"
              required
            />
          </Field>

          <Field label="Nome">
            <input
              className={inputClass}
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Laboratório 01"
              required
            />
          </Field>
        </div>

        <Field label="Tipo">
          <select
            className={inputClass}
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
          >
            {environmentTypes.map(
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

        <Field label="Observações">
          <textarea
            className={textareaClass}
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
          />
        </Field>

        {record && (
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) =>
                setActive(event.target.checked)
              }
            />
            <span className="text-sm font-semibold text-slate-700">
              Ambiente ativo
            </span>
          </label>
        )}
      </form>
    </FormModal>
  )
}