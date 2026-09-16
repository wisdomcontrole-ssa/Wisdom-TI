import { supabase } from '../lib/supabase'
import type {
  OcrInterpretation,
} from '../features/ocr-intelligence'

function client() {
  if (!supabase) {
    throw new Error(
      'Supabase não está configurado.',
    )
  }

  return supabase
}

function throwIfError(
  error: { message: string } | null,
) {
  if (error) {
    throw new Error(error.message)
  }
}

export async function setAssetTechnicalProfile(input: {
  assetId: string
  processorManufacturer?: string
  processorModel?: string
  memoryTotalGb?: number
  memoryType?: string
  memorySpeedMhz?: number
  storageCapacityGb?: number
  storageType?: string
  storageInterface?: string
  storageFormFactor?: string
  motherboardManufacturer?: string
  motherboardModel?: string
  operatingSystem?: string
  wifiManufacturer?: string
  wifiModel?: string
  macAddress?: string
  source?: 'ocr' | 'manual'
}) {
  const { error } = await client().rpc(
    'set_asset_technical_profile',
    {
      p_asset_id: input.assetId,
      p_processor_manufacturer:
        input.processorManufacturer?.trim() ||
        null,
      p_processor_model:
        input.processorModel?.trim() || null,
      p_memory_total_gb:
        input.memoryTotalGb ?? null,
      p_memory_type:
        input.memoryType?.trim() || null,
      p_memory_speed_mhz:
        input.memorySpeedMhz ?? null,
      p_storage_capacity_gb:
        input.storageCapacityGb ?? null,
      p_storage_type:
        input.storageType?.trim() || null,
      p_storage_interface:
        input.storageInterface?.trim() ||
        null,
      p_storage_form_factor:
        input.storageFormFactor?.trim() ||
        null,
      p_motherboard_manufacturer:
        input.motherboardManufacturer?.trim() ||
        null,
      p_motherboard_model:
        input.motherboardModel?.trim() ||
        null,
      p_operating_system:
        input.operatingSystem?.trim() || null,
      p_wifi_manufacturer:
        input.wifiManufacturer?.trim() ||
        null,
      p_wifi_model:
        input.wifiModel?.trim() || null,
      p_mac_address:
        input.macAddress?.trim() || null,
      p_source: input.source ?? 'manual',
    },
  )

  throwIfError(error)
}

export async function recordOcrIntelligenceExtraction(input: {
  assetId: string
  extraction: OcrInterpretation
}) {
  const { data: run, error: runError } =
    await client()
      .from('ti_ocr_extraction_runs')
      .insert({
        asset_id: input.assetId,
        engine_version: '1.1.0',
        equipment_hint: null,
        detected_category:
          input.extraction.detectedCategory,
        raw_text: input.extraction.rawText,
        normalized_text:
          input.extraction.normalizedText,
        overall_confidence:
          input.extraction.confidence,
        unclassified_text:
          input.extraction.observations ||
          null,
      })
      .select('id')
      .single()

  throwIfError(runError)

  if (!run?.id) {
    throw new Error(
      'O Supabase não retornou o ID da execução OCR.',
    )
  }

  const runId = String(run.id)

  const fields = Object.values(
    input.extraction.fields,
  )
    .filter(Boolean)
    .map((field) => ({
      run_id: runId,
      field_key: field.key,
      value_text:
        typeof field.value === 'string'
          ? field.value
          : null,
      value_number:
        typeof field.value === 'number'
          ? field.value
          : null,
      confidence: field.confidence,
      source_line: field.sourceLine,
      rule: field.rule,
    }))

  if (fields.length > 0) {
    const { error } = await client()
      .from('ti_ocr_extraction_fields')
      .insert(fields)

    throwIfError(error)
  }

  return runId
}