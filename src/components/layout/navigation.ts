import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardCheck,

  ClipboardClock,
  LayoutDashboard,
  MapPin,
  Monitor,

  Printer,
  Search,
  ScrollText,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type {
  PermissionCode,
} from '../../types/auth'

export interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
  permission: PermissionCode
  mobile?: boolean
}

export const mainNavigation: NavigationItem[] = [
  {
    label: 'Visão geral',
    path: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
    mobile: true,
  },
  {
    label: 'Patrimônio',
    path: '/patrimonio',
    icon: Monitor,
    permission: 'assets.view',
    mobile: true,
  },
  {
    label: 'Manutenções',
    path: '/manutencoes',
    icon: Wrench,
    permission: 'assets.view',
    mobile: true,
  },
  {
    label: 'Estoque',
    path: '/estoque',
    icon: Boxes,
    permission: 'stock.view',
    mobile: true,
  },
  {
    label: 'Auditorias',
    path: '/auditorias',
    icon: ClipboardCheck,
    permission: 'audits.view',
    mobile: true,
  },
  {
    label: 'Alertas',
    path: '/alertas',
    icon: Bell,
    permission: 'alerts.view',
  },
  {
    label: 'Ambientes',
    path: '/ambientes',
    icon: MapPin,
    permission: 'locations.view',
  },
  {
    label: 'Relatórios',
    path: '/relatorios',
    icon: BarChart3,
    permission: 'reports.view',
  },
  {
    label: 'Cadastros pendentes',
    path: '/pendencias-cadastro',
    icon: ClipboardClock,
    permission: 'assets.view',
  },
  {
    label: 'Localizar ativo',
    path: '/localizar-ativo',
    icon: Search,
    permission: 'assets.view',
  },  {
    label: 'Etiquetas',
    path: '/etiquetas',
    icon: Printer,
    permission: 'assets.view',
  },]

export const adminNavigation: NavigationItem[] = [
  {
    label: 'Usuários',
    path: '/usuarios',
    icon: Users,
    permission: 'users.view',
  },
  {
    label: 'Logs',
    path: '/logs',
    icon: ScrollText,
    permission: 'logs.view',
  },
  {
    label: 'Configurações',
    path: '/configuracoes',
    icon: Settings,
    permission: 'settings.view',
  },
]
