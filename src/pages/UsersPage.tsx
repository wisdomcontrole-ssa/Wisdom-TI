import {
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusPill } from '../components/ui/StatusPill'
import { supabase } from '../lib/supabase'

interface UserRow {
  id: string
  full_name: string
  email: string
  active: boolean
  created_at: string
  roles:
    | {
        code: string
        name: string
      }
    | null
}

async function fetchUsers(): Promise<UserRow[]> {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, active, created_at, roles(code, name)',
    )
    .order('full_name', {
      ascending: true,
    })

  if (error) {
    throw error
  }

  return (data ?? []) as unknown as UserRow[]
}

export function UsersPage() {
  const [users, setUsers] =
    useState<UserRow[]>([])
  const [loading, setLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const loadUsers = useCallback(
    async (showLoading: boolean) => {
      try {
        if (showLoading) {
          setLoading(true)
        }

        setErrorMessage(null)

        const rows = await fetchUsers()

        setUsers(rows)
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os usuários.',
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const rows = await fetchUsers()

        if (!active) {
          return
        }

        setUsers(rows)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os usuários.',
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description="Contas autorizadas, situação e perfil de acesso."
        actions={
          <button
            type="button"
            onClick={() =>
              void loadUsers(true)
            }
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? 'animate-spin'
                  : undefined
              }
            />
            Atualizar
          </button>
        }
      />

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0"
          />
          <span>{errorMessage}</span>
        </div>
      )}

      <SectionCard
        title="Acessos"
        description="Dados carregados diretamente do Supabase"
      >
        {loading ? (
          <div className="flex items-center gap-3 px-5 py-10 text-sm font-semibold text-slate-400">
            <RefreshCw
              size={16}
              className="animate-spin"
            />
            Carregando usuários
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 px-5 py-4"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
                  <UserRound size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">
                    {user.full_name ||
                      user.email.split('@')[0]}
                  </div>

                  <div className="mt-0.5 truncate text-[11px] text-slate-400">
                    {user.email}
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <ShieldCheck size={12} />
                    {user.roles?.name ??
                      'Perfil não definido'}
                  </div>
                </div>

                <StatusPill
                  tone={
                    user.active
                      ? 'success'
                      : 'danger'
                  }
                >
                  {user.active
                    ? 'Ativo'
                    : 'Desativado'}
                </StatusPill>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}