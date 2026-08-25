import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import type { PermissionCode } from '../types/auth'

interface Props {
  permission: PermissionCode
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: Props) {
  const { hasPermission } = useAuth()

  return hasPermission(permission)
    ? children
    : fallback
}