import { supabase } from '../lib/supabase'

export interface TechnicalEntryCatalog {
  manufacturers: string[]
  processorManufacturers: string[]
  processorModels: string[]
  memorySizesGb: number[]
  memoryTypes: string[]
  memorySpeedsMhz: number[]
  storageCapacitiesGb: number[]
  storageTypes: string[]
  storageInterfaces: string[]
  storageFormFactors: string[]
  operatingSystems: string[]
}

const BASE_MANUFACTURERS = [
  'Login',
  'Dell',
  'HP',
  'Lenovo',
  'Acer',
  'ASUS',
  'MSI',
  'Gigabyte',
  'ASRock',
  'Positivo',
  'Daten',
  'Apple',
  'Samsung',
  'LG',
  'AOC',
  'Philips',
  'Epson',
  'Brother',
  'Canon',
  'Zebra',
  'Lexmark',
  'Xerox',
  'Ricoh',
  'Kyocera',
  'Cisco',
  'Aruba',
  'Ubiquiti',
  'MikroTik',
  'TP-Link',
  'D-Link',
  'Intelbras',
  'Fortinet',
  'Huawei',
  'Juniper',
  'Netgear',
  'APC',
  'SMS',
  'TS Shara',
  'Ragtech',
  'Multilaser',
  'Logitech',
  'Microsoft',
  'Synology',
  'QNAP',
]

const BASE_PROCESSOR_MANUFACTURERS = [
  'Intel',
  'AMD',
  'Apple',
  'Qualcomm',
]

const BASE_PROCESSOR_MODELS = [
  'Intel Celeron J1800',
  'Intel Celeron J4005',
  'Intel Celeron N4020',
  'Intel Pentium G4400',
  'Intel Core i3-6100',
  'Intel Core i3-7100',
  'Intel Core i3-8100',
  'Intel Core i3-10100',
  'Intel Core i3-12100',
  'Intel Core i5-2400',
  'Intel Core i5-3470',
  'Intel Core i5-4570',
  'Intel Core i5-6500',
  'Intel Core i5-7400',
  'Intel Core i5-8400',
  'Intel Core i5-9400',
  'Intel Core i5-10400',
  'Intel Core i5-11400',
  'Intel Core i5-12400',
  'Intel Core i5-13400',
  'Intel Core i7-2600',
  'Intel Core i7-3770',
  'Intel Core i7-4790',
  'Intel Core i7-6700',
  'Intel Core i7-7700',
  'Intel Core i7-8700',
  'Intel Core i7-9700',
  'Intel Core i7-10700',
  'Intel Core i7-11700',
  'Intel Core i7-12700',
  'Intel Xeon E3',
  'Intel Xeon E5',
  'AMD Athlon 3000G',
  'AMD Ryzen 3 2200G',
  'AMD Ryzen 3 3200G',
  'AMD Ryzen 3 4300G',
  'AMD Ryzen 5 2400G',
  'AMD Ryzen 5 3400G',
  'AMD Ryzen 5 4600G',
  'AMD Ryzen 5 5600G',
  'AMD Ryzen 5 5600',
  'AMD Ryzen 7 5700G',
]

const BASE_MEMORY_SIZES = [
  2,
  4,
  6,
  8,
  12,
  16,
  24,
  32,
  48,
  64,
  96,
  128,
]

const BASE_MEMORY_TYPES = [
  'DDR2',
  'DDR3',
  'DDR3L',
  'DDR4',
  'DDR5',
  'LPDDR3',
  'LPDDR4',
  'LPDDR4X',
  'LPDDR5',
]

const BASE_MEMORY_SPEEDS = [
  800,
  1066,
  1333,
  1600,
  1866,
  2133,
  2400,
  2666,
  2933,
  3200,
  3600,
  4800,
  5200,
  5600,
  6000,
]

const BASE_STORAGE_CAPACITIES = [
  80,
  120,
  128,
  160,
  240,
  250,
  256,
  320,
  480,
  500,
  512,
  750,
  960,
  1000,
  1024,
  2000,
  2048,
  4000,
  4096,
]

const BASE_STORAGE_TYPES = [
  'HDD',
  'SSD',
  'SSD NVMe',
  'eMMC',
]

const BASE_STORAGE_INTERFACES = [
  'SATA',
  'NVMe',
  'PCIe',
  'SAS',
  'USB',
]

const BASE_STORAGE_FORM_FACTORS = [
  'M.2',
  'M.2 2242',
  'M.2 2260',
  'M.2 2280',
  '2.5"',
  '3.5"',
]

const BASE_OPERATING_SYSTEMS = [
  'Windows 11 Pro',
  'Windows 11 Home',
  'Windows 10 Pro',
  'Windows 10 Home',
  'Windows 7 Professional',
  'Ubuntu',
  'Debian',
  'Linux Mint',
  'Sem sistema operacional',
]

function client() {
  if (!supabase) {
    throw new Error('Supabase não está configurado.')
  }

  return supabase
}

function textValues(
  rows: Record<string, unknown>[],
  field: string,
) {
  return rows
    .map((row) => row[field])
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        Boolean(value.trim()),
    )
    .map((value) => value.trim())
}

function numberValues(
  rows: Record<string, unknown>[],
  field: string,
) {
  return rows
    .map((row) => Number(row[field]))
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0,
    )
}

function uniqueText(values: Array<string | undefined>) {
  const map = new Map<string, string>()

  values.forEach((value) => {
    const clean = value?.trim()
    if (!clean) return

    const key = clean
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()

    if (!map.has(key)) {
      map.set(key, clean)
    }
  })

  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', {
      sensitivity: 'base',
      numeric: true,
    }),
  )
}

function uniqueNumbers(values: number[]) {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0,
      ),
    ),
  ).sort((a, b) => a - b)
}

async function safeRows(
  table: string,
  columns: string,
) {
  const { data, error } = await client()
    .from(table)
    .select(columns)
    .limit(2000)

  if (error) {
    return [] as Record<string, unknown>[]
  }

  return (data ?? []) as unknown as Record<string, unknown>[]
}

export async function listTechnicalEntryCatalog(): Promise<TechnicalEntryCatalog> {
  const [
    manufacturerRows,
    assetRows,
    profileRows,
  ] = await Promise.all([
    safeRows(
      'ti_manufacturers',
      'name, active',
    ),
    safeRows(
      'assets',
      'manufacturer, os_name',
    ),
    safeRows(
      'asset_technical_profiles',
      [
        'processor_manufacturer',
        'processor_model',
        'memory_total_gb',
        'memory_type',
        'memory_speed_mhz',
        'storage_capacity_gb',
        'storage_type',
        'storage_interface',
        'storage_form_factor',
      ].join(', '),
    ),
  ])

  const activeManufacturerRows =
    manufacturerRows.filter(
      (row) => row.active !== false,
    )

  return {
    manufacturers: uniqueText([
      ...BASE_MANUFACTURERS,
      ...textValues(
        activeManufacturerRows,
        'name',
      ),
      ...textValues(
        assetRows,
        'manufacturer',
      ),
    ]),
    processorManufacturers: uniqueText([
      ...BASE_PROCESSOR_MANUFACTURERS,
      ...textValues(
        profileRows,
        'processor_manufacturer',
      ),
    ]),
    processorModels: uniqueText([
      ...BASE_PROCESSOR_MODELS,
      ...textValues(
        profileRows,
        'processor_model',
      ),
    ]),
    memorySizesGb: uniqueNumbers([
      ...BASE_MEMORY_SIZES,
      ...numberValues(
        profileRows,
        'memory_total_gb',
      ),
    ]),
    memoryTypes: uniqueText([
      ...BASE_MEMORY_TYPES,
      ...textValues(
        profileRows,
        'memory_type',
      ),
    ]),
    memorySpeedsMhz: uniqueNumbers([
      ...BASE_MEMORY_SPEEDS,
      ...numberValues(
        profileRows,
        'memory_speed_mhz',
      ),
    ]),
    storageCapacitiesGb: uniqueNumbers([
      ...BASE_STORAGE_CAPACITIES,
      ...numberValues(
        profileRows,
        'storage_capacity_gb',
      ),
    ]),
    storageTypes: uniqueText([
      ...BASE_STORAGE_TYPES,
      ...textValues(
        profileRows,
        'storage_type',
      ),
    ]),
    storageInterfaces: uniqueText([
      ...BASE_STORAGE_INTERFACES,
      ...textValues(
        profileRows,
        'storage_interface',
      ),
    ]),
    storageFormFactors: uniqueText([
      ...BASE_STORAGE_FORM_FACTORS,
      ...textValues(
        profileRows,
        'storage_form_factor',
      ),
    ]),
    operatingSystems: uniqueText([
      ...BASE_OPERATING_SYSTEMS,
      ...textValues(
        assetRows,
        'os_name',
      ),
    ]),
  }
}
