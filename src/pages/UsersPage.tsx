import {
  AlertCircle,
  Check,
  MailPlus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/useAuth'
import { FormModal } from '../components/ui/FormModal'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusPill } from '../components/ui/StatusPill'
import {
  inviteAdminUser,
  listAdminUsers,
  listRoles,
  updateAdminUser,
} from '../data/admin-service'
import type {
  AdminUserRecord,
  RoleRecord,
} from '../types/admin'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

export function UsersPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('users.manage')

  const [users, setUsers] =
    useState<AdminUserRecord[]>([])
  const [roles, setRoles] =
    useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] =
    useState(false)
  const [editingUser, setEditingUser] =
    useState<AdminUserRecord | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)

      const [userRows, roleRows] =
        await Promise.all([
          listAdminUsers(),
          listRoles(),
        ])

      setUsers(userRows)
      setRoles(roleRows)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar usuários.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const [userRows, roleRows] =
          await Promise.all([
            listAdminUsers(),
            listRoles(),
          ])

        if (cancelled) {
          return
        }

        setUsers(userRows)
        setRoles(roleRows)
      } catch (error) {
        if (cancelled) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar usuários.',
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

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()

    if (!clean) {
      return users
    }

    return users.filter((user) =>
      [
        user.full_name,
        user.email,
        user.role?.name ?? '',
        user.role?.code ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(clean),
    )
  }, [query, users])

  const activeCount =
    users.filter((user) => user.active).length
  const adminCount =
    users.filter(
      (user) =>
        user.active &&
        user.role?.code === 'admin',
    ).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Usuários e acessos"
        description="Contas, papéis e estado de acesso ao Wisdom TI."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              <MailPlus size={15} />
              Convidar usuário
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Usuários"
          value={users.length}
          icon={Users}
        />
        <Metric
          label="Ativos"
          value={activeCount}
          icon={Check}
        />
        <Metric
          label="Administradores"
          value={adminCount}
          icon={ShieldCheck}
        />
      </div>

      <SectionCard>
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Buscar usuário, e-mail ou papel"
                className={`${inputClass} pl-9`}
              />
            </div>

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
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0"
            />
            {errorMessage}
          </div>
        ) : loading && users.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-slate-400">
            <RefreshCw
              size={18}
              className="animate-spin"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                  <UserRound size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-900">
                      {user.full_name ||
                        user.email}
                    </span>
                    <StatusPill
                      tone={
                        user.active
                          ? 'success'
                          : 'neutral'
                      }
                    >
                      {user.active
                        ? 'Ativo'
                        : 'Inativo'}
                    </StatusPill>
                  </div>

                  <div className="mt-1 truncate text-xs text-slate-500">
                    {user.email}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      {user.role?.name ??
                        'Sem papel'}
                    </span>
                    <span>
                      Criado{' '}
                      {new Date(
                        user.created_at,
                      ).toLocaleDateString(
                        'pt-BR',
                      )}
                    </span>
                    {user.last_seen_at && (
                      <span>
                        Último acesso{' '}
                        {new Date(
                          user.last_seen_at,
                        ).toLocaleString(
                          'pt-BR',
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingUser(user)
                    }
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <Pencil size={13} />
                    Gerenciar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {inviteOpen && (
        <InviteUserModal
          roles={roles}
          onClose={() => setInviteOpen(false)}
          onDone={() => {
            setInviteOpen(false)
            void refresh()
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          key={editingUser.id}
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onDone={() => {
            setEditingUser(null)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Users
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
        {value}
      </div>
    </div>
  )
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

function InviteUserModal({
  roles,
  onClose,
  onDone,
}: {
  roles: RoleRecord[]
  onClose: () => void
  onDone: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState(
    () =>
      roles.find(
        (role) => role.code === 'viewer',
      )?.id ??
      roles[0]?.id ??
      '',
  )
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !fullName.trim() ||
      !email.trim() ||
      !roleId
    ) {
      setErrorMessage(
        'Nome, e-mail e papel são obrigatórios.',
      )
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)
      await inviteAdminUser({
        fullName,
        email,
        roleId,
      })
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível convidar o usuário.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title="Convidar usuário"
      description="O convite é emitido pelo backend seguro do Supabase."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="invite-user-form"
            disabled={saving}
            className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Enviando...'
              : 'Enviar convite'}
          </button>
        </div>
      }
    >
      <form
        id="invite-user-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Nome completo">
          <input
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            className={inputClass}
          />
        </Field>

        <Field label="Papel">
          <select
            value={roleId}
            onChange={(event) =>
              setRoleId(event.target.value)
            }
            className={inputClass}
          >
            {roles.map((role) => (
              <option
                key={role.id}
                value={role.id}
              >
                {role.name}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </FormModal>
  )
}

function EditUserModal({
  user,
  roles,
  onClose,
  onDone,
}: {
  user: AdminUserRecord
  roles: RoleRecord[]
  onClose: () => void
  onDone: () => void
}) {
  const [fullName, setFullName] = useState(
    user.full_name,
  )
  const [roleId, setRoleId] = useState(
    user.role_id,
  )
  const [active, setActive] = useState(
    user.active,
  )
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!fullName.trim() || !roleId) {
      return
    }

    try {
      setSaving(true)
      setErrorMessage(null)
      await updateAdminUser({
        userId: user.id,
        fullName,
        roleId,
        active,
      })
      onDone()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o usuário.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      title="Gerenciar usuário"
      description={user.email}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-user-form"
            disabled={saving}
            className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Salvando...'
              : 'Salvar'}
          </button>
        </div>
      }
    >
      <form
        id="edit-user-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <Field label="Nome completo">
          <input
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            className={inputClass}
          />
        </Field>

        <Field label="Papel">
          <select
            value={roleId}
            onChange={(event) =>
              setRoleId(event.target.value)
            }
            className={inputClass}
          >
            {roles.map((role) => (
              <option
                key={role.id}
                value={role.id}
              >
                {role.name}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
          <div>
            <div className="text-xs font-bold text-slate-800">
              Acesso ativo
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Usuário inativo não consegue usar o sistema.
            </div>
          </div>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) =>
              setActive(event.target.checked)
            }
            className="size-4"
          />
        </label>
      </form>
    </FormModal>
  )
}
