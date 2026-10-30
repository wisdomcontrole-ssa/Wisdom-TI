import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { listAssetTypes } from '../data/asset-service'
import { claimPreprintedLabel, findPreprintedLabel, type ReservedLabel } from '../data/preprinted-labels-service'
import { useAuth } from '../auth/useAuth'
import { InventoryScanner } from '../components/field/InventoryScanner'
import { SmartLabelReader } from '../components/assets/SmartLabelReader'
import type { AssetTypeRecord } from '../types/assets'
import type { ReviewedLabelData } from '../types/asset-smart'

const large = 'min-h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400'
const favoriteWords = ['computador','notebook','impressora','monitor','roteador','switch','cabo','teclado','mouse']

export function QuickLabelRegistrationPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [label, setLabel] = useState<ReservedLabel | null>(null)
  const [types, setTypes] = useState<AssetTypeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [typeId, setTypeId] = useState('')
  const [serial, setSerial] = useState('')
  const [thirdParty, setThirdParty] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [origin, setOrigin] = useState<'used' | 'donation' | 'purchase' | 'transfer' | 'other'>('used')
  const [serialNumeric, setSerialNumeric] = useState(true)
  const [scanTarget, setScanTarget] = useState<'serial' | 'third' | null>(null)
  const [showOcr, setShowOcr] = useState(false)
  const [reviewed, setReviewed] = useState<ReviewedLabelData | null>(null)
  const normalized = code.toUpperCase()

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [row, list] = await Promise.all([findPreprintedLabel(normalized), listAssetTypes()])
        if (!active) return
        setLabel(row)
        setTypes(list)
        if (row?.state === 'claimed' && row.asset_id) navigate(`/patrimonio/${row.asset_id}`, { replace: true })
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a etiqueta.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [normalized, navigate])

  const orderedTypes = [...types].sort((a,b) => {
    const rank = (s: string) => favoriteWords.findIndex(k => s.toLocaleLowerCase('pt-BR').includes(k))
    const ra = rank(a.name), rb = rank(b.name)
    if (ra >= 0 && rb < 0) return -1
    if (rb >= 0 && ra < 0) return 1
    if (ra !== rb && ra >= 0 && rb >= 0) return ra-rb
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  async function submit() {
    if (!typeId || !label || saving) return
    setSaving(true); setError('')
    try {
      const result = await claimPreprintedLabel({code: normalized, assetTypeId: typeId, serial, thirdParty, manufacturer, model, origin})
      navigate(`/patrimonio/${result.asset_id}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cadastro não concluído.') }
    finally { setSaving(false) }
  }

  if (loading) return <div role="status" className="p-5">Verificando etiqueta reservada...</div>
  if (!label) return <div role="alert" className="p-5 text-red-700">{error || 'Esta etiqueta não faz parte dos lotes reservados.'}</div>

  return <div className="mx-auto max-w-2xl space-y-5 pb-16">
    <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase text-slate-300">Cadastro por etiqueta antecipada</p><h1 className="mt-1 font-mono text-2xl font-black">{normalized}</h1><p className="mt-2 text-sm text-slate-300">Selecione o equipamento, salve e complemente o cadastro depois.</p></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <label className="block"><span className="mb-2 block text-base font-bold">1. Qual é o equipamento?</span><select value={typeId} onChange={e => setTypeId(e.target.value)} className={large}><option value="">Toque para escolher...</option>{orderedTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-base font-bold">2. Número de série do fabricante</span><div className="flex gap-2"><input value={serial} onChange={e => setSerial(e.target.value)} inputMode={serialNumeric ? 'numeric' : 'text'} autoCapitalize="characters" className={`${large} min-w-0 flex-1`} placeholder="Digite ou leia" /><button type="button" className="rounded-xl border px-4 font-bold" onClick={() => setScanTarget(scanTarget === 'serial' ? null : 'serial')}>Ler</button></div><button type="button" className="mt-2 text-sm font-semibold text-sky-700" onClick={() => setSerialNumeric(v => !v)}>{serialNumeric ? 'Usar teclado alfanumérico' : 'Usar teclado numérico'}</button></label>
      <label className="block"><span className="mb-2 block text-base font-bold">3. Código de terceiro</span><div className="flex gap-2"><input value={thirdParty} onChange={e => setThirdParty(e.target.value)} className={`${large} min-w-0 flex-1`} inputMode="text" placeholder="Patrimônio da empresa/órgão" /><button type="button" className="rounded-xl border px-4 font-bold" onClick={() => setScanTarget(scanTarget === 'third' ? null : 'third')}>Ler</button></div></label>
      {scanTarget && <div className="rounded-xl bg-slate-50 p-3"><InventoryScanner compact onScan={async value => { if (scanTarget === 'serial') setSerial(value); else setThirdParty(value); setScanTarget(null) }} /></div>}
      <label className="block"><span className="mb-2 block text-sm font-semibold">Origem</span><select className={large} value={origin} onChange={e => setOrigin(e.target.value as typeof origin)}><option value="used">Equipamento existente</option><option value="donation">Doação</option><option value="purchase">Compra</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
      <button type="button" className="min-h-14 w-full rounded-xl border border-sky-200 bg-sky-50 font-bold text-sky-800" onClick={() => setShowOcr(v => !v)}>{showOcr ? 'Fechar leitura de etiqueta' : 'Cadastrar via foto da etiqueta (opcional)'}</button>
      {showOcr && <div className="rounded-xl border p-3"><SmartLabelReader onApply={data => {setReviewed(data); setManufacturer(data.manufacturer || ''); setModel(data.model || ''); setSerial(data.serialNumber || serial); setShowOcr(false)}} />{reviewed && <p className="text-sm text-emerald-700">Dados da etiqueta aplicados aos campos básicos. Revise antes de salvar.</p>}</div>}
      {reviewed && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Fabricante<input className={large} value={manufacturer} onChange={e => setManufacturer(e.target.value)} /></label><label className="text-sm">Modelo<input className={large} value={model} onChange={e => setModel(e.target.value)} /></label></div>}
      <button type="button" disabled={!hasPermission('assets.create') || !typeId || saving} onClick={() => void submit()} className="min-h-16 w-full rounded-xl bg-slate-950 px-4 text-lg font-black text-white disabled:opacity-40">{saving ? 'Cadastrando...' : 'Salvar cadastro rápido'}</button>
      <p className="text-xs text-slate-500">O patrimônio permanece pendente de complementação. Após salvar, você poderá editar RAM, processador, armazenamento, localização e outros dados na ficha existente.</p>
    </div>
  </div>
}
