import { CheckCircle2, Database, KeyRound, TerminalSquare } from 'lucide-react'
import { WisdomMark } from '../components/brand/WisdomMark'

const steps = [
  {
    icon: Database,
    title: 'Migration',
    detail: 'Execute supabase/migrations/20260813_190000_m02_foundation.sql no SQL Editor.',
  },
  {
    icon: KeyRound,
    title: 'Credenciais públicas',
    detail: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.local.',
  },
  {
    icon: TerminalSquare,
    title: 'Reiniciar',
    detail: 'Reinicie o npm run dev depois de salvar o .env.local.',
  },
]

export function BackendSetupPage() {
  return (
    <div className="min-h-screen bg-[#f4f6f9] p-5 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <WisdomMark darkText />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-sky-400">
            <Database size={20} />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-[-0.035em] text-slate-950">
            Backend ainda não configurado
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            A fundação do Marco 02 foi instalada. Finalize a conexão local com o projeto Supabase.
          </p>

          <div className="mt-7 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="flex gap-4 p-4 sm:p-5">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{step.title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={15} />
            Nenhuma chave administrativa deve ser colocada no frontend.
          </div>
        </div>
      </div>
    </div>
  )
}
