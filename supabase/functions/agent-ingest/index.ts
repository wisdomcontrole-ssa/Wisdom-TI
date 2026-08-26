/* eslint-disable */

import {
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'
import {
  createAdminClient,
} from '../_shared/supabase.ts'

type JsonRecord = Record<string, unknown>

type DivergenceInput = {
  key: string
  kind:
    | 'identity'
    | 'hardware'
    | 'software'
    | 'health'
  severity:
    | 'info'
    | 'warning'
    | 'critical'
  title: string
  expected: unknown
  actual: unknown
}

const MAX_BODY_BYTES = 2_000_000
const MAX_SOFTWARE = 2000
const MAX_DISKS = 100

function stringValue(
  value: unknown,
  max = 500,
) {
  if (typeof value !== 'string') {
    return null
  }

  const clean = value.trim()
  return clean ? clean.slice(0, max) : null
}

function numberValue(value: unknown) {
  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : null
}

function normalize(value: unknown) {
  return (
    stringValue(value)
      ?.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  )
}

function jsonArray(
  value: unknown,
  max: number,
) {
  return Array.isArray(value)
    ? value.slice(0, max)
    : []
}

function jsonObject(value: unknown) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
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

function addTextDivergence(
  list: DivergenceInput[],
  input: {
    key: string
    kind: DivergenceInput['kind']
    severity: DivergenceInput['severity']
    title: string
    expected: unknown
    actual: unknown
    fuzzy?: boolean
  },
) {
  const expected = normalize(input.expected)

  if (!expected) {
    return
  }

  const actual = normalize(input.actual)
  const matches = input.fuzzy
    ? actual.includes(expected) ||
      expected.includes(actual)
    : expected === actual

  if (!matches) {
    list.push({
      key: input.key,
      kind: input.kind,
      severity: input.severity,
      title: input.title,
      expected: input.expected,
      actual: input.actual,
    })
  }
}

async function upsertDivergence(
  adminClient: any,
  agent: any,
  snapshotId: string,
  item: DivergenceInput,
) {
  const now = new Date().toISOString()

  const {
    data: existing,
    error: existingError,
  } = await adminClient
    .from('agent_divergences')
    .select('id')
    .eq('agent_id', agent.id)
    .eq('divergence_key', item.key)
    .eq('status', 'open')
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  let divergenceId: string

  if (existing) {
    const {
      data: updated,
      error: updateError,
    } = await adminClient
      .from('agent_divergences')
      .update({
        snapshot_id: snapshotId,
        kind: item.kind,
        severity: item.severity,
        title: item.title,
        expected: item.expected,
        actual: item.actual,
        last_detected_at: now,
      })
      .eq('id', existing.id)
      .select('id')
      .single()

    if (updateError || !updated) {
      throw new Error(
        updateError?.message ??
          'Falha ao atualizar divergencia.',
      )
    }

    divergenceId = updated.id
  } else {
    const {
      data: inserted,
      error: insertError,
    } = await adminClient
      .from('agent_divergences')
      .insert({
        agent_id: agent.id,
        asset_id: agent.asset_id,
        snapshot_id: snapshotId,
        kind: item.kind,
        divergence_key: item.key,
        severity: item.severity,
        title: item.title,
        expected: item.expected,
        actual: item.actual,
        status: 'open',
        first_detected_at: now,
        last_detected_at: now,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      throw new Error(
        insertError?.message ??
          'Falha ao criar divergencia.',
      )
    }

    divergenceId = inserted.id
  }

  const {
    data: existingAlert,
    error: alertQueryError,
  } = await adminClient
    .from('system_alerts')
    .select('id')
    .eq('divergence_id', divergenceId)
    .maybeSingle()

  if (alertQueryError) {
    throw new Error(alertQueryError.message)
  }

  const description =
    `Esperado: ${JSON.stringify(item.expected)}. ` +
    `Detectado: ${JSON.stringify(item.actual)}.`

  if (existingAlert) {
    const { error } = await adminClient
      .from('system_alerts')
      .update({
        severity: item.severity,
        title: item.title,
        description,
        last_seen_at: now,
        metadata: {
          divergence_key: item.key,
          kind: item.kind,
        },
      })
      .eq('id', existingAlert.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await adminClient
      .from('system_alerts')
      .insert({
        source: 'agent',
        agent_id: agent.id,
        asset_id: agent.asset_id,
        divergence_id: divergenceId,
        category: item.kind,
        severity: item.severity,
        status: 'open',
        title: item.title,
        description,
        detected_at: now,
        last_seen_at: now,
        metadata: {
          divergence_key: item.key,
          kind: item.kind,
        },
      })

    if (error) {
      throw new Error(error.message)
    }
  }
}

async function reconcileDivergences(
  adminClient: any,
  agent: any,
  snapshotId: string,
  current: DivergenceInput[],
) {
  const currentKeys = new Set(
    current.map((item) => item.key),
  )

  for (const item of current) {
    await upsertDivergence(
      adminClient,
      agent,
      snapshotId,
      item,
    )
  }

  const {
    data: openRows,
    error,
  } = await adminClient
    .from('agent_divergences')
    .select('id, divergence_key')
    .eq('agent_id', agent.id)
    .eq('status', 'open')

  if (error) {
    throw new Error(error.message)
  }

  const now = new Date().toISOString()

  for (const row of openRows ?? []) {
    if (
      currentKeys.has(
        row.divergence_key as string,
      )
    ) {
      continue
    }

    const { error: resolveError } =
      await adminClient
        .from('agent_divergences')
        .update({
          status: 'resolved',
          resolved_at: now,
        })
        .eq('id', row.id)

    if (resolveError) {
      throw new Error(resolveError.message)
    }

    const { error: alertError } =
      await adminClient
        .from('system_alerts')
        .update({
          status: 'resolved',
          resolved_at: now,
          resolution_note:
            'Divergencia nao foi detectada no inventario mais recente.',
          metadata: {
            auto_resolved: true,
            reason:
              'inventory_matches_expectation',
          },
        })
        .eq('divergence_id', row.id)
        .neq('status', 'resolved')

    if (alertError) {
      throw new Error(alertError.message)
    }
  }
}

async function identityMismatchAlert(
  adminClient: any,
  agent: any,
  machineGuid: string,
) {
  const now = new Date().toISOString()

  const { data: existing } =
    await adminClient
      .from('system_alerts')
      .select('id')
      .eq('agent_id', agent.id)
      .eq('category', 'identity')
      .neq('status', 'resolved')
      .maybeSingle()

  const payload = {
    source: 'agent',
    agent_id: agent.id,
    asset_id: agent.asset_id,
    category: 'identity',
    severity: 'critical',
    status: 'open',
    title:
      'Credencial do agente usada em outra maquina',
    description:
      'O Machine GUID recebido difere da maquina vinculada ao agente.',
    detected_at: now,
    last_seen_at: now,
    metadata: {
      expected_machine_guid:
        agent.machine_guid,
      received_machine_guid: machineGuid,
    },
  }

  if (existing) {
    await adminClient
      .from('system_alerts')
      .update(payload)
      .eq('id', existing.id)
  } else {
    await adminClient
      .from('system_alerts')
      .insert(payload)
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
    const contentLength = Number(
      req.headers.get('content-length') ?? 0,
    )

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_BODY_BYTES
    ) {
      return jsonResponse(
        {
          ok: false,
          error: 'Payload muito grande.',
        },
        413,
      )
    }

    const token = req.headers
      .get('x-wisdom-agent-token')
      ?.trim()

    if (!token || !token.startsWith('wti_')) {
      return jsonResponse(
        {
          ok: false,
          error: 'Credencial do agente ausente.',
        },
        401,
      )
    }

    const raw = await req.text()

    if (
      new TextEncoder().encode(raw).byteLength >
      MAX_BODY_BYTES
    ) {
      return jsonResponse(
        {
          ok: false,
          error: 'Payload muito grande.',
        },
        413,
      )
    }

    let body: JsonRecord

    try {
      body = JSON.parse(raw)
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: 'JSON invalido.',
        },
        400,
      )
    }

    const tokenHash = await sha256(token)
    const adminClient = createAdminClient()

    const {
      data: agent,
      error: agentError,
    } = await adminClient
      .from('agent_devices')
      .select(
        'id, asset_id, status, machine_guid, token_prefix',
      )
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .maybeSingle()

    if (agentError) {
      throw new Error(agentError.message)
    }

    if (!agent) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Credencial do agente invalida ou revogada.',
        },
        401,
      )
    }

    const protocolVersion = stringValue(
      body.protocol_version,
      20,
    )

    if (protocolVersion !== '1') {
      return jsonResponse(
        {
          ok: false,
          error:
            'Versao de protocolo nao suportada.',
        },
        400,
      )
    }

    const agentVersion = stringValue(
      body.agent_version,
      50,
    )

    if (!agentVersion) {
      return jsonResponse(
        {
          ok: false,
          error: 'Versao do agente ausente.',
        },
        400,
      )
    }

    const machine = jsonObject(body.machine)
    const os = jsonObject(body.os)
    const hardware = jsonObject(body.hardware)
    const disks = jsonArray(
      body.disks,
      MAX_DISKS,
    )
    const software = jsonArray(
      body.software,
      MAX_SOFTWARE,
    )

    const machineGuid = stringValue(
      machine.machine_guid,
      200,
    )

    if (!machineGuid) {
      return jsonResponse(
        {
          ok: false,
          error: 'Machine GUID ausente.',
        },
        400,
      )
    }

    if (
      agent.machine_guid &&
      normalize(agent.machine_guid) !==
        normalize(machineGuid)
    ) {
      await identityMismatchAlert(
        adminClient,
        agent,
        machineGuid,
      )

      return jsonResponse(
        {
          ok: false,
          error:
            'Identidade da maquina nao corresponde ao agente.',
        },
        403,
      )
    }

    const collectedAt = stringValue(
      body.collected_at,
      80,
    )
    const collectedDate = collectedAt
      ? new Date(collectedAt)
      : new Date()

    if (Number.isNaN(collectedDate.getTime())) {
      return jsonResponse(
        {
          ok: false,
          error: 'Data da coleta invalida.',
        },
        400,
      )
    }

    const payloadHash = await sha256(raw)

    const snapshotPayload = {
      agent_id: agent.id,
      asset_id: agent.asset_id,
      protocol_version: protocolVersion,
      agent_version: agentVersion,
      collected_at: collectedDate.toISOString(),
      payload_hash: payloadHash,
      machine_guid: machineGuid,
      hostname: stringValue(machine.hostname),
      manufacturer: stringValue(
        machine.manufacturer,
      ),
      model: stringValue(machine.model),
      serial_number: stringValue(
        machine.serial_number,
      ),
      os_name: stringValue(os.name),
      os_version: stringValue(os.version),
      os_build: stringValue(os.build),
      os_architecture: stringValue(
        os.architecture,
      ),
      last_boot_at: stringValue(
        os.last_boot_utc,
        80,
      ),
      cpu_name: stringValue(
        hardware.cpu_name,
      ),
      cpu_cores: numberValue(
        hardware.cpu_cores,
      ),
      logical_processors: numberValue(
        hardware.logical_processors,
      ),
      ram_bytes: numberValue(
        hardware.ram_bytes,
      ),
      disks,
      software,
      health: jsonObject(body.health),
    }

    const {
      data: snapshot,
      error: snapshotError,
    } = await adminClient
      .from('agent_inventory_snapshots')
      .insert(snapshotPayload)
      .select('id')
      .single()

    if (snapshotError || !snapshot) {
      throw new Error(
        snapshotError?.message ??
          'Falha ao registrar snapshot.',
      )
    }

    const now = new Date().toISOString()

    const { error: agentUpdateError } =
      await adminClient
        .from('agent_devices')
        .update({
          machine_guid:
            agent.machine_guid ?? machineGuid,
          hostname: snapshotPayload.hostname,
          agent_version: agentVersion,
          protocol_version: protocolVersion,
          last_seen_at: now,
          last_inventory_at: now,
        })
        .eq('id', agent.id)

    if (agentUpdateError) {
      throw new Error(agentUpdateError.message)
    }

    const { error: connectivityError } =
      await adminClient
        .from('system_alerts')
        .update({
          status: 'resolved',
          resolved_at: now,
          resolution_note:
            'Heartbeat recebido novamente.',
        })
        .eq('agent_id', agent.id)
        .eq('category', 'connectivity')
        .neq('status', 'resolved')

    if (connectivityError) {
      throw new Error(connectivityError.message)
    }

    const [
      assetResult,
      expectationResult,
    ] = await Promise.all([
      adminClient
        .from('assets')
        .select(
          'id, hostname, manufacturer, model, serial_number, os_name',
        )
        .eq('id', agent.asset_id)
        .single(),
      adminClient
        .from('agent_inventory_expectations')
        .select(
          'expected_hostname, expected_manufacturer, expected_model, expected_serial_number, expected_os_name, expected_cpu_name, expected_ram_bytes, min_free_system_disk_bytes, required_software',
        )
        .eq('asset_id', agent.asset_id)
        .maybeSingle(),
    ])

    if (
      assetResult.error ||
      !assetResult.data
    ) {
      throw new Error(
        'Ativo vinculado ao agente nao foi encontrado.',
      )
    }

    if (expectationResult.error) {
      throw new Error(
        expectationResult.error.message,
      )
    }

    const asset = assetResult.data
    const expectation =
      expectationResult.data ?? {}
    const divergences: DivergenceInput[] = []

    addTextDivergence(divergences, {
      key: 'identity.hostname',
      kind: 'identity',
      severity: 'warning',
      title: 'Hostname divergente',
      expected:
        expectation.expected_hostname ??
        asset.hostname,
      actual: snapshotPayload.hostname,
    })

    addTextDivergence(divergences, {
      key: 'identity.serial',
      kind: 'identity',
      severity: 'critical',
      title: 'Serial divergente',
      expected:
        expectation.expected_serial_number ??
        asset.serial_number,
      actual: snapshotPayload.serial_number,
    })

    addTextDivergence(divergences, {
      key: 'identity.manufacturer',
      kind: 'identity',
      severity: 'warning',
      title: 'Fabricante divergente',
      expected:
        expectation.expected_manufacturer ??
        asset.manufacturer,
      actual: snapshotPayload.manufacturer,
    })

    addTextDivergence(divergences, {
      key: 'identity.model',
      kind: 'identity',
      severity: 'warning',
      title: 'Modelo divergente',
      expected:
        expectation.expected_model ??
        asset.model,
      actual: snapshotPayload.model,
    })

    addTextDivergence(divergences, {
      key: 'software.os',
      kind: 'software',
      severity: 'warning',
      title:
        'Sistema operacional divergente',
      expected:
        expectation.expected_os_name ??
        asset.os_name,
      actual: snapshotPayload.os_name,
      fuzzy: true,
    })

    addTextDivergence(divergences, {
      key: 'hardware.cpu',
      kind: 'hardware',
      severity: 'warning',
      title: 'Processador divergente',
      expected: expectation.expected_cpu_name,
      actual: snapshotPayload.cpu_name,
      fuzzy: true,
    })

    const expectedRam = numberValue(
      expectation.expected_ram_bytes,
    )

    if (
      expectedRam != null &&
      snapshotPayload.ram_bytes != null
    ) {
      const actualRam = snapshotPayload.ram_bytes
      const tolerance = Math.max(
        expectedRam * 0.03,
        256 * 1024 * 1024,
      )

      if (
        Math.abs(actualRam - expectedRam) >
        tolerance
      ) {
        divergences.push({
          key: 'hardware.ram',
          kind: 'hardware',
          severity:
            actualRam < expectedRam
              ? 'critical'
              : 'warning',
          title: 'Memoria RAM divergente',
          expected: expectedRam,
          actual: actualRam,
        })
      }
    }

    const minimumFree = numberValue(
      expectation.min_free_system_disk_bytes,
    ) ?? 10737418240

    const systemDisk = disks.find(
      (disk) =>
        jsonObject(disk).system_drive === true,
    )

    if (systemDisk) {
      const diskObject = jsonObject(systemDisk)
      const free = numberValue(
        diskObject.free_bytes,
      )

      if (free != null && free < minimumFree) {
        divergences.push({
          key: 'health.system_disk_free',
          kind: 'health',
          severity:
            free < 5368709120
              ? 'critical'
              : 'warning',
          title:
            'Espaco livre critico no disco do sistema',
          expected: {
            minimum_free_bytes: minimumFree,
          },
          actual: {
            free_bytes: free,
            device_id:
              diskObject.device_id ?? null,
          },
        })
      }
    }

    const requiredSoftware = Array.isArray(
      expectation.required_software,
    )
      ? expectation.required_software
          .map((item: unknown) => normalize(item))
          .filter(Boolean)
      : []

    const installedNames = new Set(
      software
        .map((item) =>
          normalize(jsonObject(item).name),
        )
        .filter(Boolean),
    )

    for (const required of requiredSoftware) {
      const found = Array.from(
        installedNames,
      ).some(
        (installed) =>
          installed.includes(required) ||
          required.includes(installed),
      )

      if (!found) {
        divergences.push({
          key: `software.required.${required}`,
          kind: 'software',
          severity: 'warning',
          title: 'Software obrigatorio ausente',
          expected: required,
          actual: null,
        })
      }
    }

    await reconcileDivergences(
      adminClient,
      agent,
      snapshot.id,
      divergences,
    )

    return jsonResponse({
      ok: true,
      agent_id: agent.id,
      asset_id: agent.asset_id,
      snapshot_id: snapshot.id,
      divergences: divergences.length,
      received_at: now,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Falha ao receber inventario.'

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500,
    )
  }
})
