import { supabase } from '../lib/supabase'
import type {
  DashboardSummary,
  ReportKind,
  ReportRow,
} from '../types/m10'

function client() {
  if (!supabase) {
    throw new Error('Supabase não está configurado.')
  }

  return supabase
}

function throwIfError(
  error: { message: string } | null,
) {
  if (error) {
    throw new Error(error.message)
  }
}

export async function getDashboardSummary() {
  const { data, error } =
    await client().rpc(
      'get_dashboard_summary',
    )

  throwIfError(error)

  return data as DashboardSummary
}

export async function getOperationalReport(
  report: ReportKind,
) {
  const { data, error } =
    await client().rpc(
      'get_operational_report',
      {
        p_report: report,
      },
    )

  throwIfError(error)

  return (Array.isArray(data)
    ? data
    : []) as ReportRow[]
}

export function downloadReportCsv(
  filename: string,
  rows: ReportRow[],
) {
  if (rows.length === 0) {
    throw new Error(
      'Não há dados para exportar.',
    )
  }

  const columns = Array.from(
    new Set(
      rows.flatMap((row) =>
        Object.keys(row),
      ),
    ),
  )

  const lines = [
    columns.map(csvCell).join(';'),
    ...rows.map((row) =>
      columns
        .map((column) =>
          csvCell(
            normalizeCsvValue(
              row[column],
            ),
          ),
        )
        .join(';'),
    ),
  ]

  const blob = new Blob(
    ['\uFEFF', lines.join('\r\n')],
    {
      type: 'text/csv;charset=utf-8',
    },
  )

  const url =
    URL.createObjectURL(blob)
  const link =
    document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function normalizeCsvValue(
  value: unknown,
) {
  if (value == null) {
    return ''
  }

  if (
    typeof value === 'object'
  ) {
    return JSON.stringify(value)
  }

  return String(value)
}

function csvCell(value: unknown) {
  const text = String(
    value ?? '',
  ).replaceAll('"', '""')

  return `"${text}"`
}
