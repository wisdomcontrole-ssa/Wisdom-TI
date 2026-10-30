import { supabase } from '../lib/supabase'

function client() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}
function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export interface ReservedLabel {
  code: string
  state: 'reserved' | 'claimed'
  asset_id: string | null
  batch_id: string
}
export async function issuePreprintedLabels(count: number) {
  const { data, error } = await client().rpc('m18_issue_labels', { p_count: count })
  fail(error)
  return data as { batch_id: string; codes: string[]; count: number }
}
export async function findPreprintedLabel(code: string) {
  const { data, error } = await client().rpc('m18_get_label', { p_code: code.trim() })
  fail(error)
  return data as ReservedLabel | null
}
export async function claimPreprintedLabel(input: {
  code: string
  assetTypeId: string
  serial?: string
  thirdParty?: string
  manufacturer?: string
  model?: string
  origin?: 'purchase' | 'donation' | 'used' | 'transfer' | 'other'
}) {
  const { data, error } = await client().rpc('m18_claim_label', {
    p_code: input.code,
    p_asset_type_id: input.assetTypeId,
    p_serial: input.serial || null,
    p_third_party: input.thirdParty || null,
    p_manufacturer: input.manufacturer || null,
    p_model: input.model || null,
    p_origin: input.origin || 'used',
  })
  fail(error)
  return data as { asset_id: string; code: string; already_claimed: boolean }
}
