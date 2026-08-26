import {
  AlertCircle,
  Check,
  Image as ImageIcon,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useAuth } from '../auth/useAuth'
import { useBranding } from '../branding/BrandContext'
import {
  removeInstitutionLogo,
  uploadInstitutionLogo,
} from '../branding/branding-service'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import {
  listSystemSettings,
  updateSystemSetting,
} from '../data/admin-service'
import type {
  SystemSettingRecord,
} from '../types/admin'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400'

export function SettingsPage() {
  const { hasPermission } = useAuth()
  const { branding, refreshBranding } =
    useBranding()
  const canManage =
    hasPermission('settings.manage')

  const [settings, setSettings] =
    useState<SystemSettingRecord[]>([])
  const [drafts, setDrafts] = useState<
    Record<string, string>
  >({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] =
    useState<string | null>(null)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [successKey, setSuccessKey] =
    useState<string | null>(null)
  const [logoBusy, setLogoBusy] =
    useState(false)
  const fileRef =
    useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)

      const rows =
        await listSystemSettings()

      setSettings(rows)
      setDrafts(
        Object.fromEntries(
          rows.map((setting) => [
            setting.key,
            formatValue(setting),
          ]),
        ),
      )
      await refreshBranding()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar configurações.',
      )
    } finally {
      setLoading(false)
    }
  }, [refreshBranding])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const rows =
          await listSystemSettings()

        if (cancelled) {
          return
        }

        setSettings(rows)
        setDrafts(
          Object.fromEntries(
            rows.map((setting) => [
              setting.key,
              formatValue(setting),
            ]),
          ),
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar configurações.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => {
    const map = new Map<
      string,
      SystemSettingRecord[]
    >()

    for (const setting of settings) {
      if (setting.key === 'branding.logo_path') {
        continue
      }

      const current =
        map.get(setting.group_code) ?? []
      current.push(setting)
      map.set(setting.group_code, current)
    }

    return Array.from(map.entries())
  }, [settings])

  async function save(
    setting: SystemSettingRecord,
  ) {
    try {
      setSavingKey(setting.key)
      setErrorMessage(null)
      setSuccessKey(null)

      const raw = drafts[setting.key] ?? ''
      const value = parseValue(
        setting,
        raw,
      )

      await updateSystemSetting(
        setting.key,
        value,
      )

      setSuccessKey(setting.key)
      await refresh()
      setSuccessKey(setting.key)

      window.setTimeout(() => {
        setSuccessKey((current) =>
          current === setting.key
            ? null
            : current,
        )
      }, 2200)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a configuração.',
      )
    } finally {
      setSavingKey(null)
    }
  }

  async function uploadLogo(
    file: File,
  ) {
    try {
      setLogoBusy(true)
      setErrorMessage(null)
      await uploadInstitutionLogo(file)
      await refreshBranding()
      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a logomarca.',
      )
    } finally {
      setLogoBusy(false)
      if (fileRef.current) {
        fileRef.current.value = ''
      }
    }
  }

  async function removeLogo() {
    try {
      setLogoBusy(true)
      setErrorMessage(null)
      await removeInstitutionLogo()
      await refreshBranding()
      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover a logomarca.',
      )
    } finally {
      setLogoBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Identidade institucional e parâmetros operacionais do Inventário TI."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                loading ? 'animate-spin' : ''
              }
            />
            Atualizar
          </button>
        }
      />

      <BrandingPanel
        canManage={canManage}
        busy={logoBusy}
        logoUrl={branding.logoUrl}
        organizationName={
          branding.organizationName
        }
        fileRef={fileRef}
        onFile={(file) =>
          void uploadLogo(file)
        }
        onRemove={() =>
          void removeLogo()
        }
      />

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-800">
        Esta área armazena apenas parâmetros
        operacionais seguros. Chaves privadas,
        service_role e outros secrets não são
        aceitos aqui.
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={17} />
          {errorMessage}
        </div>
      )}

      {loading && settings.length === 0 ? (
        <div className="grid min-h-56 place-items-center">
          <RefreshCw
            size={18}
            className="animate-spin text-slate-400"
          />
        </div>
      ) : groups.length === 0 ? (
        <SectionCard>
          <div className="p-8 text-center text-sm text-slate-400">
            Nenhuma configuração cadastrada.
          </div>
        </SectionCard>
      ) : (
        groups.map(([group, rows]) => (
          <SectionCard key={group}>
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Settings2
                  size={15}
                  className="text-slate-400"
                />
                <h2 className="text-sm font-bold text-slate-900">
                  {groupLabel(group)}
                </h2>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {rows.map((setting) => (
                <div
                  key={setting.key}
                  className="grid gap-4 p-5 lg:grid-cols-[minmax(220px,1fr)_minmax(280px,1fr)_auto] lg:items-center"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {setting.label}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {setting.description ??
                        setting.key}
                    </div>
                  </div>

                  <SettingInput
                    setting={setting}
                    value={
                      drafts[setting.key] ?? ''
                    }
                    disabled={!canManage}
                    onChange={(value) =>
                      setDrafts((current) => ({
                        ...current,
                        [setting.key]: value,
                      }))
                    }
                  />

                  {canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        void save(setting)
                      }
                      disabled={
                        savingKey === setting.key
                      }
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {successKey ===
                      setting.key ? (
                        <Check size={14} />
                      ) : (
                        <Save size={14} />
                      )}
                      {savingKey === setting.key
                        ? 'Salvando...'
                        : successKey ===
                            setting.key
                          ? 'Salvo'
                          : 'Salvar'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        ))
      )}
    </div>
  )
}

function BrandingPanel({
  canManage,
  busy,
  logoUrl,
  organizationName,
  fileRef,
  onFile,
  onRemove,
}: {
  canManage: boolean
  busy: boolean
  logoUrl: string | null
  organizationName: string
  fileRef: RefObject<HTMLInputElement | null>
  onFile: (file: File) => void
  onRemove: () => void
}) {
  return (
    <SectionCard>
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <ImageIcon
            size={15}
            className="text-slate-400"
          />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Identidade institucional
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              O produto permanece Inventário TI. A instituição e sua logomarca são personalizáveis.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[220px_1fr]">
        <div className="grid min-h-32 place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={
                organizationName ||
                'Logomarca institucional'
              }
              className="max-h-24 max-w-full object-contain"
            />
          ) : (
            <div className="text-center">
              <ImageIcon
                size={25}
                className="mx-auto text-slate-300"
              />
              <div className="mt-2 text-xs text-slate-400">
                Sem logomarca
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="text-sm font-bold text-slate-900">
            Logomarca PNG
          </div>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
            Usada no login, navegação e etiquetas patrimoniais. PNG de até 2 MB. Prefira fundo transparente e formato horizontal ou quadrado.
          </p>

          {canManage && (
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(event) => {
                  const file =
                    event.target.files?.[0]

                  if (file) {
                    onFile(file)
                  }
                }}
              />

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  fileRef.current?.click()
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <RefreshCw
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Upload size={14} />
                )}
                Enviar PNG
              </button>

              {logoUrl && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRemove}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-xs font-semibold text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Remover
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function SettingInput({
  setting,
  value,
  disabled,
  onChange,
}: {
  setting: SystemSettingRecord
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  if (setting.value_type === 'boolean') {
    return (
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={disabled}
        className={inputClass}
      >
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    )
  }

  return (
    <input
      type={
        setting.value_type === 'number'
          ? 'number'
          : 'text'
      }
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      disabled={disabled}
      className={inputClass}
    />
  )
}

function formatValue(
  setting: SystemSettingRecord,
) {
  if (setting.value == null) {
    return ''
  }

  if (
    typeof setting.value === 'string' ||
    typeof setting.value === 'number' ||
    typeof setting.value === 'boolean'
  ) {
    return String(setting.value)
  }

  return JSON.stringify(setting.value)
}

function parseValue(
  setting: SystemSettingRecord,
  raw: string,
) {
  if (setting.value_type === 'number') {
    const value = Number(raw)

    if (!Number.isFinite(value)) {
      throw new Error(
        `${setting.label}: valor numérico inválido.`,
      )
    }

    return value
  }

  if (setting.value_type === 'boolean') {
    return raw === 'true'
  }

  return raw.trim()
}

function groupLabel(group: string) {
  const labels: Record<string, string> = {
    organization: 'Organização',
    operations: 'Operação',
    auth: 'Acesso e convites',
  }

  return labels[group] ?? group
}
