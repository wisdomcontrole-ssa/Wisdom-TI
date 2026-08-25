import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type {
  AccessContext,
  PermissionCode,
} from '../types/auth'

export interface SignInResult {
  ok: boolean
  message?: string
}

export interface AuthContextValue {
  user: User | null
  access: AccessContext | null
  loading: boolean
  authError: string | null
  signIn: (
    email: string,
    password: string,
  ) => Promise<SignInResult>
  signOut: () => Promise<void>
  refreshAccess: () => Promise<void>
  hasPermission: (
    permission: PermissionCode | string,
  ) => boolean
}

export const AuthContext =
  createContext<AuthContextValue | null>(null)