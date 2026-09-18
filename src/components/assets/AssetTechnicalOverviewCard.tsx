import {
  CheckCircle2,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
} from 'lucide-react'
import {
  adoptDetectedInventory,
  getInventoryExpectation,
} from '../../data/agent-service'
import {
  setAssetTechnicalProfile,
  type AssetTechnicalProfileRecord,
} from '../../data/ocr-intelligence-service'
import type {
  AgentInventorySnapshotRecord,
} from '../../types/agent'
import type {
  AssetRecord,
} from '../../types/assets'
import {
  useState,
} from 'react'

function joinValues(
  values: Array<string | number | null | undefined>,
) {
  return values
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== '',
    )
    .join(' · ')
}

function formatRam(
  value: number | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '—'
  }

  const number = Number(value)
  return Number.isInteger(number)
    ? `${number} GB`
    : `${number.toFixed(1)} GB`
}

function formatBytes(bytes: number | null | undefined) {
  if (
    bytes === null ||
    bytes === undefined ||
    !Number.isFinite(bytes)
  ) {
    return '—'
  }

  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function registeredStorage(
  profile: AssetTechnicalProfileRecord | null,
) {
  if (!profile) return '—'

  const capacity =
    profile.storage_capacity_gb !== null
      ? formatRam(profile.storage_capacity_gb)
      : ''

  return (
    joinValues([
      capacity,
      profile.storage_type,
      profile.storage_interface,
      profile.storage_form_factor,
    ]) || '—'
  )
}

function detectedStorage(
  snapshot: AgentInventorySnapshotRecord | null,
) {
  if (!snapshot) return '—'

  const physical =
    snapshot.health?.physical_disks ?? []

  if (physical.length > 0) {
    return physical
      .map((disk) =>
        joinValues([
          disk.media_type,
          disk.bus_type,
          disk.size_bytes
            ? formatBytes(disk.size_bytes)
            : null,
          disk.model,
        ]),
      )
      .filter(Boolean)
      .join(' | ')
  }

  const disks = snapshot.disks ?? []

  if (disks.length === 0) return '—'

  return disks
    .map((disk) =>
      joinValues([
        disk.label || disk.device_id,
        disk.size_bytes
          ? formatBytes(disk.size_bytes)
          : null,
      ]),
    )
    .filter(Boolean)
    .join(' | ')
}

function registeredMemory(
  profile: AssetTechnicalProfileRecord | null,
) {
  if (!profile) return '—'

  return (
    joinValues([
      profile.memory_total_gb !== null
        ? formatRam(profile.memory_total_gb)
        : null,
      profile.memory_type,
      profile.memory_speed_mhz
        ? `${profile.memory_speed_mhz} MHz`
        : null,
    ]) || '—'
  )
}

function detectedMemory(
  snapshot: AgentInventorySnapshotRecord | null,
) {
  if (!snapshot) return '—'

  const modules =
    snapshot.health?.memory_modules ?? []

  const moduleType =
    modules.find((item) => item.memory_type)
      ?.memory_type

  const speed =
    modules.find(
      (item) =>
        item.configured_speed_mhz ||
        item.speed_mhz,
    )

  return (
    joinValues([
      snapshot.ram_bytes
        ? formatBytes(snapshot.ram_bytes)
        : null,
      moduleType,
      speed?.configured_speed_mhz
        ? `${speed.configured_speed_mhz} MHz`
        : speed?.speed_mhz
          ? `${speed.speed_mhz} MHz`
          : null,
    ]) || '—'
  )
}

function registeredNetwork(
  profile: AssetTechnicalProfileRecord | null,
) {
  if (!profile) return '—'

  return (
    joinValues([
      profile.wifi_manufacturer,
      profile.wifi_model,
      profile.mac_address,
    ]) || '—'
  )
}

function detectedNetwork(
  snapshot: AgentInventorySnapshotRecord | null,
) {
  if (!snapshot) return '—'

  const adapters =
    snapshot.health?.network_adapters ?? []

  const preferred =
    adapters.find((item) => item.is_wifi) ??
    adapters.find((item) => item.status) ??
    adapters[0]

  if (!preferred) return '—'

  return (
    joinValues([
      preferred.manufacturer,
      preferred.product_name || preferred.name,
      preferred.mac_address,
    ]) || '—'
  )
}

function cpuManufacturer(
  value: string | null | undefined,
) {
  const normalized =
    (value ?? '').toUpperCase()

  if (normalized.includes('INTEL')) {
    return 'Intel'
  }
  if (
    normalized.includes('AMD') ||
    normalized.includes('RYZEN') ||
    normalized.includes('ATHLON')
  ) {
    return 'AMD'
  }
  if (normalized.includes('APPLE')) {
    return 'Apple'
  }
  if (normalized.includes('QUALCOMM')) {
    return 'Qualcomm'
  }

  return undefined
}

function bytesToGb(
  bytes: number | null | undefined,
) {
  if (
    bytes === null ||
    bytes === undefined ||
    !Number.isFinite(bytes)
  ) {
    return undefined
  }

  return Number(
    (bytes / 1024 ** 3).toFixed(1),
  )
}

function Spec({
  label,
  registered,
  detected,
}: {
  label: string
  registered: string
  detected: string
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-100 p-3 md:grid-cols-[130px_1fr_1fr] md:items-start">
      <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>

      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 md:hidden">
          Cadastrado
        </div>
        <div className="mt-1 break-words text-xs font-semibold text-slate-800 md:mt-0">
          {registered || '—'}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 md:hidden">
          Detectado pelo agente
        </div>
        <div className="mt-1 break-words text-xs font-semibold text-slate-600 md:mt-0">
          {detected || '—'}
        </div>
      </div>
    </div>
  )
}

export function AssetTechnicalOverviewCard({
  asset,
  profile,
  snapshot,
  canManage = false,
  onChanged,
}: {
  asset: AssetRecord
  profile: AssetTechnicalProfileRecord | null
  snapshot: AgentInventorySnapshotRecord | null
  canManage?: boolean
  onChanged?: () => void
}) {
  const [adopting, setAdopting] =
    useState(false)
  const [adoptError, setAdoptError] =
    useState<string | null>(null)

  async function adoptDetected() {
    if (!snapshot) return

    const accepted = window.confirm(
      'Confirmar o inventário detectado pelo agente como nova configuração cadastrada e novo baseline esperado?',
    )

    if (!accepted) return

    try {
      setAdopting(true)
      setAdoptError(null)

      const expectation =
        await getInventoryExpectation(
          asset.id,
        )

      await adoptDetectedInventory(
        asset,
        snapshot,
        expectation,
      )

      const modules =
        snapshot.health
          ?.memory_modules ?? []
      const moduleWithType =
        modules.find(
          (item) => item.memory_type,
        )
      const moduleWithSpeed =
        modules.find(
          (item) =>
            item.configured_speed_mhz ||
            item.speed_mhz,
        )
      const disks =
        snapshot.health
          ?.physical_disks ?? []
      const singleDisk =
        disks.length === 1
          ? disks[0]
          : null
      const adapters =
        snapshot.health
          ?.network_adapters ?? []
      const network =
        adapters.find(
          (item) => item.is_wifi,
        ) ??
        adapters.find(
          (item) => item.status,
        ) ??
        adapters[0]

      await setAssetTechnicalProfile({
        assetId: asset.id,
        processorManufacturer:
          cpuManufacturer(
            snapshot.cpu_name,
          ) ??
          profile
            ?.processor_manufacturer ??
          undefined,
        processorModel:
          snapshot.cpu_name ??
          profile?.processor_model ??
          undefined,
        memoryTotalGb:
          bytesToGb(
            snapshot.ram_bytes,
          ) ??
          profile?.memory_total_gb ??
          undefined,
        memoryType:
          moduleWithType
            ?.memory_type ??
          profile?.memory_type ??
          undefined,
        memorySpeedMhz:
          moduleWithSpeed
            ?.configured_speed_mhz ??
          moduleWithSpeed?.speed_mhz ??
          profile
            ?.memory_speed_mhz ??
          undefined,
        storageCapacityGb:
          singleDisk?.size_bytes
            ? bytesToGb(
                singleDisk.size_bytes,
              )
            : profile
                ?.storage_capacity_gb ??
              undefined,
        storageType:
          singleDisk
            ?.media_type ??
          profile?.storage_type ??
          undefined,
        storageInterface:
          singleDisk?.bus_type ??
          profile
            ?.storage_interface ??
          undefined,
        storageFormFactor:
          profile
            ?.storage_form_factor ??
          undefined,
        motherboardManufacturer:
          snapshot.health
            ?.motherboard
            ?.manufacturer ??
          profile
            ?.motherboard_manufacturer ??
          undefined,
        motherboardModel:
          snapshot.health
            ?.motherboard?.model ??
          profile?.motherboard_model ??
          undefined,
        operatingSystem:
          snapshot.os_name ??
          asset.os_name ??
          undefined,
        wifiManufacturer:
          network?.manufacturer ??
          profile
            ?.wifi_manufacturer ??
          undefined,
        wifiModel:
          network?.product_name ??
          network?.name ??
          profile?.wifi_model ??
          undefined,
        macAddress:
          network?.mac_address ??
          profile?.mac_address ??
          undefined,
        source: 'manual',
      })

      onChanged?.()
    } catch (error) {
      setAdoptError(
        error instanceof Error
          ? error.message
          : 'Não foi possível adotar o inventário detectado.',
      )
    } finally {
      setAdopting(false)
    }
  }

  const registeredCpu =
    joinValues([
      profile?.processor_manufacturer,
      profile?.processor_model,
    ]) || '—'

  const detectedCpu =
    snapshot?.cpu_name ?? '—'

  const registeredBoard =
    joinValues([
      profile?.motherboard_manufacturer,
      profile?.motherboard_model,
    ]) || '—'

  const detectedBoard =
    joinValues([
      snapshot?.health?.motherboard?.manufacturer,
      snapshot?.health?.motherboard?.model,
    ]) || '—'

  const registeredOs =
    asset.os_name ?? '—'

  const detectedOs =
    joinValues([
      snapshot?.os_name,
      snapshot?.os_version,
      snapshot?.os_build,
    ]) || '—'

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Cpu size={16} />
            Configuração técnica
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            O cadastro é a referência esperada. O agente mostra o que está instalado atualmente sem sobrescrever o cadastro automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          <span className="rounded-full bg-slate-100 px-2 py-1">
            Cadastrado
          </span>
          <span
            className={`rounded-full px-2 py-1 ${
              snapshot
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {snapshot
              ? 'Agente detectado'
              : 'Sem coleta do agente'}
          </span>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <div className="mb-2 hidden grid-cols-[130px_1fr_1fr] gap-2 px-3 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400 md:grid">
          <span />
          <span>Cadastrado / esperado</span>
          <span>Detectado pelo agente</span>
        </div>

        <div className="space-y-2">
          <Spec
            label="Processador"
            registered={registeredCpu}
            detected={detectedCpu}
          />
          <Spec
            label="Memória RAM"
            registered={registeredMemory(profile)}
            detected={detectedMemory(snapshot)}
          />
          <Spec
            label="Armazenamento"
            registered={registeredStorage(profile)}
            detected={detectedStorage(snapshot)}
          />
          <Spec
            label="Sistema operacional"
            registered={registeredOs}
            detected={detectedOs}
          />
          <Spec
            label="Placa-mãe"
            registered={registeredBoard}
            detected={detectedBoard}
          />
          <Spec
            label="Rede / Wi-Fi"
            registered={registeredNetwork(profile)}
            detected={detectedNetwork(snapshot)}
          />
        </div>

        {snapshot && canManage && (
          <button
            type="button"
            onClick={() =>
              void adoptDetected()
            }
            disabled={adopting}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {adopting
              ? 'Atualizando cadastro…'
              : 'Confirmar inventário detectado'}
          </button>
        )}

        {adoptError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-700">
            {adoptError}
          </div>
        )}

        {!profile && (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
            Este ativo ainda não possui configuração técnica cadastrada. Use Editar para registrar CPU, memória, armazenamento e demais dados.
          </div>
        )}

        {snapshot && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <MemoryStick size={12} />
            <span>
              Última coleta:{' '}
              {new Date(
                snapshot.received_at,
              ).toLocaleString('pt-BR')}
            </span>
            <HardDrive size={12} />
            <span>
              Alterações detectadas pelo agente continuam sendo tratadas no baseline e nas divergências.
            </span>
            <Network size={12} />
          </div>
        )}
      </div>
    </section>
  )
}
