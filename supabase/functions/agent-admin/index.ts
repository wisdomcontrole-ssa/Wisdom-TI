/* eslint-disable */

import {
  errorResponse,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  getPermissionSet,
} from '../_shared/permissions.ts'
import {
  requireUser,
} from '../_shared/supabase.ts'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requiredString(
  value: unknown,
  label: string,
) {
  if (typeof value !== 'string') {
    throw new Error(`${label} invalido.`)
  }

  const clean = value.trim()

  if (!clean) {
    throw new Error(`${label} obrigatorio.`)
  }

  return clean
}

function requiredUuid(
  value: unknown,
  label: string,
) {
  const clean = requiredString(
    value,
    label,
  )

  if (!uuidPattern.test(clean)) {
    throw new Error(`${label} invalido.`)
  }

  return clean
}

function base64Url(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, '0'),
    )
    .join('')
}

async function createCredential() {
  const random = new Uint8Array(32)
  crypto.getRandomValues(random)

  const token = `wti_${base64Url(random)}`

  return {
    token,
    tokenHash: await sha256(token),
    tokenPrefix: token.slice(0, 12),
  }
}

async function writeAudit(
  adminClient: any,
  actorUserId: string,
  action: string,
  entityId: string,
  oldData: unknown,
  newData: unknown,
  metadata: Record<string, unknown>,
) {
  const { error } = await adminClient
    .from('audit_logs')
    .insert({
      actor_user_id: actorUserId,
      action,
      entity_type: 'agent_devices',
      entity_id: entityId,
      old_data: oldData,
      new_data: newData,
      metadata: {
        module: 'agent_inventory',
        source: 'agent-admin',
        ...metadata,
      },
    })

  if (error) {
    throw new Error(
      `Falha ao registrar auditoria: ${error.message}`,
    )
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req)

  if (options) {
    return options
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        error: 'Metodo nao permitido.',
      },
      405,
    )
  }

  try {
    const {
      userClient,
      adminClient,
      user,
    } = await requireUser(req)

    const permissions = await getPermissionSet(
      userClient,
      user.id,
    )

    if (
      !permissions.has('assets.update') &&
      !permissions.has('alerts.manage')
    ) {
      throw new Error(
        'Sem permissao para administrar agentes.',
      )
    }

    const body =
      (await req.json()) as Record<
        string,
        unknown
      >

    const action = requiredString(
      body.action,
      'Acao',
    )

    if (action === 'create') {
      const assetId = requiredUuid(
        body.asset_id,
        'Ativo',
      )

      const { data: asset, error: assetError } =
        await adminClient
          .from('assets')
          .select(
            'id, asset_code, status, hostname, manufacturer, model, serial_number, os_name',
          )
          .eq('id', assetId)
          .single()

      if (assetError || !asset) {
        throw new Error(
          'Ativo nao encontrado.',
        )
      }

      if (
        asset.status === 'retired' ||
        asset.status === 'disposed'
      ) {
        throw new Error(
          'Ativo baixado ou descartado nao pode receber novo agente.',
        )
      }

      const {
        data: existing,
        error: existingError,
      } = await adminClient
        .from('agent_devices')
        .select('id')
        .eq('asset_id', assetId)
        .eq('status', 'active')
        .maybeSingle()

      if (existingError) {
        throw new Error(existingError.message)
      }

      if (existing) {
        throw new Error(
          'Este ativo ja possui agente ativo.',
        )
      }

      const credential = await createCredential()

      const {
        data: agent,
        error: agentError,
      } = await adminClient
        .from('agent_devices')
        .insert({
          asset_id: assetId,
          label: asset.asset_code,
          status: 'active',
          token_hash: credential.tokenHash,
          token_prefix: credential.tokenPrefix,
          created_by: user.id,
        })
        .select(
          'id, asset_id, token_prefix',
        )
        .single()

      if (agentError || !agent) {
        throw new Error(
          agentError?.message ??
            'Falha ao criar agente.',
        )
      }

      const { error: expectationError } =
        await adminClient
          .from('agent_inventory_expectations')
          .upsert(
            {
              asset_id: assetId,
              expected_hostname: asset.hostname,
              expected_manufacturer:
                asset.manufacturer,
              expected_model: asset.model,
              expected_serial_number:
                asset.serial_number,
              expected_os_name: asset.os_name,
              updated_by: user.id,
            },
            {
              onConflict: 'asset_id',
              ignoreDuplicates: true,
            },
          )

      if (expectationError) {
        throw new Error(
          `Agente criado, mas baseline inicial falhou: ${expectationError.message}`,
        )
      }

      await writeAudit(
        adminClient,
        user.id,
        'agent.create',
        agent.id,
        null,
        {
          id: agent.id,
          asset_id: assetId,
          token_prefix: credential.tokenPrefix,
          status: 'active',
        },
        {
          asset_code: asset.asset_code,
        },
      )

      return jsonResponse(
        {
          ok: true,
          agent_id: agent.id,
          asset_id: assetId,
          token: credential.token,
          token_prefix: credential.tokenPrefix,
        },
        201,
      )
    }

    if (action === 'rotate') {
      const agentId = requiredUuid(
        body.agent_id,
        'Agente',
      )

      const {
        data: agent,
        error: agentError,
      } = await adminClient
        .from('agent_devices')
        .select(
          'id, asset_id, status, token_prefix',
        )
        .eq('id', agentId)
        .single()

      if (agentError || !agent) {
        throw new Error(
          'Agente nao encontrado.',
        )
      }

      if (agent.status !== 'active') {
        throw new Error(
          'Somente agente ativo pode rotacionar credencial.',
        )
      }

      const credential = await createCredential()

      const { error: updateError } =
        await adminClient
          .from('agent_devices')
          .update({
            token_hash: credential.tokenHash,
            token_prefix: credential.tokenPrefix,
          })
          .eq('id', agentId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await writeAudit(
        adminClient,
        user.id,
        'agent.token.rotate',
        agentId,
        {
          token_prefix: agent.token_prefix,
        },
        {
          token_prefix: credential.tokenPrefix,
        },
        {
          asset_id: agent.asset_id,
        },
      )

      return jsonResponse({
        ok: true,
        agent_id: agentId,
        asset_id: agent.asset_id,
        token: credential.token,
        token_prefix: credential.tokenPrefix,
      })
    }

    if (action === 'revoke') {
      const agentId = requiredUuid(
        body.agent_id,
        'Agente',
      )
      const reason = requiredString(
        body.reason,
        'Motivo',
      )

      const {
        data: agent,
        error: agentError,
      } = await adminClient
        .from('agent_devices')
        .select(
          'id, asset_id, status, token_prefix',
        )
        .eq('id', agentId)
        .single()

      if (agentError || !agent) {
        throw new Error(
          'Agente nao encontrado.',
        )
      }

      if (agent.status === 'revoked') {
        return jsonResponse({
          ok: true,
          agent_id: agentId,
          asset_id: agent.asset_id,
        })
      }

      const now = new Date().toISOString()

      const { error: revokeError } =
        await adminClient
          .from('agent_devices')
          .update({
            status: 'revoked',
            revoked_by: user.id,
            revoked_at: now,
            revoke_reason: reason,
          })
          .eq('id', agentId)

      if (revokeError) {
        throw new Error(revokeError.message)
      }

      const { error: alertError } =
        await adminClient
          .from('system_alerts')
          .update({
            status: 'resolved',
            resolved_at: now,
            resolution_note: 'Agente revogado.',
          })
          .eq('agent_id', agentId)
          .neq('status', 'resolved')

      if (alertError) {
        throw new Error(alertError.message)
      }

      await writeAudit(
        adminClient,
        user.id,
        'agent.revoke',
        agentId,
        {
          status: agent.status,
          token_prefix: agent.token_prefix,
        },
        {
          status: 'revoked',
          reason,
        },
        {
          asset_id: agent.asset_id,
        },
      )

      return jsonResponse({
        ok: true,
        agent_id: agentId,
        asset_id: agent.asset_id,
      })
    }

    throw new Error(
      'Acao administrativa desconhecida.',
    )
  } catch (error) {
    return errorResponse(
      error,
      'Falha na administracao de agentes.',
      400,
    )
  }
})
