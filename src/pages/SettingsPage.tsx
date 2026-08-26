import {
  AlertCircle,
  Check,
  RefreshCw,
  Save,
  Settings2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '../auth/useAuth'
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
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar configurações.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Parâmetros não sensíveis persistidos no backend do Wisdom TI."
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
            Aplique o SQL do M08 no Supabase.
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
                    <div className="mt-1 font-mono text-[9px] text-slate-400">
                      {setting.key}
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
