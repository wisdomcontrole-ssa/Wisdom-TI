import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Mail,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Wrench,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
} from 'react-router'
import { ExpressAssetModal } from '../components/assets/ExpressAssetModal'
import { PageHeader } from '../components/ui/PageHeader'
import {
  listAssets,
} from '../data/asset-service'
import {
  convertMaintenanceRequest,
  linkMaintenanceRequestAsset,
  listMaintenanceRequests,
  receiveMaintenanceRequest,
  type MaintenanceRequestRecord,
  type MaintenanceRequestStatus,
} from '../data/maintenance-request-service'
import { buildMaintenanceWhatsAppUrl } from '../data/maintenance-notification-service'
import type {
  AssetRecord,
} from '../types/assets'
import type {
  MaintenancePriority,
} from '../types/maintenance'

const statusLabels: Record<
  MaintenanceRequestStatus,
  string
> = {
  submitted: 'Novo',
  received: 'Recebido',
  waiting_asset: 'Aguardando patrimônio',
  converted: 'Convertido em manutenção',
  resolved: 'Resolvido',
  cancelled: 'Cancelado',
}

const activeStatuses: MaintenanceRequestStatus[] =
  [
    'submitted',
    'received',
    'waiting_asset',
  ]

export function MaintenanceRequestsPage() {
  const navigate = useNavigate()

  const [requests, setRequests] =
    useState<MaintenanceRequestRecord[]>(
      [],
    )
  const [assets, setAssets] = useState<
    AssetRecord[]
  >([])
  const [loading, setLoading] =
    useState(true)
  const [busyId, setBusyId] =
    useState<string | null>(null)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<
    MaintenanceRequestStatus | 'active' | 'all'
  >('active')
  const [
    selectedAssets,
    setSelectedAssets,
  ] = useState<Record<string, string>>({})
  const [priorities, setPriorities] =
    useState<
      Record<string, MaintenancePriority>
    >({})
  const [expressRequestId, setExpressRequestId] =
    useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const [requestRows, assetRows] =
        await Promise.all([
          listMaintenanceRequests(),
          listAssets(),
        ])

      setRequests(requestRows)
      setAssets(assetRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os chamados.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const assetMap = useMemo(
    () =>
      new Map(
        assets.map((asset) => [
          asset.id,
          asset,
        ]),
      ),
    [assets],
  )

  const filtered = useMemo(() => {
    const term =
      search.trim().toLowerCase()

    return requests.filter((request) => {
      if (
        status === 'active' &&
        !activeStatuses.includes(
          request.status,
        )
      ) {
        return false
      }

      if (
        status !== 'active' &&
        status !== 'all' &&
        request.status !== status
      ) {
        return false
      }

      if (!term) return true

      return [
        request.request_code,
        request.requester_name,
        request.requester_contact,
        request.requester_email,
        request.requester_whatsapp,
        request.origin_organization,
        request.origin_unit,
        request.origin_environment,
        request.known_identifier,
        request.summary_text,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [requests, search, status])

  const metrics = useMemo(
    () => ({
      new: requests.filter(
        (item) =>
          item.status === 'submitted',
      ).length,
      received: requests.filter(
        (item) =>
          item.status === 'received',
      ).length,
      waiting: requests.filter(
        (item) =>
          item.status ===
          'waiting_asset',
      ).length,
      converted: requests.filter(
        (item) =>
          item.status === 'converted',
      ).length,
    }),
    [requests],
  )

  async function receive(
    request: MaintenanceRequestRecord,
  ) {
    try {
      setBusyId(request.id)
      setErrorMessage(null)

      await receiveMaintenanceRequest(
        request.id,
        request.equipment_items,
      )

      await load()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar o recebimento.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function linkAsset(
    requestId: string,
  ) {
    const assetId =
      selectedAssets[requestId]

    if (!assetId) return

    try {
      setBusyId(requestId)
      setErrorMessage(null)

      await linkMaintenanceRequestAsset(
        requestId,
        assetId,
      )

      await load()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível vincular o patrimônio.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function convert(
    requestId: string,
  ) {
    try {
      setBusyId(requestId)
      setErrorMessage(null)

      const result =
        await convertMaintenanceRequest(
          requestId,
          priorities[requestId] ??
            'normal',
        )

      navigate(
        `/manutencoes/${result.maintenanceId}`,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir a manutenção.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Central de atendimento"
        title="Chamados"
        description="Solicitações públicas, triagem, recebimento, patrimônio e abertura da manutenção."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/suporte"
              target="_blank"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
            >
              <ExternalLink size={14} />
              Portal público
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500"
              aria-label="Atualizar chamados"
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
          </div>
        }
      />

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Novos"
          value={metrics.new}
        />
        <Metric
          label="Recebidos"
          value={metrics.received}
        />
        <Metric
          label="Aguardando patrimônio"
          value={metrics.waiting}
        />
        <Metric
          label="Convertidos"
          value={metrics.converted}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Buscar protocolo, solicitante, local ou identificação"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as
                  | MaintenanceRequestStatus
                  | 'active'
                  | 'all',
              )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
          >
            <option value="active">
              Chamados em atendimento
            </option>
            <option value="all">
              Todos
            </option>
            <option value="submitted">
              Novos
            </option>
            <option value="received">
              Recebidos
            </option>
            <option value="waiting_asset">
              Aguardando patrimônio
            </option>
            <option value="converted">
              Convertidos
            </option>
          </select>
        </div>
      </section>

      <section className="space-y-3">
        {loading &&
        requests.length === 0 ? (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white">
            <RefreshCw
              size={18}
              className="animate-spin text-slate-400"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
            Nenhum chamado encontrado.
          </div>
        ) : (
          filtered.map((request) => {
            const linkedAsset =
              request.asset_id
                ? assetMap.get(
                    request.asset_id,
                  )
                : undefined

            return (
              <article
                key={request.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] font-black text-sky-700">
                      {request.request_code}
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-950">
                      {request.requester_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[
                        request.origin_organization,
                        request.origin_unit,
                        request.origin_environment,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    {
                      statusLabels[
                        request.status
                      ]
                    }
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-700">
                  {request.summary_text}
                </p>

                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <Info
                    label="E-mail"
                    value={
                      request.requester_email ??
                      'Não informado'
                    }
                  />
                  <Info
                    label="WhatsApp"
                    value={
                      request.requester_whatsapp ??
                      'Não informado'
                    }
                  />
                  <Info
                    label="Identificação"
                    value={
                      request.known_identifier ??
                      'Não informada'
                    }
                  />
                  <Info
                    label="Equipamento"
                    value={[
                      request.manufacturer,
                      request.model,
                      request.serial_number,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {request.notify_email &&
                    request.requester_email && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">
                        <Mail size={12} />
                        Atualizações por e-mail
                      </span>
                    )}

                  {request.notify_whatsapp &&
                    request.requester_whatsapp &&
                    (() => {
                      const url =
                        buildMaintenanceWhatsAppUrl(
                          request.requester_whatsapp,
                          `Olá ${request.requester_name}. Atualização do chamado ${request.request_code}: ${statusLabels[request.status]}.`,
                        )

                      return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                        >
                          <MessageCircle
                            size={12}
                          />
                          Enviar WhatsApp
                        </a>
                      ) : null
                    })()}
                </div>

                <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                      <PackageCheck
                        size={14}
                      />
                      Recebimento
                    </div>

                    {request.received_at ? (
                      <div className="mt-2 text-xs text-emerald-700">
                        Recebido em{' '}
                        {new Date(
                          request.received_at,
                        ).toLocaleString(
                          'pt-BR',
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          busyId ===
                          request.id
                        }
                        onClick={() =>
                          void receive(
                            request,
                          )
                        }
                        className="mt-2 h-9 w-full rounded-lg bg-slate-950 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Registrar recebimento
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                      <Link2 size={14} />
                      Patrimônio
                    </div>

                    {linkedAsset ? (
                      <div className="mt-2">
                        <div className="font-mono text-[11px] font-black text-emerald-700">
                          {
                            linkedAsset.asset_code
                          }
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {[
                            linkedAsset.manufacturer,
                            linkedAsset.model,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        </div>
                      </div>
                    ) : (
                      <>
                        <select
                          value={
                            selectedAssets[
                              request.id
                            ] ?? ''
                          }
                          onChange={(
                            event,
                          ) =>
                            setSelectedAssets(
                              (current) => ({
                                ...current,
                                [request.id]:
                                  event.target
                                    .value,
                              }),
                            )
                          }
                          className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="">
                            Selecionar existente
                          </option>
                          {assets
                            .filter(
                              (asset) =>
                                asset.status !==
                                'disposed',
                            )
                            .map(
                              (asset) => (
                                <option
                                  key={
                                    asset.id
                                  }
                                  value={
                                    asset.id
                                  }
                                >
                                  {
                                    asset.asset_code
                                  }{' '}
                                  ·{' '}
                                  {[
                                    asset.manufacturer,
                                    asset.model,
                                  ]
                                    .filter(
                                      Boolean,
                                    )
                                    .join(
                                      ' ',
                                    )}
                                </option>
                              ),
                            )}
                        </select>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={
                              busyId ===
                                request.id ||
                              !selectedAssets[
                                request.id
                              ]
                            }
                            onClick={() =>
                              void linkAsset(
                                request.id,
                              )
                            }
                            className="h-9 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 disabled:opacity-40"
                          >
                            Vincular
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setExpressRequestId(
                                request.id,
                              )
                            }
                            className="h-9 rounded-lg bg-sky-50 text-[11px] font-bold text-sky-800"
                          >
                            Cadastrar
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                      <Wrench size={14} />
                      Manutenção
                    </div>

                    {request.maintenance_id ? (
                      <Link
                        to={`/manutencoes/${request.maintenance_id}`}
                        className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800"
                      >
                        Abrir ordem
                        <ExternalLink
                          size={12}
                        />
                      </Link>
                    ) : (
                      <>
                        <select
                          value={
                            priorities[
                              request.id
                            ] ??
                            'normal'
                          }
                          onChange={(
                            event,
                          ) =>
                            setPriorities(
                              (current) => ({
                                ...current,
                                [request.id]:
                                  event.target
                                    .value as MaintenancePriority,
                              }),
                            )
                          }
                          className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="low">
                            Baixa
                          </option>
                          <option value="normal">
                            Normal
                          </option>
                          <option value="high">
                            Alta
                          </option>
                          <option value="critical">
                            Crítica
                          </option>
                        </select>

                        <button
                          type="button"
                          disabled={
                            busyId ===
                              request.id ||
                            !request.asset_id ||
                            !request.received_at
                          }
                          onClick={() =>
                            void convert(
                              request.id,
                            )
                          }
                          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-xs font-bold text-white disabled:opacity-30"
                        >
                          <CheckCircle2
                            size={13}
                          />
                          Abrir manutenção
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })
        )}
      </section>

      <ExpressAssetModal
        open={Boolean(expressRequestId)}
        onClose={() =>
          setExpressRequestId(null)
        }
        onCreated={async (
          assetId,
          warning,
        ) => {
          if (!expressRequestId) return

          try {
            await linkMaintenanceRequestAsset(
              expressRequestId,
              assetId,
            )
            setExpressRequestId(null)
            await load()

            if (warning) {
              setErrorMessage(warning)
            }
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'O patrimônio foi criado, mas não foi possível vinculá-lo ao chamado.',
            )
          }
        }}
      />
    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-slate-950">
        {value}
      </div>
    </div>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-700">
        {value || '—'}
      </div>
    </div>
  )
}
