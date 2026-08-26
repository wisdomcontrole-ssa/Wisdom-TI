import {
  AlertCircle,
  Boxes,
  ClipboardCheck,
  Download,
  Laptop,
  RefreshCw,
  Search,
  ShieldAlert,
  Wifi,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import {
  downloadReportCsv,
  getOperationalReport,
} from '../data/m10-service'
import type {
  ReportKind,
  ReportRow,
} from '../types/m10'

const reports: Array<{
  kind: ReportKind
  label: string
  description: string
  icon: LucideIcon
}> = [
  {
    kind: 'assets',
    label: 'Patrimônio',
    description:
      'Ativos, localização, serial, sistema e status.',
    icon: Laptop,
  },
  {
    kind: 'stock',
    label: 'Estoque',
    description:
      'Componentes, condição, localização e vínculo.',
    icon: Boxes,
  },
  {
    kind: 'audits',
    label: 'Auditorias',
    description:
      'Ciclos, encontrados, ausentes e divergentes.',
    icon: ClipboardCheck,
  },
  {
    kind: 'maintenance',
    label: 'Manutenções',
    description:
      'Ordens, prioridade, custos e situação.',
    icon: Wrench,
  },
  {
    kind: 'alerts',
    label: 'Alertas',
    description:
      'Severidade, tratamento e resolução.',
    icon: ShieldAlert,
  },
  {
    kind: 'agents',
    label: 'Agentes',
    description:
      'Conectividade, versão, inventário e divergências.',
    icon: Wifi,
  },
]

export function ReportsPage() {
  const [kind, setKind] =
    useState<ReportKind>('assets')
  const [rows, setRows] =
    useState<ReportRow[]>([])
  const [loading, setLoading] =
    useState(true)
  const [query, setQuery] =
    useState('')
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setErrorMessage(null)

        const data =
          await getOperationalReport(kind)

        if (active) {
          setRows(data)
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o relatório.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [kind])

  const filtered = useMemo(() => {
    const clean =
      query.trim().toLowerCase()

    if (!clean) {
      return rows
    }

    return rows.filter((row) =>
      Object.values(row)
        .map(formatCell)
        .join(' ')
        .toLowerCase()
        .includes(clean),
    )
  }, [query, rows])

  const columns = useMemo(
    () =>
      Array.from(
        new Set(
          filtered.flatMap((row) =>
            Object.keys(row),
          ),
        ),
      ),
    [filtered],
  )

  const selected =
    reports.find(
      (report) =>
        report.kind === kind,
    ) ?? reports[0]

  async function refresh() {
    try {
      setLoading(true)
      setErrorMessage(null)
      setRows(
        await getOperationalReport(kind),
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o relatório.',
      )
    } finally {
      setLoading(false)
    }
  }

  function exportCsv() {
    try {
      downloadReportCsv(
        `inventario-ti-${kind}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`,
        filtered,
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível exportar.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão"
        title="Relatórios"
        description="Consultas operacionais consolidadas com exportação CSV."
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={
              loading ||
              filtered.length === 0
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {reports.map((report) => {
          const Icon = report.icon
          const active =
            report.kind === kind

          return (
            <button
              key={report.kind}
              type="button"
              onClick={() => {
                setKind(report.kind)
                setQuery('')
              }}
              className={
                active
                  ? 'rounded-2xl border border-slate-950 bg-slate-950 p-4 text-left text-white shadow-sm'
                  : 'rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-700 shadow-sm hover:bg-slate-50'
              }
            >
              <Icon
                size={17}
                className={
                  active
                    ? 'text-sky-400'
                    : 'text-slate-400'
                }
              />
              <div className="mt-3 text-xs font-bold">
                {report.label}
              </div>
              <div
                className={
                  active
                    ? 'mt-1 text-[9px] leading-4 text-slate-400'
                    : 'mt-1 text-[9px] leading-4 text-slate-400'
                }
              >
                {report.description}
              </div>
            </button>
          )
        })}
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={17} />
          {errorMessage}
        </div>
      )}

      <SectionCard>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold text-slate-900">
              {selected.label}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              {loading
                ? 'Carregando...'
                : `${filtered.length} registros exibidos`}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative min-w-0 sm:w-72">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
                placeholder="Filtrar relatório"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void refresh()
              }
              disabled={loading}
              className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 disabled:opacity-50"
              aria-label="Atualizar relatório"
            >
              <RefreshCw
                size={14}
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />
            </button>
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="grid min-h-64 place-items-center">
            <RefreshCw
              size={18}
              className="animate-spin text-slate-400"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Nenhum registro neste relatório.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-4 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"
                    >
                      {columnLabel(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(
                  (row, rowIndex) => (
                    <tr
                      key={`${kind}-${rowIndex}`}
                      className="hover:bg-slate-50/60"
                    >
                      {columns.map(
                        (column) => (
                          <td
                            key={column}
                            className="max-w-72 whitespace-nowrap px-4 py-3 text-[10px] text-slate-600"
                            title={formatCell(
                              row[column],
                            )}
                          >
                            <span className="block max-w-72 truncate">
                              {formatCell(
                                row[column],
                              ) || '—'}
                            </span>
                          </td>
                        ),
                      )}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function formatCell(value: unknown) {
  if (value == null) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('pt-BR')
    }
  }

  return String(value)
}

function columnLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
}
