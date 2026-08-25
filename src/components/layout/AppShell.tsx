import { useMemo, useState } from 'react'
import { Bell, Menu, Search, X } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { WisdomMark } from '../brand/WisdomMark'
import { cn } from '../../lib/cn'
import { useAuth } from '../../auth/useAuth'
import { mainNavigation } from './navigation'
import { SidebarContent } from './SidebarContent'

const titles: Record<string, string> = {
  '/dashboard': 'Visão geral',
  '/patrimonio': 'Patrimônio',
  '/estoque': 'Estoque',
  '/auditorias': 'Auditorias',
  '/alertas': 'Alertas',
  '/ambientes': 'Ambientes',
  '/usuarios': 'Usuários',
  '/configuracoes': 'Configurações',
  '/sem-permissao': 'Acesso',
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TI'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase()
}

export function AppShell() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { access, hasPermission } = useAuth()
  const pageTitle = titles[location.pathname] ?? 'Wisdom TI'

  const mobileNavigation = useMemo(
    () => mainNavigation.filter((item) => item.mobile && hasPermission(item.permission)),
    [hasPermission],
  )

  const fullName = access?.profile.fullName ?? 'Usuário Wisdom'
  const roleName = access?.role.name ?? 'Acesso interno'

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block"><SidebarContent /></aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <button type="button" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" />
          <aside className="absolute inset-y-0 left-0 w-[286px] max-w-[86vw] shadow-2xl">
            <button type="button" onClick={() => setDrawerOpen(false)} className="absolute right-3 top-4 z-10 grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Fechar menu"><X size={18} /></button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[64px] items-center border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:h-[72px] lg:px-8">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu" className="grid size-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={19} /></button>
              <div className="lg:hidden"><WisdomMark compact /></div>
              <div className="hidden sm:block">
                <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">Wisdom TI</div>
                <div className="text-sm font-bold text-slate-900">{pageTitle}</div>
              </div>
            </div>

            <button type="button" className="hidden h-10 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-left text-sm text-slate-400 hover:bg-white lg:flex">
              <Search size={16} /><span className="flex-1">Buscar ativo, serial ou ambiente</span><kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
            </button>

            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Buscar" className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"><Search size={18} /></button>
              <button type="button" aria-label="Notificações" className="relative grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Bell size={18} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500 ring-2 ring-white" /></button>
              <div className="ml-1 hidden items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
                <div className="grid size-9 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-white">{getInitials(fullName)}</div>
                <div className="hidden xl:block">
                  <div className="max-w-40 truncate text-xs font-bold text-slate-900">{fullName}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">{roleName}</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8"><Outlet /></main>
      </div>

      {mobileNavigation.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileNavigation.length}, minmax(0, 1fr))` }}>
            {mobileNavigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.path} to={item.path} className={({ isActive }) => cn('flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold', isActive ? 'text-slate-950' : 'text-slate-400')}>
                  {({ isActive }) => (
                    <><div className={cn('grid size-7 place-items-center rounded-lg', isActive && 'bg-slate-950 text-white')}><Icon size={16} /></div><span>{item.label}</span></>
                  )}
                </NavLink>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
