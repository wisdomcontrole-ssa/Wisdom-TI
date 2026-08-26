import {
  AlertCircle,
  ArrowRight,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useBranding } from '../branding/BrandContext'
import { WisdomMark } from '../components/brand/WisdomMark'

export function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const { branding } = useBranding()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const target =
    (location.state as { from?: string } | null)?.from ??
    '/dashboard'

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErrorMessage(null)

    const result = await signIn(email, password)

    if (!result.ok) {
      setErrorMessage(
        result.message ?? 'Credenciais inválidas.',
      )
      return
    }

    navigate(target, { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] lg:grid lg:grid-cols-[minmax(360px,0.78fr)_1.22fr]">
      <aside className="hidden min-h-screen flex-col justify-between overflow-hidden bg-[#0b1220] p-10 lg:flex xl:p-14">
        <WisdomMark />

        <div className="max-w-md">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-sky-400">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.045em] text-white">
            Inventário e gestão de TI
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            Patrimônio, estoque, auditorias, manutenção, agentes Windows e rastreabilidade em um único ambiente.
          </p>
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          {branding.organizationName || branding.productName}
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <WisdomMark darkText />
          </div>

          <div className="mb-7">
            <div className="text-[11px] font-bold uppercase tracking-[0.17em] text-slate-400">
              Acesso restrito
            </div>
            <h2 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
              Entrar no {branding.productName}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Utilize sua conta institucional.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          <form
            onSubmit={submit}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                E-mail
              </span>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="username"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                Senha
              </span>
              <div className="relative">
                <LockKeyhole
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="••••••••"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? 'Validando...' : 'Entrar'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
