/* eslint-disable */

import {
  errorResponse,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  createAdminClient,
} from '../_shared/supabase.ts'

type OutboxRow = {
  id: string
  request_id: string | null
  maintenance_id: string | null
  recipient: string
  subject: string
  body: string
  attempts: number
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
    const appsScriptUrl =
      Deno.env.get(
        'MAINTENANCE_NOTIFY_APPS_SCRIPT_URL',
      )
    const sharedSecret =
      Deno.env.get(
        'MAINTENANCE_NOTIFY_SHARED_SECRET',
      )

    if (
      !appsScriptUrl ||
      !sharedSecret
    ) {
      throw new Error(
        'Notificacoes de manutencao ainda nao foram configuradas.',
      )
    }

    const body = (
      await req.json().catch(
        () => ({}),
      )
    ) as Record<string, unknown>

    const requestId =
      typeof body.request_id ===
      'string'
        ? body.request_id.trim()
        : ''

    const maintenanceId =
      typeof body.maintenance_id ===
      'string'
        ? body.maintenance_id.trim()
        : ''

    const admin =
      createAdminClient()

    let query = admin
      .from(
        'maintenance_notification_outbox',
      )
      .select(
        'id, request_id, maintenance_id, recipient, subject, body, attempts',
      )
      .in(
        'status',
        ['pending', 'failed'],
      )
      .lt('attempts', 5)
      .order(
        'created_at',
        {
          ascending: true,
        },
      )
      .limit(20)

    if (requestId) {
      query =
        query.eq(
          'request_id',
          requestId,
        )
    }

    if (maintenanceId) {
      query =
        query.eq(
          'maintenance_id',
          maintenanceId,
        )
    }

    const {
      data,
      error,
    } = await query

    if (error) {
      throw new Error(
        error.message,
      )
    }

    let sent = 0
    let failed = 0

    for (
      const row of
        (data ?? []) as OutboxRow[]
    ) {
      try {
        const response =
          await fetch(
            appsScriptUrl,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                secret:
                  sharedSecret,
                to: row.recipient,
                subject:
                  row.subject,
                body:
                  row.body,
              }),
            },
          )

        const responseText =
          await response.text()

        let accepted =
          response.ok

        if (accepted) {
          try {
            const parsed =
              JSON.parse(
                responseText,
              ) as {
                ok?: boolean
              }

            accepted =
              parsed.ok === true
          } catch {
            accepted = false
          }
        }

        if (!accepted) {
          throw new Error(
            `Bridge recusou a mensagem: ${response.status} ${responseText.slice(0, 500)}`,
          )
        }

        const {
          error: updateError,
        } = await admin
          .from(
            'maintenance_notification_outbox',
          )
          .update({
            status: 'sent',
            attempts:
              row.attempts + 1,
            sent_at:
              new Date()
                .toISOString(),
            last_error: null,
          })
          .eq('id', row.id)

        if (updateError) {
          throw new Error(
            updateError.message,
          )
        }

        sent += 1
      } catch (error) {
        failed += 1

        await admin
          .from(
            'maintenance_notification_outbox',
          )
          .update({
            status: 'failed',
            attempts:
              row.attempts + 1,
            last_error:
              error instanceof Error
                ? error.message.slice(
                    0,
                    2000,
                  )
                : 'Falha desconhecida.',
          })
          .eq('id', row.id)
      }
    }

    return jsonResponse({
      ok: true,
      processed:
        (data ?? []).length,
      sent,
      failed,
    })
  } catch (error) {
    return errorResponse(
      error,
      'Falha no envio das notificacoes.',
      400,
    )
  }
})
