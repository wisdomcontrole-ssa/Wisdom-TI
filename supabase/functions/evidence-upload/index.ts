/* eslint-disable */

import {
  callAppsScript,
} from '../_shared/apps-script.ts'
import {
  buildFolderRoute,
  optionalUuid,
  resolveEvidenceContext,
} from '../_shared/context.ts'
import {
  allowedMimeTypes,
  buildStoredName,
  captureMethods,
  sha256Hex,
} from '../_shared/evidence.ts'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  assertEvidenceUpload,
  getPermissionSet,
} from '../_shared/permissions.ts'
import {
  requireUser,
} from '../_shared/supabase.ts'

const maxAppsScriptEvidenceBytes =
  5 * 1024 * 1024

type UploadResult = {
  fileId: string
  folderId: string
  storedName: string
  mimeType: string
  byteSize: number
  url: string
}

function bytesToBase64(
  bytes: Uint8Array,
) {
  let binary = ''
  const chunkSize = 0x8000

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk = bytes.subarray(
      offset,
      Math.min(
        offset + chunkSize,
        bytes.length,
      ),
    )

    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

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
    const {
      userClient,
      adminClient,
      user,
    } = await requireUser(req)

    const form = await req.formData()
    const fileEntry = form.get('file')

    if (!(fileEntry instanceof File)) {
      throw new Error(
        'Arquivo nao informado.',
      )
    }

    if (
      fileEntry.size <= 0 ||
      fileEntry.size >
        maxAppsScriptEvidenceBytes
    ) {
      throw new Error(
        'Arquivo deve ter no maximo 5 MB.',
      )
    }

    const mimeType =
      fileEntry.type ||
      'application/octet-stream'

    if (!allowedMimeTypes.has(mimeType)) {
      throw new Error(
        'Formato nao permitido. Use JPEG, PNG, WEBP, HEIC/HEIF ou PDF.',
      )
    }

    const categoryCode = String(
      form.get('category_code') ?? '',
    )
      .trim()
      .toLowerCase()

    if (!categoryCode) {
      throw new Error(
        'Categoria de evidencia obrigatoria.',
      )
    }

    const {
      data: category,
      error: categoryError,
    } = await adminClient
      .from('evidence_categories')
      .select('code, active')
      .eq('code', categoryCode)
      .eq('active', true)
      .single()

    if (categoryError || !category) {
      throw new Error(
        'Categoria de evidencia invalida.',
      )
    }

    const captureMethod = String(
      form.get('capture_method') ?? 'file',
    )
      .trim()
      .toLowerCase()

    if (!captureMethods.has(captureMethod)) {
      throw new Error(
        'Metodo de captura invalido.',
      )
    }

    const context =
      await resolveEvidenceContext(
        adminClient,
        {
          assetId: optionalUuid(
            form.get('asset_id'),
          ),
          auditId: optionalUuid(
            form.get('audit_id'),
          ),
          auditItemId: optionalUuid(
            form.get('audit_item_id'),
          ),
          stockUnitId: optionalUuid(
            form.get('stock_unit_id'),
          ),
        },
      )

    const permissions =
      await getPermissionSet(
        userClient,
        user.id,
      )

    assertEvidenceUpload(permissions, {
      categoryCode,
      assetId: context.assetId,
      auditId: context.auditId,
      auditItemId:
        context.auditItemId,
      stockUnitId:
        context.stockUnitId,
    })

    const bytes = new Uint8Array(
      await fileEntry.arrayBuffer(),
    )

    const sha256 =
      await sha256Hex(bytes)

    const referenceCode =
      context.assetCode ??
      context.auditCode ??
      context.stockCode ??
      'EVIDENCIA'

    const storedName = buildStoredName(
      referenceCode,
      categoryCode,
      mimeType,
    )

    const route = buildFolderRoute(
      context,
      categoryCode,
    )

    const upload =
      await callAppsScript<UploadResult>(
        'upload',
        {
          route,
          storedName,
          mimeType,
          byteSize: bytes.byteLength,
          fileBase64:
            bytesToBase64(bytes),
        },
      )

    const caption = String(
      form.get('caption') ?? '',
    ).trim()

    const capturedAtRaw = String(
      form.get('captured_at') ?? '',
    ).trim()

    let capturedAt: string | null = null

    if (capturedAtRaw) {
      const parsed =
        new Date(capturedAtRaw)

      if (
        Number.isNaN(parsed.getTime())
      ) {
        throw new Error(
          'Data de captura invalida.',
        )
      }

      capturedAt =
        parsed.toISOString()
    }

    const {
      data: evidence,
      error: insertError,
    } = await adminClient
      .from('evidence_files')
      .insert({
        category_code: categoryCode,
        asset_id: context.assetId,
        audit_id: context.auditId,
        audit_item_id:
          context.auditItemId,
        stock_unit_id:
          context.stockUnitId,

        original_name:
          fileEntry.name || storedName,
        stored_name: storedName,

        mime_type: mimeType,
        byte_size: fileEntry.size,
        sha256,

        drive_file_id:
          upload.fileId,
        drive_folder_id:
          upload.folderId,

        capture_method:
          captureMethod,
        caption: caption || null,
        captured_at: capturedAt,

        uploaded_by: user.id,

        metadata: {
          drive_url: upload.url,
          route,
          bridge:
            'google-apps-script',
        },
      })
      .select(
        'id, category_code, asset_id, audit_id, audit_item_id, stock_unit_id, original_name, stored_name, mime_type, byte_size, sha256, capture_method, caption, captured_at, uploaded_by, status, created_at',
      )
      .single()

    if (insertError || !evidence) {
      await callAppsScript(
        'trash',
        {
          fileId: upload.fileId,
        },
      ).catch(() => undefined)

      throw new Error(
        insertError?.message ??
          'Falha ao registrar evidencia no banco.',
      )
    }

    return jsonResponse(
      {
        ok: true,
        evidence,
      },
      201,
    )
  } catch (error) {
    return errorResponse(
      error,
      'Falha ao enviar evidencia.',
      400,
    )
  }
})
