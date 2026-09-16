/**
 * INVENTARIO TI - NOTIFICACOES DE MANUTENCAO
 *
 * Script Properties obrigatorias:
 * - MAINTENANCE_NOTIFY_SHARED_SECRET
 *
 * Publicar como Web App executando como o proprietario.
 * O segredo nunca deve ser colocado no frontend.
 */

function doPost(e) {
  try {
    const raw =
      e && e.postData
        ? e.postData.contents
        : '{}';

    const payload =
      JSON.parse(raw);

    const expected =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          'MAINTENANCE_NOTIFY_SHARED_SECRET',
        );

    if (
      !expected ||
      payload.secret !== expected
    ) {
      return jsonOutput_({
        ok: false,
        error: 'Acesso recusado.',
      });
    }

    const to =
      String(
        payload.to || '',
      ).trim();

    const subject =
      String(
        payload.subject || '',
      ).trim();

    const body =
      String(
        payload.body || '',
      ).trim();

    if (
      !to ||
      !subject ||
      !body
    ) {
      return jsonOutput_({
        ok: false,
        error:
          'Destinatario, assunto e mensagem sao obrigatorios.',
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        to,
      )
    ) {
      return jsonOutput_({
        ok: false,
        error:
          'Destinatario invalido.',
      });
    }

    MailApp.sendEmail({
      to: to,
      subject:
        subject.slice(
          0,
          250,
        ),
      body:
        body.slice(
          0,
          12000,
        ),
      name:
        'Central de TI',
    });

    return jsonOutput_({
      ok: true,
    });
  } catch (error) {
    return jsonOutput_({
      ok: false,
      error:
        String(
          error &&
          error.message
            ? error.message
            : error,
        ).slice(
          0,
          1000,
        ),
    });
  }
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        value,
      ),
    )
    .setMimeType(
      ContentService.MimeType.JSON,
    );
}
