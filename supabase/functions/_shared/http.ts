/* eslint-disable */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'GET, POST, OPTIONS',
}

export function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function errorResponse(
  error: unknown,
  fallback = 'Erro interno.',
  status = 500,
) {
  const message =
    error instanceof Error
      ? error.message
      : fallback

  return jsonResponse(
    {
      error: message,
    },
    status,
  )
}

export function handleOptions(req: Request) {
  if (req.method !== 'OPTIONS') {
    return null
  }

  return new Response('ok', {
    headers: corsHeaders,
  })
}
