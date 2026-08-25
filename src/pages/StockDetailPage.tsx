import {
  ArrowLeft,
  Boxes,
  Edit3,
  History,
  Link2,
  MapPin,
  MoveRight,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { EvidencePanel } from '../components/evidence/EvidencePanel'
import { FormModal } from '../components/ui/FormModal'
import {
  listAssets,
  listEnvironments,
  listUnits,
} from '../data/asset-service'
import {
  changeStockUnitStatus,
  getStockUnitById,
  installStockUnit,
  listStockMovements,
  listStockProducts,
  moveStockUnit,
  removeStockUnit,
  updateStockUnit,
} from '../data/stock-service'
import type {
  AssetRecord,
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'
import type {
  StockCondition,
  StockMovementRecord,
  StockProductRecord,
  StockStatus,
  StockUnitRecord,
} from '../types/stock'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const conditionLabels: Record<StockCondition, string> = {
  new: 'Novo',
  used: 'Usado',
  refurbished: 'Recondicionado',
  damaged: 'Danificado',
}

const statusLabels: Record<StockStatus, string> = {
  in_stock: 'Em estoque',
  reserved: 'Reservado',
  installed: 'Instalado',
  maintenance: 'Manutenção',
  disposed: 'Descartado',
}

async function loadStockDetail(id: string) {
  const [item, products, units, environments, assets, movements] =
    await Promise.all([
      getStockUnitById(id),
      listStockProducts(),
      listUnits(),
      listEnvironments(),
      listAssets(),
      listStockMovements(id),
    ])

  return { item, products, units, environments, assets, movements }
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

export function StockDetailPage() {
  const { stockUnitId } = useParams()
  const { hasPermission } = useAuth()

  const [item, setItem] = useState<StockUnitRecord | null>(null)
  const [products, setProducts] =
    useState<StockProductRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [movements, setMovements] =
    useState<StockMovementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [action, setAction] = useState<
    'move' | 'install' | 'remove' | 'status' | null
  >(null)

  useEffect(() => {
    if (!stockUnitId) return

    let active = true

    async function bootstrap(id: string) {
      try {
        const data = await loadStockDetail(id)

        if (!active) return

        setItem(data.item)
        setProducts(data.products)
        setUnits(data.units)
        setEnvironments(data.environments)
        setAssets(data.assets)
        setMovements(data.movements)
      } catch (error) {
        if (!active) return

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o item.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrap(stockUnitId)

    return () => {
      active = false
    }
  }, [stockUnitId])

  async function refresh() {
    if (!stockUnitId) return

    try {
      setLoading(true)
      setErrorMessage(null)
      const data = await loadStockDetail(stockUnitId)
      setItem(data.item)
      setProducts(data.products)
      setUnits(data.units)
      setEnvironments(data.environments)
      setAssets(data.assets)
      setMovements(data.movements)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o item.',
      )
    } finally {
      setLoading(false)
    }
  }

  const productMap = useMemo(
    () => new Map(products.map((value) => [value.id, value])),
    [products],
  )
  const unitMap = useMemo(
    () => new Map(units.map((value) => [value.id, value])),
    [units],
  )
  const environmentMap = useMemo(
    () =>
      new Map(
        environments.map((value) => [value.id, value]),
      ),
    [environments],
  )
  const assetMap = useMemo(
    () => new Map(assets.map((value) => [value.id, value])),
    [assets],
  )

  if (loading && !item) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <RefreshCw
          size={18}
          className="animate-spin text-slate-400"
        />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Link
          to="/estoque"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        >
          <ArrowLeft size={15} />
          Estoque
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {errorMessage ?? 'Item não encontrado.'}
        </div>
      </div>
    )
  }

  const product = productMap.get(item.product_id)
  const unit = unitMap.get(item.current_unit_id ?? '')
  const environment = environmentMap.get(
    item.current_environment_id ?? '',
  )
  const installedAsset = assetMap.get(
    item.installed_asset_id ?? '',
  )
  const canAdjust = hasPermission('stock.adjust')
  const canMove = hasPermission('stock.move')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/estoque"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Estoque
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-sky-400">
              <Boxes size={19} />
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-slate-400">
                {item.stock_code}
              </div>
              <h1 className="mt-0.5 text-2xl font-bold tracking-[-0.035em] text-slate-950">
                {product?.name ?? 'Componente'}
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

          {canAdjust && item.status !== 'installed' && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <Edit3 size={15} />
              Editar
            </button>
          )}

          {canMove && item.status !== 'installed' && (
            <button
              type="button"
              onClick={() => setAction('move')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <MoveRight size={15} />
              Transferir
            </button>
          )}

          {canMove &&
            product?.can_install &&
            (item.status === 'in_stock' ||
              item.status === 'reserved') && (
              <button
                type="button"
                onClick={() => setAction('install')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm"
              >
                <Link2 size={15} />
                Instalar
              </button>
            )}

          {canMove && item.status === 'installed' && (
            <button
              type="button"
              onClick={() => setAction('remove')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm"
            >
              <RotateCcw size={15} />
              Retirar
            </button>
          )}

          {canAdjust && item.status !== 'installed' && (
            <button
              type="button"
              onClick={() => setAction('status')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <SlidersHorizontal size={15} />
              Status
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label="Produto" value={product?.name ?? '—'} />
            <InfoItem label="Status" value={statusLabels[item.status]} />
            <InfoItem
              label="Condição"
              value={conditionLabels[item.condition]}
            />
            <InfoItem
              label="Fabricante"
              value={item.manufacturer ?? '—'}
            />
            <InfoItem label="Modelo" value={item.model ?? '—'} />
            <InfoItem
              label="Número de série"
              value={item.serial_number ?? '—'}
            />
            <InfoItem
              label="Fornecedor"
              value={item.supplier_name ?? '—'}
            />
            <InfoItem
              label="Referência"
              value={item.purchase_reference ?? '—'}
            />
            <InfoItem
              label="Custo"
              value={
                item.cost_amount == null
                  ? '—'
                  : item.cost_amount.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
              }
            />
          </div>

          {item.notes && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Observações
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {item.notes}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
            <MapPin size={14} />
            Situação atual
          </div>

          {installedAsset ? (
            <>
              <div className="mt-4 text-sm font-bold text-slate-950">
                Instalado em
              </div>
              <Link
                to={`/patrimonio/${installedAsset.id}`}
                className="mt-1 block font-mono text-sm font-bold text-sky-700"
              >
                {installedAsset.asset_code}
              </Link>
              <div className="mt-1 text-xs text-slate-500">
                {[installedAsset.manufacturer, installedAsset.model]
                  .filter(Boolean)
                  .join(' ')}
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 text-lg font-bold text-slate-950">
                {environment?.name ?? unit?.name ?? 'Sem local definido'}
              </div>
              {environment && unit && (
                <div className="mt-1 text-sm text-slate-500">
                  {unit.name}
                </div>
              )}
            </>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <InfoItem
              label="Aquisição"
              value={
                item.acquired_at
                  ? new Date(
                      `${item.acquired_at}T00:00:00`,
                    ).toLocaleDateString('pt-BR')
                  : 'Não informada'
              }
            />
            <div className="mt-5">
              <InfoItem
                label="Garantia"
                value={
                  item.warranty_until
                    ? new Date(
                        `${item.warranty_until}T00:00:00`,
                      ).toLocaleDateString('pt-BR')
                    : 'Não informada'
                }
              />
            </div>
          </div>
        </section>
      </div>

      <EvidencePanel
        context={{
          stockUnitId: item.id,
        }}
        canUpload={canAdjust || canMove}
        canManage={canAdjust || canMove}
        defaultCategory="stock"
        categoryOptions={[
          'stock',
          'maintenance',
          'other',
        ]}
        title="Fotos e evidências"
        description="Entrada, condição física, manutenção e documentação do componente."
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <History size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Histórico do item
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Entrada, transferência, instalação, retirada e ajustes
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
              const toEnvironment = environmentMap.get(
                movement.to_environment_id ?? '',
              )
              const toUnit = unitMap.get(
                movement.to_unit_id ?? '',
              )
              const toAsset = assetMap.get(
                movement.to_asset_id ?? '',
              )

              return (
                <div
                  key={movement.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[150px_1fr]"
                >
                  <div className="text-[11px] font-semibold text-slate-400">
                    {new Date(
                      movement.occurred_at,
                    ).toLocaleString('pt-BR')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {movement.movement_type}
                      {toAsset
                        ? ` → ${toAsset.asset_code}`
                        : toEnvironment
                          ? ` → ${toEnvironment.name}`
                          : toUnit
                            ? ` → ${toUnit.name}`
                            : ''}
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

      <EditStockModal
        open={editOpen}
        item={item}
        products={products}
        onClose={() => setEditOpen(false)}
        onSaved={() => void refresh()}
      />

      <StockActionModal
        mode={action}
        item={item}
        units={units.filter((value) => value.active)}
        environments={environments.filter((value) => value.active)}
        assets={assets.filter(
          (value) =>
            value.status !== 'retired' &&
            value.status !== 'disposed',
        )}
        onClose={() => setAction(null)}
        onSaved={() => void refresh()}
      />
    </div>
  )
}

function EditStockModal({
  open,
  item,
  products,
  onClose,
  onSaved,
}: {
  open: boolean
  item: StockUnitRecord
  products: StockProductRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [productId, setProductId] = useState(item.product_id)
  const [manufacturer, setManufacturer] = useState(
    item.manufacturer ?? '',
  )
  const [model, setModel] = useState(item.model ?? '')
  const [serial, setSerial] = useState(
    item.serial_number ?? '',
  )
  const [condition, setCondition] =
    useState<StockCondition>(item.condition)
  const [supplier, setSupplier] = useState(
    item.supplier_name ?? '',
  )
  const [reference, setReference] = useState(
    item.purchase_reference ?? '',
  )
  const [acquiredAt, setAcquiredAt] = useState(
    item.acquired_at ?? '',
  )
  const [warrantyUntil, setWarrantyUntil] = useState(
    item.warranty_until ?? '',
  )
  const [cost, setCost] = useState(
    item.cost_amount?.toString() ?? '',
  )
  const [notes, setNotes] = useState(item.notes ?? '')

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setProductId(item.product_id)
      setManufacturer(item.manufacturer ?? '')
      setModel(item.model ?? '')
      setSerial(item.serial_number ?? '')
      setCondition(item.condition)
      setSupplier(item.supplier_name ?? '')
      setReference(item.purchase_reference ?? '')
      setAcquiredAt(item.acquired_at ?? '')
      setWarrantyUntil(item.warranty_until ?? '')
      setCost(item.cost_amount?.toString() ?? '')
      setNotes(item.notes ?? '')
      setErrorMessage(null)
    })
  }, [item, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await updateStockUnit(item.id, {
        product_id: productId,
        manufacturer,
        model,
        serial_number: serial,
        condition,
        supplier_name: supplier,
        purchase_reference: reference,
        acquired_at: acquiredAt,
        warranty_until: warrantyUntil,
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
          : 'Não foi possível atualizar o item.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Editar item"
      description={item.stock_code}
      onClose={onClose}
      widthClassName="max-w-3xl"
      footer={
        <ModalFooter
          form="edit-stock-form"
          saving={saving}
          submitLabel="Salvar"
          onClose={onClose}
        />
      }
    >
      <form
        id="edit-stock-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && <ErrorBox message={errorMessage} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Componente">
            <select
              className={inputClass}
              value={productId}
              onChange={(event) =>
                setProductId(event.target.value)
              }
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
          <Field label="Fornecedor">
            <input
              className={inputClass}
              value={supplier}
              onChange={(event) =>
                setSupplier(event.target.value)
              }
            />
          </Field>
          <Field label="Referência">
            <input
              className={inputClass}
              value={reference}
              onChange={(event) =>
                setReference(event.target.value)
              }
            />
          </Field>
          <Field label="Custo">
            <input
              className={inputClass}
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </Field>
          <Field label="Aquisição">
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

        <Field label="Observações">
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </form>
    </FormModal>
  )
}

function StockActionModal({
  mode,
  item,
  units,
  environments,
  assets,
  onClose,
  onSaved,
}: {
  mode: 'move' | 'install' | 'remove' | 'status' | null
  item: StockUnitRecord
  units: UnitRecord[]
  environments: EnvironmentRecord[]
  assets: AssetRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [unitId, setUnitId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [assetId, setAssetId] = useState('')
  const [condition, setCondition] =
    useState<StockCondition>('used')
  const [status, setStatus] = useState<
    Exclude<StockStatus, 'installed'>
  >('in_stock')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!mode) return

    queueMicrotask(() => {
      setUnitId(item.current_unit_id ?? '')
      setEnvironmentId(item.current_environment_id ?? '')
      setAssetId(assets[0]?.id ?? '')
      setCondition('used')
      setStatus(
        item.status === 'installed' ? 'in_stock' : item.status,
      )
      setReason('')
      setErrorMessage(null)
    })
  }, [assets, item, mode])

  const filteredEnvironments = environments.filter(
    (value) => !unitId || value.unit_id === unitId,
  )

  const config = {
    move: {
      title: 'Transferir item',
      description: 'A origem, destino e justificativa ficarão no histórico.',
      submit: 'Confirmar transferência',
    },
    install: {
      title: 'Instalar componente',
      description: 'A peça será vinculada a uma máquina controlada.',
      submit: 'Confirmar instalação',
    },
    remove: {
      title: 'Retirar componente',
      description: 'A peça retornará ao estoque e a instalação será encerrada.',
      submit: 'Confirmar retirada',
    },
    status: {
      title: 'Alterar status',
      description: 'A alteração exige justificativa e será auditada.',
      submit: 'Confirmar alteração',
    },
  } as const

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mode) return

    try {
      setSaving(true)
      setErrorMessage(null)

      if (mode === 'move') {
        await moveStockUnit(
          item.id,
          unitId || null,
          environmentId || null,
          reason,
        )
      } else if (mode === 'install') {
        await installStockUnit(item.id, assetId, reason)
      } else if (mode === 'remove') {
        await removeStockUnit(
          item.id,
          unitId || null,
          environmentId || null,
          condition,
          reason,
        )
      } else {
        await changeStockUnitStatus(item.id, status, reason)
      }

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a operação.',
      )
    } finally {
      setSaving(false)
    }
  }

  const currentConfig = mode ? config[mode] : config.move

  return (
    <FormModal
      open={Boolean(mode)}
      title={currentConfig.title}
      description={`${item.stock_code} · ${currentConfig.description}`}
      onClose={onClose}
      footer={
        <ModalFooter
          form="stock-action-form"
          saving={saving}
          submitLabel={currentConfig.submit}
          onClose={onClose}
        />
      }
    >
      <form
        id="stock-action-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && <ErrorBox message={errorMessage} />}

        {mode === 'install' && (
          <Field label="Ativo de destino">
            <select
              className={inputClass}
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
              required
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_code} ·{' '}
                  {[asset.manufacturer, asset.model]
                    .filter(Boolean)
                    .join(' ')}
                </option>
              ))}
            </select>
          </Field>
        )}

        {(mode === 'move' || mode === 'remove') && (
          <>
            {mode === 'remove' && (
              <Field label="Condição de retorno">
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
            )}

            <Field label={mode === 'remove' ? 'Unidade de retorno' : 'Unidade de destino'}>
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
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={mode === 'remove' ? 'Ambiente de retorno' : 'Ambiente de destino'}>
              <select
                className={inputClass}
                value={environmentId}
                onChange={(event) =>
                  setEnvironmentId(event.target.value)
                }
                disabled={!unitId}
              >
                <option value="">Sem ambiente</option>
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
          </>
        )}

        {mode === 'status' && (
          <Field label="Novo status">
            <select
              className={inputClass}
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as Exclude<
                    StockStatus,
                    'installed'
                  >,
                )
              }
            >
              <option value="in_stock">Em estoque</option>
              <option value="reserved">Reservado</option>
              <option value="maintenance">Manutenção</option>
              <option value="disposed">Descartado</option>
            </select>
          </Field>
        )}

        <Field label="Justificativa">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Informe o motivo da operação."
            required
          />
        </Field>
      </form>
    </FormModal>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
      {message}
    </div>
  )
}

function ModalFooter({
  form,
  saving,
  submitLabel,
  onClose,
}: {
  form: string
  saving: boolean
  submitLabel: string
  onClose: () => void
}) {
  return (
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
        form={form}
        disabled={saving}
        className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? 'Processando...' : submitLabel}
      </button>
    </div>
  )
}