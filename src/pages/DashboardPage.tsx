import {
  Building2,
  History,
  MapPin,
  Monitor,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import {
  listAssets,
  listEnvironments,
  listRecentMovements,
  listUnits,
} from '../data/asset-service'
import type {
  AssetMovementRecord,
  AssetRecord,
  EnvironmentRecord,
  UnitRecord,
} from '../types/assets'

export function DashboardPage() {
  const [assets, setAssets] = useState<AssetRecord[]>(
    [],
  )
  const [units, setUnits] = useState<UnitRecord[]>([])
  const [environments, setEnvironments] =
    useState<EnvironmentRecord[]>([])
  const [movements, setMovements] =
    useState<AssetMovementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const [
          assetRows,
          unitRows,
          environmentRows,
          movementRows,
        ] = await Promise.all([
          listAssets(),
          listUnits(),
          listEnvironments(),
          listRecentMovements(),
        ])

        if (!active) {
          return
        }

        setAssets(assetRows)
        setUnits(unitRows)
        setEnvironments(environmentRows)
        setMovements(movementRows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os indicadores.',
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

  const maintenance = assets.filter(
    (asset) => asset.status === 'maintenance',
  ).length

  const activeAssets = assets.filter(
    (asset) => asset.status === 'active',
  ).length

  const cards = [
    {
      label: 'Ativos controlados',
      value: assets.length,
      detail: `${activeAssets} em operação`,
      icon: Monitor,
    },
    {
      label: 'Unidades',
      value: units.filter((unit) => unit.active).length,
      detail: `${environments.filter((item) => item.active).length} ambientes ativos`,
      icon: Building2,
    },
    {
      label: 'Em manutenção',
      value: maintenance,
      detail: 'Situação patrimonial',
      icon: Wrench,
    },
    {
      label: 'Sem localização',
      value: assets.filter(
        (asset) => !asset.current_unit_id,
      ).length,
      detail: 'Requer organização',
      icon: MapPin,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Visão geral"
        description="Situação atual do patrimônio e da estrutura física."
      />

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <section
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <Icon size={16} />
              </div>

              <div className="mt-5 text-2xl font-bold tracking-[-0.04em] text-slate-950">
                {loading ? '—' : card.value}
              </div>

              <div className="mt-1 text-xs font-bold text-slate-800">
                {card.label}
              </div>

              <div className="mt-2 text-[11px] text-slate-400">
                {card.detail}
              </div>
            </section>
          )
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
            {loading ? (
              <RefreshCw
                size={15}
                className="animate-spin"
              />
            ) : (
              <History size={16} />
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-950">
              Movimentações recentes
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Histórico real do patrimônio
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
              const destinationEnvironment =
                environmentMap.get(
                  movement.to_environment_id ?? '',
                )
              const destinationUnit =
                unitMap.get(
                  movement.to_unit_id ?? '',
                )

              return (
                <div
                  key={movement.id}
                  className="flex items-start gap-3 px-5 py-4"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400">
                    <MapPin size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">
                      {movement.movement_type ===
                      'registration'
                        ? 'Ativo registrado'
                        : 'Movimentação registrada'}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Destino:{' '}
                      {destinationEnvironment?.name ??
                        destinationUnit?.name ??
                        'sem local'}
                    </div>

                    <div className="mt-1 text-[10px] text-slate-400">
                      {new Date(
                        movement.moved_at,
                      ).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}