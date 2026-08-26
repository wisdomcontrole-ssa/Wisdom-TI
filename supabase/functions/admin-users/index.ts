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

function requiredEmail(value: unknown) {
  const email = requiredString(
    value,
    'E-mail',
  ).toLowerCase()

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    throw new Error('E-mail invalido.')
  }

  return email
}

async function getRole(
  adminClient: any,
  roleId: string,
) {
  const { data, error } =
    await adminClient
      .from('roles')
      .select(
        'id, code, name, description, is_system',
      )
      .eq('id', roleId)
      .single()

  if (error || !data) {
    throw new Error('Papel nao encontrado.')
  }

  return data
}

async function getProfile(
  adminClient: any,
  userId: string,
) {
  const { data, error } =
    await adminClient
      .from('profiles')
      .select(
        'id, full_name, email, role_id, active, last_seen_at, created_at, updated_at',
      )
      .eq('id', userId)
      .single()

  if (error || !data) {
    throw new Error('Usuario nao encontrado.')
  }

  return data
}

async function assertAdminContinuity(
  adminClient: any,
  target: any,
  nextRoleCode: string,
  nextActive: boolean,
) {
  const { data: currentRole } =
    await adminClient
      .from('roles')
      .select('code')
      .eq('id', target.role_id)
      .single()

  if (currentRole?.code !== 'admin') {
    return
  }

  if (
    nextRoleCode === 'admin' &&
    nextActive
  ) {
    return
  }

  const { data: adminRole, error } =
    await adminClient
      .from('roles')
      .select('id')
      .eq('code', 'admin')
      .single()

  if (error || !adminRole) {
    throw new Error(
      'Papel administrador nao encontrado.',
    )
  }

  const {
    count,
    error: countError,
  } = await adminClient
    .from('profiles')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('role_id', adminRole.id)
    .eq('active', true)

  if (countError) {
    throw new Error(
      'Nao foi possivel validar administradores ativos.',
    )
  }

  if ((count ?? 0) <= 1) {
    throw new Error(
      'O ultimo administrador ativo nao pode ser removido ou desativado.',
    )
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
      entity_type: 'profiles',
      entity_id: entityId,
      old_data: oldData,
      new_data: newData,
      metadata: {
        module: 'administration',
        source: 'edge_function',
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

    const permissions =
      await getPermissionSet(
        userClient,
        user.id,
      )

    if (!permissions.has('users.manage')) {
      throw new Error(
        'Sem permissao para gerenciar usuarios.',
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

    if (action === 'invite') {
      const fullName = requiredString(
        body.full_name,
        'Nome',
      )
      const email = requiredEmail(body.email)
      const roleId = requiredUuid(
        body.role_id,
        'Papel',
      )
      const role = await getRole(
        adminClient,
        roleId,
      )

      let redirectTo: string | undefined

      const { data: redirectSetting } =
        await adminClient
          .from('system_settings')
          .select('value')
          .eq(
            'key',
            'auth.invite_redirect_url',
          )
          .maybeSingle()

      if (
        typeof redirectSetting?.value ===
          'string' &&
        redirectSetting.value.trim()
      ) {
        redirectTo =
          redirectSetting.value.trim()
      }

      const {
        data: inviteData,
        error: inviteError,
      } =
        await adminClient.auth.admin
          .inviteUserByEmail(
            email,
            {
              data: {
                full_name: fullName,
              },
              ...(redirectTo
                ? { redirectTo }
                : {}),
            },
          )

      if (
        inviteError ||
        !inviteData.user
      ) {
        throw new Error(
          inviteError?.message ??
            'Falha ao enviar convite.',
        )
      }

      const invitedUser =
        inviteData.user

      const {
        data: profile,
        error: profileError,
      } = await adminClient
        .from('profiles')
        .upsert(
          {
            id: invitedUser.id,
            full_name: fullName,
            email,
            role_id: roleId,
            active: true,
          },
          {
            onConflict: 'id',
          },
        )
        .select(
          'id, full_name, email, role_id, active, last_seen_at, created_at, updated_at',
        )
        .single()

      if (profileError || !profile) {
        throw new Error(
          profileError?.message ??
            'Convite enviado, mas o perfil nao foi configurado.',
        )
      }

      await writeAudit(
        adminClient,
        user.id,
        'user.invite',
        invitedUser.id,
        null,
        {
          full_name: fullName,
          email,
          role_id: roleId,
          active: true,
        },
        {
          role_code: role.code,
        },
      )

      return jsonResponse(
        {
          ok: true,
          user: profile,
        },
        201,
      )
    }

    if (action === 'update') {
      const targetUserId = requiredUuid(
        body.user_id,
        'Usuario',
      )
      const fullName = requiredString(
        body.full_name,
        'Nome',
      )
      const roleId = requiredUuid(
        body.role_id,
        'Papel',
      )
      const active =
        typeof body.active === 'boolean'
          ? body.active
          : (() => {
              throw new Error(
                'Estado ativo invalido.',
              )
            })()

      if (
        targetUserId === user.id &&
        !active
      ) {
        throw new Error(
          'Voce nao pode desativar o proprio acesso.',
        )
      }

      const target = await getProfile(
        adminClient,
        targetUserId,
      )
      const nextRole = await getRole(
        adminClient,
        roleId,
      )

      await assertAdminContinuity(
        adminClient,
        target,
        nextRole.code,
        active,
      )

      const {
        data: updated,
        error: updateError,
      } = await adminClient
        .from('profiles')
        .update({
          full_name: fullName,
          role_id: roleId,
          active,
        })
        .eq('id', targetUserId)
        .select(
          'id, full_name, email, role_id, active, last_seen_at, created_at, updated_at',
        )
        .single()

      if (updateError || !updated) {
        throw new Error(
          updateError?.message ??
            'Falha ao atualizar usuario.',
        )
      }


      await writeAudit(
        adminClient,
        user.id,
        'user.update',
        targetUserId,
        {
          full_name: target.full_name,
          email: target.email,
          role_id: target.role_id,
          active: target.active,
        },
        {
          full_name: fullName,
          email: target.email,
          role_id: roleId,
          active,
        },
        {
          role_code: nextRole.code,
        },
      )

      return jsonResponse({
        ok: true,
        user: updated,
      })
    }

    throw new Error(
      'Acao administrativa desconhecida.',
    )
  } catch (error) {
    return errorResponse(
      error,
      'Falha na administracao de usuarios.',
      400,
    )
  }
})
