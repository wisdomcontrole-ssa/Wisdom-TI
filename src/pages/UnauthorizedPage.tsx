import { ArrowLeft, ShieldX } from 'lucide-react'
import { Link } from 'react-router'

export function UnauthorizedPage() {
  return (
    <div className="grid min-h-[calc(100vh-180px)] place-items-center py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600">
          <ShieldX size={22} />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-[-0.03em] text-slate-950">
          Acesso não autorizado
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Seu perfil não possui permissão para acessar este módulo.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          Voltar à visão geral
        </Link>
      </div>
    </div>
  )
}
