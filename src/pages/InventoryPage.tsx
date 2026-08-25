import {
  Boxes,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { FormModal } from '../components/ui/FormModal'
import { PageHeader } from '../components/ui/PageHeader'
import {
  listEnvironments,
  listUnits,
} from '../data/asset-service'
import {
  createStockUnit,
  listStockProducts,
  listStockUnits,
} from '../data/stock-service'
import type {
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'
import type {
  StockCondition,
  StockProductRecord,
  StockStatus,
  StockUnitRecord,
} from '../types/stock'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const statusLabels: Record<StockStatus, string> = {
  in_stock: 'Em estoque',
  reserved: 'Reservado',
  installed: 'Instalado',
  maintenance: 'Manutenção',
  disposed: 'Descartado',
}

const conditionLabels: Record<StockCondition, string> = {
  new: 'Novo',
  used: 'Usado',
  refurbished: 'Recondicionado',
  damaged: 'Danificado',
}

const statusClass: Record<StockStatus, string> = {
  in_stock: 'bg-emerald-50 text-emerald-700',
  reserved: 'bg-sky-50 text-sky-700',
  installed: 'bg-violet-50 text-violet-700',
  maintenance: 'bg-amber-50 text-amber-700',
  disposed: 'bg-red-50 text-red-700',
}

async function loadInventoryData() {
  const [items, products, units, environments] =
    await Promise.all([
      listStockUnits(),
      listStockProducts(),
      listUnits(),
      listEnvironments(),
    ])

  return { items, products, units, environments }
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

export function InventoryPage() {
  const { hasPermission } = useAuth()

  const [items, setItems] = useState<StockUnitRecord[]>([])
  const [products, setProducts] =
    useState<StockProductRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StockStatus | 'all'>(
    'all',
  )
  const [category, setCategory] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)

  const canAdjust = hasPermission('stock.adjust')

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data = await loadInventoryData()

        if (!active) return

        setItems(data.items)
        setProducts(data.products)
        setUnits(data.units)
        setEnvironments(data.environments)
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o estoque.',
        )
      } finally {
        if (active) setLoading(false)
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
      const data = await loadInventoryData()
      setItems(data.items)
      setProducts(data.products)
      setUnits(data.units)
      setEnvironments(data.environments)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o estoque.',
      )
    } finally {
      setLoading(false)
    }
  }

  const productMap = useMemo(
    () => new Map(products.map((item) => [item.id, item])),
    [products],
  )

  const unitMap = useMemo(
    () => new Map(units.map((item) => [item.id, item])),
    [units],
  )

  const environmentMap = useMemo(
    () =>
      new Map(
        environments.map((item) => [item.id, item]),
      ),
    [environments],
  )

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((item) => item.category)),
      ).sort(),
    [products],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return items.filter((item) => {
      const product = productMap.get(item.product_id)

      if (status !== 'all' && item.status !== status) {
        return false
      }

      if (
        category !== 'all' &&
        product?.category !== category
      ) {
        return false
      }

      if (!term) return true

      const haystack = [
        item.stock_code,
        product?.name,
        item.manufacturer,
        item.model,
        item.serial_number,
        item.purchase_reference,
        unitMap.get(item.current_unit_id ?? '')?.name,
        environmentMap.get(
          item.current_environment_id ?? '',
        )?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [
    category,
    environmentMap,
    items,
    productMap,
    search,
    status,
    unitMap,
  ])

  const inStock = items.filter(
    (item) => item.status === 'in_stock',
  ).length
  const installed = items.filter(
    (item) => item.status === 'installed',
  ).length
  const attention = items.filter(
    (item) =>
      item.status === 'maintenance' ||
      item.condition === 'damaged',
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Estoque"
        description="Peças físicas, condição, localização e vínculo com máquinas."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw
                size={15}
                className={loading ? 'animate-spin' : undefined}
              />
              Atualizar
            </button>

            {canAdjust && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus size={15} />
                Entrada de item
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

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Em estoque"
          value={inStock}
          detail="Disponíveis para uso"
        />
        <MetricCard
          label="Instalados"
          value={installed}
          detail="Vinculados a ativos"
        />
        <MetricCard
          label="Atenção"
          value={attention}
          detail="Manutenção ou dano"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[1fr_190px_210px]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              placeholder="Buscar código, serial, modelo ou referência"
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
                  event.target.value as StockStatus | 'all',
                )
              }
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-600 outline-none"
            >
              <option value="all">Todos os status</option>
              {Object.entries(statusLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Itens controlados
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {filtered.length} registros exibidos
            </p>
          </div>
        </header>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <RefreshCw
              size={18}
              className="animate-spin text-slate-400"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <Boxes size={19} />
              </div>
              <div className="mt-4 text-sm font-bold text-slate-900">
                Nenhum item encontrado
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Cadastre uma peça física ou ajuste os filtros.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    <th className="px-5 py-3">Código</th>
                    <th className="px-4 py-3">Componente</th>
                    <th className="px-4 py-3">Serial</th>
                    <th className="px-4 py-3">Condição</th>
                    <th className="px-4 py-3">Local / vínculo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => {
                    const product = productMap.get(
                      item.product_id,
                    )
                    const unit = unitMap.get(
                      item.current_unit_id ?? '',
                    )
                    const environment = environmentMap.get(
                      item.current_environment_id ?? '',
                    )

                    return (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <Link
                            to={`/estoque/${item.id}`}
                            className="font-mono text-xs font-bold text-slate-950 hover:text-sky-700"
                          >
                            {item.stock_code}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-semibold text-slate-800">
                            {product?.name ?? 'Componente'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {[item.manufacturer, item.model]
                              .filter(Boolean)
                              .join(' ') || 'Sem modelo'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {item.serial_number || '—'}
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-600">
                          {conditionLabels[item.condition]}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs font-semibold text-slate-700">
                            {item.installed_asset_id
                              ? 'Instalado em ativo'
                              : environment?.name ??
                                unit?.name ??
                                'Sem local'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass[item.status]}`}
                          >
                            {statusLabels[item.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            to={`/estoque/${item.id}`}
                            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Abrir item"
                          >
                            <ChevronRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {filtered.map((item) => {
                const product = productMap.get(item.product_id)

                return (
                  <Link
                    key={item.id}
                    to={`/estoque/${item.id}`}
                    className="flex items-center gap-3 p-4 transition hover:bg-slate-50"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                      <Boxes size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11px] font-bold text-slate-500">
                        {item.stock_code}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold text-slate-900">
                        {product?.name ?? 'Componente'}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-400">
                        {[item.manufacturer, item.model, item.serial_number]
                          .filter(Boolean)
                          .join(' · ') || 'Sem detalhes'}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-bold ${statusClass[item.status]}`}
                    >
                      {statusLabels[item.status]}
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

      <CreateStockModal
        open={createOpen}
        products={products}
        units={units.filter((item) => item.active)}
        environments={environments.filter((item) => item.active)}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void refresh()}
      />
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs font-bold text-slate-800">
        {label}
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        {detail}
      </div>
    </section>
  )
}

function CreateStockModal({
  open,
  products,
  units,
  environments,
  onClose,
  onSaved,
}: {
  open: boolean
  products: StockProductRecord[]
  units: UnitRecord[]
  environments: EnvironmentRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [productId, setProductId] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [condition, setCondition] =
    useState<StockCondition>('new')
  const [unitId, setUnitId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [purchaseReference, setPurchaseReference] =
    useState('')
  const [acquiredAt, setAcquiredAt] = useState('')
  const [warrantyUntil, setWarrantyUntil] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setProductId(products[0]?.id ?? '')
      setManufacturer('')
      setModel('')
      setSerial('')
      setCondition('new')
      setUnitId('')
      setEnvironmentId('')
      setSupplier('')
      setPurchaseReference('')
      setAcquiredAt('')
      setWarrantyUntil('')
      setCost('')
      setNotes('')
      setErrorMessage(null)
    })
  }, [open, products])

  const filteredEnvironments = environments.filter(
    (item) => !unitId || item.unit_id === unitId,
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await createStockUnit({
        product_id: productId,
        manufacturer,
        model,
        serial_number: serial,
        condition,
        current_unit_id: unitId || undefined,
        current_environment_id: environmentId || undefined,
        supplier_name: supplier,
        purchase_reference: purchaseReference,
        acquired_at: acquiredAt || undefined,
        warranty_until: warrantyUntil || undefined,
        cost_amount: cost
          ? Number(cost.replace(',', '.'))
          : undefined,
        notes,
      })

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a entrada.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Entrada de item"
      description="Cada peça física recebe um código Wisdom individual."
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
            form="create-stock-form"
            disabled={saving || !productId}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Registrar entrada'}
          </button>
        </div>
      }
    >
      <form
        id="create-stock-form"
        onSubmit={submit}
        className="space-y-5"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Componente">
            <select
              className={inputClass}
              value={productId}
              onChange={(event) =>
                setProductId(event.target.value)
              }
              required
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Condição">
            <select
              className={inputClass}
              value={condition}
              onChange={(event) =>
                setCondition(
                  event.target.value as StockCondition,
                )
              }
            >
              {Object.entries(conditionLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field label="Fabricante">
            <input
              className={inputClass}
              value={manufacturer}
              onChange={(event) =>
                setManufacturer(event.target.value)
              }
            />
          </Field>

          <Field label="Modelo">
            <input
              className={inputClass}
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </Field>

          <Field label="Número de série">
            <input
              className={inputClass}
              value={serial}
              onChange={(event) => setSerial(event.target.value)}
            />
          </Field>

          <Field label="Referência de compra">
            <input
              className={inputClass}
              value={purchaseReference}
              onChange={(event) =>
                setPurchaseReference(event.target.value)
              }
              placeholder="NF, pedido ou lote"
            />
          </Field>

          <Field label="Fornecedor">
            <input
              className={inputClass}
              value={supplier}
              onChange={(event) =>
                setSupplier(event.target.value)
              }
            />
          </Field>

          <Field label="Custo">
            <input
              className={inputClass}
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              placeholder="0,00"
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

          <Field label="Garantia até">
            <input
              className={inputClass}
              type="date"
              value={warrantyUntil}
              onChange={(event) =>
                setWarrantyUntil(event.target.value)
              }
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unidade de estoque">
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

          <Field label="Ambiente de estoque">
            <select
              className={inputClass}
              value={environmentId}
              onChange={(event) =>
                setEnvironmentId(event.target.value)
              }
              disabled={!unitId}
            >
              <option value="">Sem ambiente definido</option>
              {filteredEnvironments.map((environment) => (
                <option
                  key={environment.id}
                  value={environment.id}
                >
                  {environment.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </Field>
      </form>
    </FormModal>
  )
}
