/* eslint-disable */

import {
  callAppsScript,
} from '../_shared/apps-script.ts'
import {
  corsHeaders,
  errorResponse,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  assertEvidenceView,
  getPermissionSet,
} from '../_shared/permissions.ts'
import {
  requireUser,
} from '../_shared/supabase.ts'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type DownloadResult = {
  fileId: string
  name: string
  mimeType: string
  fileBase64: string
}

function base64ToBytes(
  value: string,
) {
  const binary = atob(value)
  const bytes =
    new Uint8Array(binary.length)

  for (
    let index = 0;
    index < binary.length;
    index++
  ) {
    bytes[index] =
      binary.charCodeAt(index)
  }

  return bytes
}

Deno.serve(async (req) => {
  const options = handleOptions(req)

  if (options) {
    return options
  }

  if (req.method !== 'GET') {
    return jsonResponse(
      { error: 'Metodo nao permitido.' },
      405,
    )
  }

  try {
    const url = new URL(req.url)
    const id =
      url.searchParams.get('id') ?? ''

    if (!uuidPattern.test(id)) {
      throw new Error(
        'ID da evidencia invalido.',
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
        'id, asset_id, audit_id, audit_item_id, stock_unit_id, uploaded_by, original_name, mime_type, drive_file_id, status',
      )
      .eq('id', id)
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

    assertEvidenceView(
      permissions,
      evidence,
      user.id,
    )

    const drive =
      await callAppsScript<DownloadResult>(
        'download',
        {
          fileId:
            evidence.drive_file_id,
        },
      )

    const bytes =
      base64ToBytes(
        drive.fileBase64,
      )

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type':
          evidence.mime_type,
        'Content-Disposition':
          `inline; filename*=UTF-8''${encodeURIComponent(
            evidence.original_name,
          )}`,
        'Cache-Control':
          'private, max-age=60',
        'X-Evidence-Status':
          evidence.status,
      },
    })
  } catch (error) {
    return errorResponse(
      error,
      'Falha ao abrir evidencia.',
      400,
    )
  }
})
