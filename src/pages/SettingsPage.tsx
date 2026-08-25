import { Bell, Database, HardDrive, QrCode, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'

const options = [
  { title: 'Identificação patrimonial', description: 'Prefixos, sequências e regras dos códigos Wisdom.', icon: QrCode },
  { title: 'Segurança e permissões', description: 'Perfis operacionais e políticas de acesso.', icon: ShieldCheck },
  { title: 'Banco de dados', description: 'Estado da integração com Supabase.', icon: Database },
  { title: 'Google Drive', description: 'Pastas de evidências, fotografias e backups.', icon: HardDrive },
  { title: 'Alertas', description: 'Limites e criticidade do monitoramento.', icon: Bell },
]

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Parâmetros estruturais do Wisdom TI."
      />
      <SectionCard>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon
            return (
              <button key={option.title} className="flex min-h-28 items-start gap-4 bg-white p-5 text-left hover:bg-slate-50">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <Icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold">{option.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}