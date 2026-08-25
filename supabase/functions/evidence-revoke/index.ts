/* eslint-disable */

import {
  errorResponse,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  assertEvidenceManage,
  getPermissionSet,
} from '../_shared/permissions.ts'
import {
  requireUser,
} from '../_shared/supabase.ts'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const options = handleOptions(req)

  if (options) {
    return options
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: 'Metodo nao permitido.' },
      405,
    )
  }

  try {
    const body = await req.json()

    const evidenceId = String(
      body.evidence_id ?? '',
    ).trim()

    const reason = String(
      body.reason ?? '',
    ).trim()

    if (!uuidPattern.test(evidenceId)) {
      throw new Error(
        'ID da evidencia invalido.',
      )
    }

    if (!reason) {
      throw new Error(
        'Justificativa de revogacao obrigatoria.',
      )
    }

    const {
      userClient,
      adminClient,
      user,
    } = await requireUser(req)

    const {
      data: evidence,
      error,
    } = await adminClient
      .from('evidence_files')
      .select(
        'id, category_code, asset_id, audit_id, audit_item_id, stock_unit_id, uploaded_by, status, revoke_reason, revoked_at, revoked_by',
      )
      .eq('id', evidenceId)
      .single()

    if (error || !evidence) {
      return jsonResponse(
        {
          error:
            'Evidencia nao encontrada.',
        },
        404,
      )
    }

    const permissions =
      await getPermissionSet(
        userClient,
        user.id,
      )

    assertEvidenceManage(
      permissions,
      evidence,
    )

    if (
      evidence.status === 'revoked'
    ) {
      return jsonResponse({
        ok: true,
        evidence,
        alreadyRevoked: true,
      })
    }

    const {
      data: updated,
      error: updateError,
    } = await adminClient
      .from('evidence_files')
      .update({
        status: 'revoked',
        revoked_at:
          new Date().toISOString(),
        revoked_by: user.id,
        revoke_reason: reason,
      })
      .eq('id', evidenceId)
      .select(
        'id, category_code, asset_id, audit_id, audit_item_id, stock_unit_id, original_name, mime_type, status, revoked_at, revoked_by, revoke_reason, created_at',
      )
      .single()

    if (
      updateError ||
      !updated
    ) {
      throw new Error(
        updateError?.message ??
          'Falha ao revogar evidencia.',
      )
    }

    return jsonResponse({
      ok: true,
      evidence: updated,
    })
  } catch (error) {
    return errorResponse(
      error,
      'Falha ao revogar evidencia.',
      400,
    )
  }
})
