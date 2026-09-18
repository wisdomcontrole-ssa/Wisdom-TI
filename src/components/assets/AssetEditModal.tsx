import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  listTechnicalEntryCatalog,
  type TechnicalEntryCatalog,
} from '../../data/entry-catalog-service'
import {
  setAssetTechnicalProfile,
  type AssetTechnicalProfileRecord,
} from '../../data/ocr-intelligence-service'
import {
  updateAsset,
} from '../../data/asset-service'
import type {
  AssetRecord,
  AssetTypeRecord,
} from '../../types/assets'
import { FormModal } from '../ui/FormModal'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const emptyCatalog: TechnicalEntryCatalog = {
  manufacturers: [],
  processorManufacturers: [],
  processorModels: [],
  memorySizesGb: [],
  memoryTypes: [],
  memorySpeedsMhz: [],
  storageCapacitiesGb: [],
  storageTypes: [],
  storageInterfaces: [],
  storageFormFactors: [],
  operatingSystems: [],
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[10px] leading-4 text-slate-400">
          {hint}
        </span>
      )}
    </label>
  )
}

function Datalist({
  id,
  values,
}: {
  id: string
  values: Array<string | number>
}) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option
          key={String(value)}
          value={String(value)}
        />
      ))}
    </datalist>
  )
}

function numberOrUndefined(value: string) {
  const clean = value.trim().replace(',', '.')
  if (!clean) return undefined

  const number = Number(clean)
  return Number.isFinite(number)
    ? number
    : undefined
}

function integerOrUndefined(value: string) {
  const number = numberOrUndefined(value)
  return number === undefined
    ? undefined
    : Math.round(number)
}

export function cleanAssetNotes(
  value: string | null | undefined,
) {
  return (value ?? '')
    .replace(
      /(?:\r?\n)?\[OCR NÃO CLASSIFICADO\][\s\S]*?\[\/OCR NÃO CLASSIFICADO\](?:\r?\n)?/gi,
      '\n',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function AssetEditModal({
  open,
  asset,
  types,
  technicalProfile,
  onClose,
  onSaved,
}: {
  open: boolean
  asset: AssetRecord
  types: AssetTypeRecord[]
  technicalProfile: AssetTechnicalProfileRecord | null
  onClose: () => void
  onSaved: () => void
}) {
  const [catalog, setCatalog] =
    useState<TechnicalEntryCatalog>(emptyCatalog)
  const [saving, setSaving] = useState(false)
  const [loadingCatalog, setLoadingCatalog] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const [typeId, setTypeId] = useState('')
  const [manufacturer, setManufacturer] =
    useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [hostname, setHostname] = useState('')
  const [osName, setOsName] = useState('')
  const [acquiredAt, setAcquiredAt] =
    useState('')
  const [notes, setNotes] = useState('')

  const [
    processorManufacturer,
    setProcessorManufacturer,
  ] = useState('')
  const [processorModel, setProcessorModel] =
    useState('')
  const [memoryTotalGb, setMemoryTotalGb] =
    useState('')
  const [memoryType, setMemoryType] =
    useState('')
  const [memorySpeedMhz, setMemorySpeedMhz] =
    useState('')
  const [
    storageCapacityGb,
    setStorageCapacityGb,
  ] = useState('')
  const [storageType, setStorageType] =
    useState('')
  const [storageInterface, setStorageInterface] =
    useState('')
  const [
    storageFormFactor,
    setStorageFormFactor,
  ] = useState('')
  const [
    motherboardManufacturer,
    setMotherboardManufacturer,
  ] = useState('')
  const [
    motherboardModel,
    setMotherboardModel,
  ] = useState('')
  const [wifiManufacturer, setWifiManufacturer] =
    useState('')
  const [wifiModel, setWifiModel] = useState('')
  const [macAddress, setMacAddress] =
    useState('')

  useEffect(() => {
    if (!open) return

    queueMicrotask(() => {
      setTypeId(asset.asset_type_id)
      setManufacturer(asset.manufacturer ?? '')
      setModel(asset.model ?? '')
      setSerial(asset.serial_number ?? '')
      setHostname(asset.hostname ?? '')
      setOsName(asset.os_name ?? '')
      setAcquiredAt(asset.acquired_at ?? '')
      setNotes(cleanAssetNotes(asset.notes))

      setProcessorManufacturer(
        technicalProfile
          ?.processor_manufacturer ?? '',
      )
      setProcessorModel(
        technicalProfile?.processor_model ?? '',
      )
      setMemoryTotalGb(
        technicalProfile?.memory_total_gb !==
        null &&
          technicalProfile?.memory_total_gb !==
            undefined
          ? String(
              technicalProfile.memory_total_gb,
            )
          : '',
      )
      setMemoryType(
        technicalProfile?.memory_type ?? '',
      )
      setMemorySpeedMhz(
        technicalProfile?.memory_speed_mhz !==
        null &&
          technicalProfile?.memory_speed_mhz !==
            undefined
          ? String(
              technicalProfile.memory_speed_mhz,
            )
          : '',
      )
      setStorageCapacityGb(
        technicalProfile?.storage_capacity_gb !==
        null &&
          technicalProfile?.storage_capacity_gb !==
            undefined
          ? String(
              technicalProfile.storage_capacity_gb,
            )
          : '',
      )
      setStorageType(
        technicalProfile?.storage_type ?? '',
      )
      setStorageInterface(
        technicalProfile?.storage_interface ??
          '',
      )
      setStorageFormFactor(
        technicalProfile?.storage_form_factor ??
          '',
      )
      setMotherboardManufacturer(
        technicalProfile
          ?.motherboard_manufacturer ?? '',
      )
      setMotherboardModel(
        technicalProfile?.motherboard_model ?? '',
      )
      setWifiManufacturer(
        technicalProfile?.wifi_manufacturer ?? '',
      )
      setWifiModel(
        technicalProfile?.wifi_model ?? '',
      )
      setMacAddress(
        technicalProfile?.mac_address ?? '',
      )

      setErrorMessage(null)
    })

    let active = true

    async function loadCatalog() {
      try {
        setLoadingCatalog(true)
        const value =
          await listTechnicalEntryCatalog()

        if (active) setCatalog(value)
      } catch {
        if (active) setCatalog(emptyCatalog)
      } finally {
        if (active) setLoadingCatalog(false)
      }
    }

    void loadCatalog()

    return () => {
      active = false
    }
  }, [asset, open, technicalProfile])

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    try {
      setSaving(true)
      setErrorMessage(null)

      await updateAsset(asset.id, {
        asset_type_id: typeId,
        manufacturer,
        model,
        serial_number: serial,
        hostname,
        os_name: osName,
        status: asset.status,
        acquired_at: acquiredAt,
        notes,
      })

      await setAssetTechnicalProfile({
        assetId: asset.id,
        processorManufacturer,
        processorModel,
        memoryTotalGb:
          numberOrUndefined(memoryTotalGb),
        memoryType,
        memorySpeedMhz:
          integerOrUndefined(memorySpeedMhz),
        storageCapacityGb:
          numberOrUndefined(storageCapacityGb),
        storageType,
        storageInterface,
        storageFormFactor,
        motherboardManufacturer,
        motherboardModel,
        operatingSystem: osName,
        wifiManufacturer,
        wifiModel,
        macAddress,
        source: 'manual',
      })

      onClose()
      onSaved()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o ativo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="Editar ativo"
      description="Identificação e configuração técnica do equipamento."
      onClose={onClose}
      widthClassName="max-w-5xl"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-asset-form"
            disabled={saving || !typeId}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Salvando...'
              : 'Salvar alterações'}
          </button>
        </div>
      }
    >
      <form
        id="edit-asset-form"
        onSubmit={(event) => void submit(event)}
        className="space-y-6"
      >
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <section>
          <div className="mb-3">
            <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">
              Identificação
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Dados gerais do patrimônio.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo">
              <select
                className={inputClass}
                value={typeId}
                onChange={(event) =>
                  setTypeId(event.target.value)
                }
              >
                {types.map((type) => (
                  <option
                    key={type.id}
                    value={type.id}
                  >
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fabricante">
              <input
                className={inputClass}
                list="m17-2-manufacturers"
                value={manufacturer}
                onChange={(event) =>
                  setManufacturer(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-manufacturers"
                values={catalog.manufacturers}
              />
            </Field>

            <Field label="Modelo">
              <input
                className={inputClass}
                value={model}
                onChange={(event) =>
                  setModel(event.target.value)
                }
              />
            </Field>

            <Field label="Número de série do fabricante">
              <input
                className={inputClass}
                value={serial}
                onChange={(event) =>
                  setSerial(event.target.value)
                }
              />
            </Field>

            <Field label="Hostname">
              <input
                className={inputClass}
                value={hostname}
                onChange={(event) =>
                  setHostname(event.target.value)
                }
              />
            </Field>

            <Field label="Data de aquisição">
              <input
                className={inputClass}
                type="date"
                value={acquiredAt}
                onChange={(event) =>
                  setAcquiredAt(
                    event.target.value,
                  )
                }
              />
            </Field>

            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Sistema operacional">
                <input
                  className={inputClass}
                  list="m17-2-operating-systems"
                  value={osName}
                  onChange={(event) =>
                    setOsName(event.target.value)
                  }
                />
                <Datalist
                  id="m17-2-operating-systems"
                  values={
                    catalog.operatingSystems
                  }
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-[0.08em] text-sky-700">
              Configuração técnica cadastrada
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">
              Esta configuração é a referência do inventário. O agente pode detectar diferenças sem substituir estes dados automaticamente.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Fabricante do processador">
              <input
                className={inputClass}
                list="m17-2-cpu-manufacturers"
                value={processorManufacturer}
                onChange={(event) =>
                  setProcessorManufacturer(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-cpu-manufacturers"
                values={
                  catalog.processorManufacturers
                }
              />
            </Field>

            <div className="lg:col-span-2">
              <Field label="Processador / modelo">
                <input
                  className={inputClass}
                  list="m17-2-cpu-models"
                  value={processorModel}
                  onChange={(event) =>
                    setProcessorModel(
                      event.target.value,
                    )
                  }
                />
                <Datalist
                  id="m17-2-cpu-models"
                  values={
                    catalog.processorModels
                  }
                />
              </Field>
            </div>

            <Field label="Memória total (GB)">
              <input
                className={inputClass}
                list="m17-2-memory-sizes"
                inputMode="decimal"
                value={memoryTotalGb}
                onChange={(event) =>
                  setMemoryTotalGb(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-memory-sizes"
                values={catalog.memorySizesGb}
              />
            </Field>

            <Field label="Tipo de memória">
              <input
                className={inputClass}
                list="m17-2-memory-types"
                value={memoryType}
                onChange={(event) =>
                  setMemoryType(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-memory-types"
                values={catalog.memoryTypes}
              />
            </Field>

            <Field label="Velocidade da memória (MHz)">
              <input
                className={inputClass}
                list="m17-2-memory-speeds"
                inputMode="numeric"
                value={memorySpeedMhz}
                onChange={(event) =>
                  setMemorySpeedMhz(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-memory-speeds"
                values={
                  catalog.memorySpeedsMhz
                }
              />
            </Field>

            <Field label="Armazenamento (GB)">
              <input
                className={inputClass}
                list="m17-2-storage-capacities"
                inputMode="decimal"
                value={storageCapacityGb}
                onChange={(event) =>
                  setStorageCapacityGb(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-storage-capacities"
                values={
                  catalog.storageCapacitiesGb
                }
              />
            </Field>

            <Field label="Tipo de armazenamento">
              <input
                className={inputClass}
                list="m17-2-storage-types"
                value={storageType}
                onChange={(event) =>
                  setStorageType(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-storage-types"
                values={catalog.storageTypes}
              />
            </Field>

            <Field label="Interface">
              <input
                className={inputClass}
                list="m17-2-storage-interfaces"
                value={storageInterface}
                onChange={(event) =>
                  setStorageInterface(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-storage-interfaces"
                values={
                  catalog.storageInterfaces
                }
              />
            </Field>

            <Field label="Formato do armazenamento">
              <input
                className={inputClass}
                list="m17-2-storage-form-factors"
                value={storageFormFactor}
                onChange={(event) =>
                  setStorageFormFactor(
                    event.target.value,
                  )
                }
              />
              <Datalist
                id="m17-2-storage-form-factors"
                values={
                  catalog.storageFormFactors
                }
              />
            </Field>

            <Field label="Fabricante da placa-mãe">
              <input
                className={inputClass}
                list="m17-2-manufacturers"
                value={motherboardManufacturer}
                onChange={(event) =>
                  setMotherboardManufacturer(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Modelo da placa-mãe">
              <input
                className={inputClass}
                value={motherboardModel}
                onChange={(event) =>
                  setMotherboardModel(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Fabricante Wi-Fi / rede">
              <input
                className={inputClass}
                list="m17-2-manufacturers"
                value={wifiManufacturer}
                onChange={(event) =>
                  setWifiManufacturer(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Modelo Wi-Fi / rede">
              <input
                className={inputClass}
                value={wifiModel}
                onChange={(event) =>
                  setWifiModel(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="MAC address">
              <input
                className={inputClass}
                value={macAddress}
                onChange={(event) =>
                  setMacAddress(
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="AA:BB:CC:DD:EE:FF"
              />
            </Field>
          </div>

          {loadingCatalog && (
            <div className="mt-3 text-[10px] text-slate-400">
              Carregando sugestões técnicas…
            </div>
          )}
        </section>

        <Field
          label="Observações do técnico"
          hint="Use este campo apenas para observações úteis. Texto bruto do OCR é mantido no histórico de leitura e não precisa ficar aqui."
        >
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
          />
        </Field>
      </form>
    </FormModal>
  )
}
