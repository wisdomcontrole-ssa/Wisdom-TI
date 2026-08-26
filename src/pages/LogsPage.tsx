import {
  AlertCircle,
  Braces,
  RefreshCw,
  Search,
  ScrollText,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import {
  listAdminUsers,
  listAuditLogs,
} from '../data/admin-service'
import type {
  AdminUserRecord,
  AuditLogRecord,
} from '../types/admin'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

export function LogsPage() {
  const [logs, setLogs] =
    useState<AuditLogRecord[]>([])
  const [users, setUsers] =
    useState<AdminUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [entityFilter, setEntityFilter] =
    useState('all')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)

      const [logRows, userRows] =
        await Promise.all([
          listAuditLogs(750),
          listAdminUsers(),
        ])

      setLogs(logRows)
      setUsers(userRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os logs.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const [logRows, userRows] =
          await Promise.all([
            listAuditLogs(750),
            listAdminUsers(),
          ])

        if (cancelled) {
          return
        }

        setLogs(logRows)
        setUsers(userRows)
      } catch (error) {
        if (cancelled) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os logs.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const userMap = useMemo(
    () =>
      new Map(
        users.map((user) => [
          user.id,
          user,
        ]),
      ),
    [users],
  )

  const entityTypes = useMemo(
    () =>
      Array.from(
        new Set(
          logs.map((log) => log.entity_type),
        ),
      ).sort(),
    [logs],
  )

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()

    return logs.filter((log) => {
      if (
        entityFilter !== 'all' &&
        log.entity_type !== entityFilter
      ) {
        return false
      }

      if (!clean) {
        return true
      }

      const actor = log.actor_user_id
        ? userMap.get(log.actor_user_id)
        : null

      return [
        log.action,
        log.entity_type,
        log.entity_id ?? '',
        actor?.full_name ?? '',
        actor?.email ?? '',
        JSON.stringify(log.metadata ?? {}),
      ]
        .join(' ')
        .toLowerCase()
        .includes(clean)
    })
  }, [
    entityFilter,
    logs,
    query,
    userMap,
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Logs de auditoria"
        description="Trilha não destrutiva das operações críticas do sistema."
      />

      <SectionCard>
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Buscar ação, entidade ou usuário"
                className={`${inputClass} pl-9`}
              />
            </div>

            <select
              value={entityFilter}
              onChange={(event) =>
                setEntityFilter(
                  event.target.value,
                )
              }
              className={inputClass}
            >
              <option value="all">
                Todas as entidades
              </option>
              {entityTypes.map((entity) => (
                <option
                  key={entity}
                  value={entity}
                >
                  {entity}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={
                  loading ? 'animate-spin' : ''
                }
              />
              Atualizar
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="flex items-start gap-3 p-5 text-sm text-red-700">
            <AlertCircle size={17} />
            {errorMessage}
          </div>
        ) : loading && logs.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-slate-400">
            <RefreshCw
              size={18}
              className="animate-spin"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Nenhum evento encontrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((log) => {
              const actor = log.actor_user_id
                ? userMap.get(log.actor_user_id)
                : null

              return (
                <details
                  key={log.id}
                  className="group"
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3 p-4 transition hover:bg-slate-50 sm:p-5">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                      <ScrollText size={15} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {log.action}
                        </span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                          {log.entity_type}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {actor?.full_name ??
                          actor?.email ??
                          'Sistema / usuário não disponível'}
                      </div>

                      <div className="mt-1 text-[10px] text-slate-400">
                        {new Date(
                          log.created_at,
                        ).toLocaleString('pt-BR')}
                        {log.entity_id
                          ? ` · ${log.entity_id}`
                          : ''}
                      </div>
                    </div>

                    <Braces
                      size={15}
                      className="mt-1 shrink-0 text-slate-300"
                    />
                  </summary>

                  <div className="grid gap-3 bg-slate-50/70 px-4 pb-5 pt-1 sm:grid-cols-3 sm:px-5">
                    <JsonBlock
                      title="Anterior"
                      value={log.old_data}
                    />
                    <JsonBlock
                      title="Posterior"
                      value={log.new_data}
                    />
                    <JsonBlock
                      title="Metadados"
                      value={log.metadata}
                    />
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function JsonBlock({
  title,
  value,
}: {
  title: string
  value: unknown
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {title}
      </div>
      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-slate-600">
        {value == null
          ? '—'
          : JSON.stringify(
              value,
              null,
              2,
            )}
      </pre>
    </div>
  )
}
