/* eslint-disable */

import {
  callAppsScript,
} from '../_shared/apps-script.ts'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  assertSettingsManage,
  getPermissionSet,
} from '../_shared/permissions.ts'
import {
  requireUser,
} from '../_shared/supabase.ts'

type HealthData = {
  bridgeVersion: string
  rootFolder: {
    id: string
    name: string
  }
  baseFolders: Array<{
    id: string
    name: string
  }>
  ownerEmail?: string | null
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
    const {
      userClient,
      user,
    } = await requireUser(req)

    const permissions =
      await getPermissionSet(
        userClient,
        user.id,
      )

    assertSettingsManage(permissions)

    const health =
      await callAppsScript<HealthData>(
        'health',
      )

    return jsonResponse({
      ok: true,
      integration:
        'google-drive-apps-script',
      ...health,
    })
  } catch (error) {
    return errorResponse(
      error,
      'Falha na integracao Google Drive.',
      400,
    )
  }
})
