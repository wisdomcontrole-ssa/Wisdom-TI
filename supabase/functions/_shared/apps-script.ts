/* eslint-disable */

export interface AppsScriptResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(
      `Supabase Secret ausente: ${name}`,
    )
  }

  return value
}

export async function callAppsScript<T>(
  action: string,
  payload: Record<string, unknown> = {},
) {
  const url = requireEnv(
    'GOOGLE_APPS_SCRIPT_URL',
  )

  const secret = requireEnv(
    'GOOGLE_APPS_SCRIPT_SHARED_SECRET',
  )

  const response = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type':
        'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      action,
      secret,
      payload,
    }),
  })

  if (!response.ok) {
    const text = await response.text()

    throw new Error(
      `Apps Script HTTP ${response.status}: ${text}`,
    )
  }

  const raw = await response.text()

  let result: AppsScriptResponse<T>

  try {
    result = JSON.parse(raw)
  } catch {
    throw new Error(
      `Resposta invalida do Apps Script: ${raw.slice(0, 300)}`,
    )
  }

  if (!result.ok) {
    throw new Error(
      result.error ??
        'Apps Script retornou erro.',
    )
  }

  return result.data as T
}
