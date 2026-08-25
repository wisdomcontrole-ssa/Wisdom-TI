import { useState, type FormEvent } from 'react'
import { Camera, QrCode } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

const input =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const label = 'mb-1.5 block text-xs font-semibold text-slate-700'

export function AssetCreateModal({
  open,
  onClose,
  onCreated,
}: Props) {
  const [saving, setSaving] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    window.setTimeout(() => {
      setSaving(false)
      onCreated?.()
      onClose()
    }, 450)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cadastrar ativo"
      description="Identificação patrimonial e localização inicial."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="asset-form" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar ativo'}
          </Button>
        </div>
      }
    >
      <form id="asset-form" onSubmit={submit} className="space-y-6">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700">
            <QrCode size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Código automático</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Código patrimonial e QR Code serão gerados no cadastro.
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={label}>Tipo de ativo</span>
            <select className={input} defaultValue="" required>
              <option value="" disabled>Selecione</option>
              <option>Desktop</option>
              <option>Notebook</option>
              <option>Monitor</option>
              <option>Impressora</option>
              <option>Nobreak</option>
              <option>Estabilizador</option>
              <option>Componente</option>
              <option>Outro</option>
            </select>
          </label>

          <label>
            <span className={label}>Nome operacional</span>
            <input className={input} placeholder="Ex.: LAB01-PC-14" required />
          </label>

          <label>
            <span className={label}>Fabricante</span>
            <input className={input} placeholder="Ex.: Dell" />
          </label>

          <label>
            <span className={label}>Modelo</span>
            <input className={input} placeholder="Ex.: OptiPlex 7090" />
          </label>

          <label>
            <span className={label}>Número de série</span>
            <input className={input} placeholder="Serial do fabricante" />
          </label>

          <label>
            <span className={label}>Estado inicial</span>
            <select className={input} defaultValue="Operacional">
              <option>Operacional</option>
              <option>Em estoque</option>
              <option>Em manutenção</option>
              <option>Com avaria</option>
            </select>
          </label>

          <label>
            <span className={label}>Unidade</span>
            <select className={input} defaultValue="" required>
              <option value="" disabled>Selecione</option>
              <option>Unidade Centro</option>
              <option>Unidade Norte</option>
            </select>
          </label>

          <label>
            <span className={label}>Ambiente</span>
            <select className={input} defaultValue="" required>
              <option value="" disabled>Selecione</option>
              <option>Laboratório 01</option>
              <option>Laboratório 02</option>
              <option>Laboratório 03</option>
              <option>Secretaria</option>
              <option>Administrativo</option>
            </select>
          </label>
        </div>

        <div>
          <div className={label}>Registro fotográfico</div>
          <button
            type="button"
            className="flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            <Camera size={19} />
            Adicionar fotografias
          </button>
        </div>
      </form>
    </Modal>
  )
}