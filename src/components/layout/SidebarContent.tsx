import { ChevronRight, LogOut, ShieldCheck } from 'lucide-react'
import { NavLink } from 'react-router'
import { WisdomMark } from '../brand/WisdomMark'
import { cn } from '../../lib/cn'
import { useAuth } from '../../auth/useAuth'
import { adminNavigation, mainNavigation, type NavigationItem } from './navigation'

interface Props { onNavigate?: () => void }

function NavigationLink({ item, onNavigate }: { item: NavigationItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition',
          isActive
            ? 'bg-white/[0.09] text-white'
            : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-sky-400' : 'text-slate-500'} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {isActive && <ChevronRight size={14} className="text-slate-500" />}
        </>
      )}
    </NavLink>
  )
}

export function SidebarContent({ onNavigate }: Props) {
  const { hasPermission, signOut } = useAuth()
  const operationItems = mainNavigation.filter((item) => hasPermission(item.permission))
  const adminItems = adminNavigation.filter((item) => hasPermission(item.permission))

  async function handleSignOut() {
    onNavigate?.()
    await signOut()
  }

  return (
    <div className="flex h-full flex-col bg-[#0b1220]">
      <div className="flex h-[72px] items-center border-b border-white/[0.06] px-5"><WisdomMark /></div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {operationItems.length > 0 && (
          <>
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Operação</div>
            <nav className="space-y-1">
              {operationItems.map((item) => <NavigationLink key={item.path} item={item} onNavigate={onNavigate} />)}
            </nav>
          </>
        )}

        {adminItems.length > 0 && (
          <>
            <div className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Administração</div>
            <nav className="space-y-1">
              {adminItems.map((item) => <NavigationLink key={item.path} item={item} onNavigate={onNavigate} />)}
            </nav>
          </>
        )}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/[0.045] p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-400"><ShieldCheck size={17} /></div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Sessão protegida</div>
            <div className="mt-0.5 text-[10px] text-slate-500">RLS + RBAC ativos</div>
          </div>
        </div>

        <button type="button" onClick={() => void handleSignOut()} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300">
          <LogOut size={16} /> Encerrar sessão
        </button>
      </div>
    </div>
  )
}
