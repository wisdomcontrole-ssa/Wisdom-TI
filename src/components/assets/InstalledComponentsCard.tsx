import {
  Boxes,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import {
  listAssetComponents,
  listStockProducts,
  listStockUnits,
} from '../../data/stock-service'
import type {
  AssetComponentRecord,
  StockProductRecord,
  StockUnitRecord,
} from '../../types/stock'

export function InstalledComponentsCard({
  assetId,
}: {
  assetId: string
}) {
  const [links, setLinks] =
    useState<AssetComponentRecord[]>([])
  const [items, setItems] =
    useState<StockUnitRecord[]>([])
  const [products, setProducts] =
    useState<StockProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const [
          componentRows,
          itemRows,
          productRows,
        ] = await Promise.all([
          listAssetComponents(assetId),
          listStockUnits(),
          listStockProducts(),
        ])

        if (!active) {
          return
        }

        setLinks(componentRows)
        setItems(itemRows)
        setProducts(productRows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os componentes instalados.',
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

  const activeLinks = useMemo(
    () => links.filter((link) => !link.removed_at),
    [links],
  )

  const itemMap = useMemo(
    () =>
      new Map(
        items.map((item) => [item.id, item]),
      ),
    [items],
  )

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ]),
      ),
    [products],
  )

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
          {loading ? (
            <RefreshCw
              size={15}
              className="animate-spin"
            />
          ) : (
            <Boxes size={16} />
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-950">
            Componentes instalados
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Peças do estoque atualmente vinculadas a esta máquina
          </p>
        </div>
      </header>

      {errorMessage ? (
        <div className="px-5 py-5 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : activeLinks.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">
          Nenhum componente controlado está instalado.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {activeLinks.map((link) => {
            const item = itemMap.get(
              link.stock_unit_id,
            )
            const product = item
              ? productMap.get(item.product_id)
              : undefined

            return (
              <Link
                key={link.id}
                to={`/estoque/${link.stock_unit_id}`}
                className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                  <Boxes size={15} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">
                    {product?.name ?? 'Componente'}
                  </div>

                  <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                    {item?.stock_code ??
                      link.stock_unit_id}
                    {item?.serial_number
                      ? ` · ${item.serial_number}`
                      : ''}
                  </div>
                </div>

                <ChevronRight
                  size={15}
                  className="text-slate-300"
                />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
