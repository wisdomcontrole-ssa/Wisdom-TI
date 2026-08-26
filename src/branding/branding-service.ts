import { supabase } from '../lib/supabase'

export interface PublicBranding {
  productName: string
  organizationName: string
  supportEmail: string
  logoPath: string
  logoUrl: string | null
  updatedAt: string | null
}

export const DEFAULT_BRANDING: PublicBranding = {
  productName: 'Inventário TI',
  organizationName: '',
  supportEmail: '',
  logoPath: '',
  logoUrl: null,
  updatedAt: null,
}

function client() {
  if (!supabase) {
    return null
  }

  return supabase
}

export async function getPublicBranding(): Promise<PublicBranding> {
  const api = client()

  if (!api) {
    return DEFAULT_BRANDING
  }

  const { data, error } = await api.rpc('get_public_branding')

  if (error || !data) {
    return DEFAULT_BRANDING
  }

  const payload = data as {
    product_name?: string
    organization_name?: string
    support_email?: string
    logo_path?: string
    updated_at?: string
  }

  const logoPath = payload.logo_path?.trim() ?? ''
  let logoUrl: string | null = null

  if (logoPath) {
    const { data: publicUrl } = api.storage
      .from('institution-branding')
      .getPublicUrl(logoPath)

    const version = encodeURIComponent(
      payload.updated_at ?? String(Date.now()),
    )

    logoUrl = `${publicUrl.publicUrl}?v=${version}`
  }

  return {
    productName: payload.product_name?.trim() || 'Inventário TI',
    organizationName: payload.organization_name?.trim() || '',
    supportEmail: payload.support_email?.trim() || '',
    logoPath,
    logoUrl,
    updatedAt: payload.updated_at ?? null,
  }
}

export async function uploadInstitutionLogo(file: File) {
  const api = client()

  if (!api) {
    throw new Error('Supabase não está configurado.')
  }

  if (file.type !== 'image/png') {
    throw new Error('A logomarca deve estar no formato PNG.')
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('A logomarca deve ter no máximo 2 MB.')
  }

  const path = 'institution/logo.png'

  const { error: uploadError } = await api.storage
    .from('institution-branding')
    .upload(path, file, {
      upsert: true,
      contentType: 'image/png',
      cacheControl: '3600',
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { error: settingError } = await api.rpc(
    'update_system_setting',
    {
      p_key: 'branding.logo_path',
      p_value: path,
    },
  )

  if (settingError) {
    throw new Error(settingError.message)
  }

  return getPublicBranding()
}

export async function removeInstitutionLogo() {
  const api = client()

  if (!api) {
    throw new Error('Supabase não está configurado.')
  }

  const path = 'institution/logo.png'

  const { error: removeError } = await api.storage
    .from('institution-branding')
    .remove([path])

  if (
    removeError &&
    !removeError.message.toLowerCase().includes('not found')
  ) {
    throw new Error(removeError.message)
  }

  const { error: settingError } = await api.rpc(
    'update_system_setting',
    {
      p_key: 'branding.logo_path',
      p_value: '',
    },
  )

  if (settingError) {
    throw new Error(settingError.message)
  }

  return getPublicBranding()
}
