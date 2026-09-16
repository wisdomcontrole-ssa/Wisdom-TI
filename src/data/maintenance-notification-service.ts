import { supabase } from '../lib/supabase'

function client() {
  if (!supabase) {
    throw new Error(
      'Supabase não está configurado.',
    )
  }

  return supabase
}

export async function triggerMaintenanceNotifications(
  input: {
    requestId?: string
    maintenanceId?: string
  },
) {
  if (
    !input.requestId &&
    !input.maintenanceId
  ) {
    return
  }

  try {
    const { error } =
      await client().functions.invoke(
        'maintenance-notify',
        {
          body: {
            request_id:
              input.requestId ?? null,
            maintenance_id:
              input.maintenanceId ?? null,
          },
        },
      )

    if (error) {
      console.warn(
        'Notificação de manutenção pendente:',
        error.message,
      )
    }
  } catch (error) {
    console.warn(
      'Não foi possível acionar as notificações agora.',
      error,
    )
  }
}

export function buildMaintenanceWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
) {
  const digits = (phone ?? '').replace(
    /\D/g,
    '',
  )

  if (digits.length < 10) {
    return null
  }

  const normalized =
    digits.startsWith('55')
      ? digits
      : `55${digits}`

  return (
    `https://wa.me/${normalized}` +
    `?text=${encodeURIComponent(message)}`
  )
}
