/* eslint-disable */

import {
  createClient,
  type SupabaseClient,
  type User,
} from 'npm:@supabase/supabase-js@2'

function getJsonKey(
  jsonEnv: string,
  fallbackNames: string[],
) {
  const jsonValue = Deno.env.get(jsonEnv)

  if (jsonValue) {
    const parsed = JSON.parse(jsonValue)
    const first =
      parsed.default ??
      Object.values(parsed)[0]

    if (typeof first === 'string' && first) {
      return first
    }
  }

  for (const name of fallbackNames) {
    const value = Deno.env.get(name)

    if (value) {
      return value
    }
  }

  throw new Error(
    `Chave Supabase ausente: ${jsonEnv}`,
  )
}

export function createUserClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')

  if (!url) {
    throw new Error('SUPABASE_URL ausente.')
  }

  const authorization =
    req.headers.get('Authorization')

  if (!authorization) {
    throw new Error('Authorization ausente.')
  }

  const publishableKey = getJsonKey(
    'SUPABASE_PUBLISHABLE_KEYS',
    [
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_ANON_KEY',
    ],
  )

  return createClient(url, publishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')

  if (!url) {
    throw new Error('SUPABASE_URL ausente.')
  }

  const secretKey = getJsonKey(
    'SUPABASE_SECRET_KEYS',
    [
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  )

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export async function requireUser(
  req: Request,
): Promise<{
  userClient: SupabaseClient
  adminClient: SupabaseClient
  user: User
}> {
  const userClient = createUserClient(req)
  const adminClient = createAdminClient()

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()

  if (error || !user) {
    throw new Error('Sessao invalida.')
  }

  const { data: profile, error: profileError } =
    await userClient
      .from('profiles')
      .select('id, active')
      .eq('id', user.id)
      .single()

  if (profileError || !profile?.active) {
    throw new Error(
      'Usuario inexistente ou inativo.',
    )
  }

  return {
    userClient,
    adminClient,
    user,
  }
}
