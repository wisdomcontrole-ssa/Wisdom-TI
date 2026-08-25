import { supabase } from '../lib/supabase'
import type {
  EvidenceContext,
  EvidenceRecord,
  UploadEvidenceInput,
} from '../types/evidence'

function client() {
  if (!supabase) {
    throw new Error('Supabase não está configurado.')
  }

  return supabase
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message)
  }
}

export async function listEvidence(
  context: EvidenceContext,
) {
  let query = client()
    .from('evidence_files')
    .select(
      'id, category_code, asset_id, audit_id, audit_item_id, stock_unit_id, original_name, stored_name, mime_type, byte_size, sha256, drive_file_id, drive_folder_id, capture_method, caption, captured_at, uploaded_by, status, created_at, revoked_at, revoked_by, revoke_reason, metadata',
    )
    .order('created_at', { ascending: false })

  if (context.auditItemId) {
    query = query.eq(
      'audit_item_id',
      context.auditItemId,
    )
  } else if (context.assetId) {
    query = query.eq(
      'asset_id',
      context.assetId,
    )
  } else if (context.auditId) {
    query = query.eq(
      'audit_id',
      context.auditId,
    )
  } else if (context.stockUnitId) {
    query = query.eq(
      'stock_unit_id',
      context.stockUnitId,
    )
  } else {
    throw new Error(
      'Contexto de evidência não informado.',
    )
  }

  const { data, error } = await query

  throwIfError(error)

  return (data ?? []) as EvidenceRecord[]
}

export async function uploadEvidence(
  input: UploadEvidenceInput,
) {
  const body = new FormData()

  body.append('file', input.file)
  body.append(
    'category_code',
    input.categoryCode,
  )
  body.append(
    'capture_method',
    input.captureMethod,
  )

  if (input.caption?.trim()) {
    body.append(
      'caption',
      input.caption.trim(),
    )
  }

  if (input.capturedAt) {
    const capturedAt =
      new Date(input.capturedAt)

    if (
      Number.isNaN(
        capturedAt.getTime(),
      )
    ) {
      throw new Error(
        'Data/hora da captura inválida.',
      )
    }

    body.append(
      'captured_at',
      capturedAt.toISOString(),
    )
  }

  if (input.context.assetId) {
    body.append(
      'asset_id',
      input.context.assetId,
    )
  }

  if (input.context.auditId) {
    body.append(
      'audit_id',
      input.context.auditId,
    )
  }

  if (input.context.auditItemId) {
    body.append(
      'audit_item_id',
      input.context.auditItemId,
    )
  }

  if (input.context.stockUnitId) {
    body.append(
      'stock_unit_id',
      input.context.stockUnitId,
    )
  }

  const { data, error } =
    await client().functions.invoke(
      'evidence-upload',
      {
        body,
      },
    )

  throwIfError(error)

  const payload = data as {
    ok?: boolean
    evidence?: EvidenceRecord
    error?: string
  }

  if (!payload?.ok || !payload.evidence) {
    throw new Error(
      payload?.error ??
        'Não foi possível registrar a evidência.',
    )
  }

  return payload.evidence
}

export async function revokeEvidence(
  evidenceId: string,
  reason: string,
) {
  const { data, error } =
    await client().functions.invoke(
      'evidence-revoke',
      {
        body: {
          evidence_id: evidenceId,
          reason: reason.trim(),
        },
      },
    )

  throwIfError(error)

  const payload = data as {
    ok?: boolean
    evidence?: EvidenceRecord
    error?: string
  }

  if (!payload?.ok || !payload.evidence) {
    throw new Error(
      payload?.error ??
        'Não foi possível revogar a evidência.',
    )
  }

  return payload.evidence
}

export async function fetchEvidenceBlob(
  evidenceId: string,
) {
  const sb = client()

  const {
    data: { session },
    error: sessionError,
  } = await sb.auth.getSession()

  throwIfError(sessionError)

  if (!session?.access_token) {
    throw new Error(
      'Sessão inválida. Entre novamente no sistema.',
    )
  }

  const baseUrl =
    import.meta.env.VITE_SUPABASE_URL

  const publishableKey =
    import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY

  if (!baseUrl || !publishableKey) {
    throw new Error(
      'Configuração pública do Supabase ausente.',
    )
  }

  const response = await fetch(
    `${baseUrl}/functions/v1/evidence-file?id=${encodeURIComponent(
      evidenceId,
    )}`,
    {
      method: 'GET',
      headers: {
        Authorization:
          `Bearer ${session.access_token}`,
        apikey: publishableKey,
      },
    },
  )

  if (!response.ok) {
    let message =
      'Não foi possível abrir a evidência.'

    try {
      const payload =
        (await response.json()) as {
          error?: string
        }

      if (payload.error) {
        message = payload.error
      }
    } catch {
      // Resposta sem JSON.
    }

    throw new Error(message)
  }

  return response.blob()
}

export function getDriveUrl(
  evidence: EvidenceRecord,
) {
  const value =
    evidence.metadata?.drive_url

  return typeof value === 'string' &&
    value.startsWith('https://')
    ? value
    : null
}
