import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from './useAuth'
import type { PermissionCode } from '../types/auth'

interface Props {
  permission?: PermissionCode
}

export function ProtectedRoute({
  permission,
}: Props) {
  const {
    user,
    loading,
    hasPermission,
  } = useAuth()

  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f6f9] p-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
          <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sky-400">
            <ShieldCheck size={17} />
          </span>

          Validando acesso
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (
    permission &&
    !hasPermission(permission)
  ) {
    return (
      <Navigate
        to="/sem-permissao"
        replace
      />
    )
  }

  return <Outlet />
}