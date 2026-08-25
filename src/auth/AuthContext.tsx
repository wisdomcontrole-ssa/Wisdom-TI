import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import {
  AuthContext,
  type AuthContextValue,
  type SignInResult,
} from './auth-context'
import {
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase'
import type {
  AccessContext,
  PermissionCode,
} from '../types/auth'

interface RawAccessContext {
  profile?: {
    id?: string
    full_name?: string
    email?: string
    active?: boolean
  }
  role?: {
    code?: string
    name?: string
  }
  permissions?: string[]
}

function normalizeAccess(raw: unknown): AccessContext {
  const value = raw as RawAccessContext | null

  if (
    !value?.profile?.id ||
    !value.profile.email ||
    !value.role?.code ||
    !value.role.name
  ) {
    throw new Error(
      'O perfil de acesso não foi encontrado. Execute a migration do Marco 02 no Supabase.',
    )
  }

  return {
    profile: {
      id: value.profile.id,
      fullName:
        value.profile.full_name?.trim() ||
        value.profile.email.split('@')[0],
      email: value.profile.email,
      active: value.profile.active !== false,
    },
    role: {
      code: value.role.code,
      name: value.role.name,
    },
    permissions: Array.isArray(value.permissions)
      ? value.permissions
      : [],
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [access, setAccess] =
    useState<AccessContext | null>(null)
  const [loading, setLoading] = useState(
    isSupabaseConfigured,
  )
  const [authError, setAuthError] =
    useState<string | null>(null)

  const loadAccessForUser = useCallback(
    async (currentUser: User) => {
      if (!supabase) {
        return null
      }

      const { data, error } = await supabase.rpc(
        'get_my_access_context',
      )

      if (error) {
        throw error
      }

      const normalized = normalizeAccess(data)

      if (!normalized.profile.active) {
        await supabase.auth.signOut()

        throw new Error(
          'Este usuário está desativado no Wisdom TI.',
        )
      }

      setUser(currentUser)
      setAccess(normalized)

      return normalized
    },
    [],
  )

  const refreshAccess = useCallback(async () => {
    if (!supabase) {
      return
    }

    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser()

    if (error || !currentUser) {
      setUser(null)
      setAccess(null)
      return
    }

    await loadAccessForUser(currentUser)
  }, [loadAccessForUser])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let mounted = true

    async function bootstrap() {
      try {
        const {
          data: { user: currentUser },
          error,
        } = await supabase!.auth.getUser()

        if (!mounted) {
          return
        }

        if (error || !currentUser) {
          setUser(null)
          setAccess(null)
          return
        }

        await loadAccessForUser(currentUser)
      } catch (error) {
        if (!mounted) {
          return
        }

        setUser(null)
        setAccess(null)
        setAuthError(
          error instanceof Error
            ? error.message
            : 'Não foi possível validar a sessão.',
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) {
          return
        }

        if (!session?.user) {
          setUser(null)
          setAccess(null)
          setLoading(false)
          return
        }

        window.setTimeout(() => {
          if (!mounted) {
            return
          }

          void loadAccessForUser(session.user).catch(
            (error) => {
              if (!mounted) {
                return
              }

              setAuthError(
                error instanceof Error
                  ? error.message
                  : 'Não foi possível atualizar a sessão.',
              )
            },
          )
        }, 0)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadAccessForUser])

  const signIn = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<SignInResult> => {
      if (!supabase) {
        return {
          ok: false,
          message: 'Supabase ainda não está configurado.',
        }
      }

      try {
        setLoading(true)
        setAuthError(null)

        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })

        if (error || !data.user) {
          return {
            ok: false,
            message:
              error?.message ??
              'Não foi possível autenticar o usuário.',
          }
        }

        await loadAccessForUser(data.user)

        return { ok: true }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Não foi possível autenticar.'

        setAuthError(message)

        return {
          ok: false,
          message,
        }
      } finally {
        setLoading(false)
      }
    },
    [loadAccessForUser],
  )

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }

    setUser(null)
    setAccess(null)
    setAuthError(null)
  }, [])

  const hasPermission = useCallback(
    (permission: PermissionCode | string) =>
      access?.permissions.includes(permission) ?? false,
    [access],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      access,
      loading,
      authError,
      signIn,
      signOut,
      refreshAccess,
      hasPermission,
    }),
    [
      user,
      access,
      loading,
      authError,
      signIn,
      signOut,
      refreshAccess,
      hasPermission,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}