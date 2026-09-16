-- =====================================================================
-- WISDOM TI - M16A
-- ENDPOINT MANAGEMENT: ATIVACAO, DIAGNOSTICO E ACOES REMOTAS SEGURAS
-- Executar este MESMO SQL nos 2 projetos Supabase.
-- Idempotente. Sem secrets.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Permissoes
-- ---------------------------------------------------------------------

insert into public.permissions(
  code,
  module,
  action,
  description
)
values
(
  'agents.manage',
  'agents',
  'manage',
  'Criar, reinstalar e revogar agentes Windows.'
),
(
  'agents.remote',
  'agents',
  'remote',
  'Executar diagnosticos e manutencoes remotas pre-definidas.'
)
on conflict (code) do update
set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions(
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
join public.permissions p
  on p.code in (
    'agents.manage',
    'agents.remote'
  )
where r.code in (
  'admin',
  'manager',
  'technician'
)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Ativacao temporaria de uso unico
-- ---------------------------------------------------------------------

create table if not exists public.agent_activation_codes (
  id uuid primary key default gen_random_uuid(),

  asset_id uuid not null
    references public.assets(id)
    on delete cascade,

  code_hash text not null unique,
  code_prefix text not null,

  created_by uuid not null
    references auth.users(id),

  created_at timestamptz not null
    default now(),

  expires_at timestamptz not null,

  used_at timestamptz null,
  used_machine_guid text null,
  used_hostname text null,
  revoked_at timestamptz null,

  constraint agent_activation_codes_expiry_ck
    check (expires_at > created_at)
);

create index if not exists agent_activation_codes_asset_idx
  on public.agent_activation_codes(
    asset_id,
    created_at desc
  );

alter table public.agent_activation_codes
  enable row level security;

drop policy if exists m16_agent_activation_select
  on public.agent_activation_codes;

create policy m16_agent_activation_select
on public.agent_activation_codes
for select
to authenticated
using (
  public.has_permission('agents.manage')
  or public.has_permission('assets.update')
);

revoke insert, update, delete
on public.agent_activation_codes
from authenticated, anon;

grant select
on public.agent_activation_codes
to authenticated;

create or replace function public.m16_normalize_activation_code(
  p_code text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select upper(
    regexp_replace(
      btrim(coalesce(p_code, '')),
      '[^A-Za-z0-9]',
      '',
      'g'
    )
  );
$$;

create or replace function public.m16_hash_secret(
  p_value text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(
    sha256(
      convert_to(
        coalesce(p_value, ''),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

revoke all
on function public.m16_normalize_activation_code(text)
from public, anon, authenticated;

revoke all
on function public.m16_hash_secret(text)
from public, anon, authenticated;

create or replace function public.create_agent_activation(
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_raw text;
  v_code text;
  v_hash text;
  v_row public.agent_activation_codes%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not (
    public.has_permission('agents.manage')
    or public.has_permission('assets.update')
  ) then
    raise exception
      'Sem permissao para preparar instalacao do agente.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = p_asset_id;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  if v_asset.status in (
    'retired',
    'disposed'
  ) then
    raise exception
      'Ativo baixado ou descartado nao pode receber agente.';
  end if;

  update public.agent_activation_codes
  set revoked_at = now()
  where asset_id = p_asset_id
    and used_at is null
    and revoked_at is null
    and expires_at > now();

  loop
    v_raw :=
      upper(
        substr(
          replace(
            gen_random_uuid()::text,
            '-',
            ''
          ),
          1,
          12
        )
      );

    v_code :=
      'WT-' ||
      substr(v_raw, 1, 4) ||
      '-' ||
      substr(v_raw, 5, 4) ||
      '-' ||
      substr(v_raw, 9, 4);

    v_hash :=
      public.m16_hash_secret(
        public.m16_normalize_activation_code(
          v_code
        )
      );

    begin
      insert into public.agent_activation_codes(
        asset_id,
        code_hash,
        code_prefix,
        created_by,
        expires_at
      )
      values (
        p_asset_id,
        v_hash,
        left(v_code, 7),
        v_user,
        now() + interval '20 minutes'
      )
      returning *
        into v_row;

      exit;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  insert into public.audit_logs(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    v_user,
    'agent.activation.create',
    'agent_activation_codes',
    v_row.id,
    null,
    jsonb_build_object(
      'asset_id',
      p_asset_id,
      'expires_at',
      v_row.expires_at,
      'code_prefix',
      v_row.code_prefix
    ),
    jsonb_build_object(
      'asset_code',
      v_asset.asset_code
    )
  );

  return jsonb_build_object(
    'activation_id',
    v_row.id,
    'activation_code',
    v_code,
    'expires_at',
    v_row.expires_at,
    'asset_id',
    v_asset.id,
    'asset_code',
    v_asset.asset_code
  );
end;
$$;

revoke all
on function public.create_agent_activation(uuid)
from public, anon;

grant execute
on function public.create_agent_activation(uuid)
to authenticated;

create or replace function public.claim_agent_activation(
  p_code text,
  p_machine_guid text,
  p_hostname text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized text :=
    public.m16_normalize_activation_code(
      p_code
    );

  v_hash text;

  v_machine_guid text :=
    nullif(
      btrim(
        coalesce(
          p_machine_guid,
          ''
        )
      ),
      ''
    );

  v_hostname text :=
    nullif(
      btrim(
        coalesce(
          p_hostname,
          ''
        )
      ),
      ''
    );

  v_activation public.agent_activation_codes%rowtype;
  v_asset public.assets%rowtype;
  v_agent public.agent_devices%rowtype;

  v_token text;
  v_token_hash text;
  v_token_prefix text;
begin
  if length(v_normalized) <> 14
     or left(v_normalized, 2) <> 'WT' then
    raise exception
      'Codigo de ativacao invalido.';
  end if;

  if v_machine_guid is null
     or length(v_machine_guid) > 200 then
    raise exception
      'Identidade da maquina invalida.';
  end if;

  if v_hostname is null
     or length(v_hostname) > 255 then
    raise exception
      'Hostname invalido.';
  end if;

  v_hash :=
    public.m16_hash_secret(
      v_normalized
    );

  select *
    into v_activation
  from public.agent_activation_codes
  where code_hash = v_hash
    and used_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception
      'Codigo expirado, utilizado ou invalido.';
  end if;

  select *
    into v_asset
  from public.assets
  where id =
    v_activation.asset_id;

  if not found then
    raise exception
      'Ativo vinculado nao encontrado.';
  end if;

  if v_asset.status in (
    'retired',
    'disposed'
  ) then
    raise exception
      'Ativo nao aceita nova instalacao.';
  end if;

  select *
    into v_agent
  from public.agent_devices
  where asset_id =
      v_activation.asset_id
    and status = 'active'
  limit 1
  for update;

  if found
     and v_agent.machine_guid is not null
     and lower(
       btrim(
         v_agent.machine_guid
       )
     ) <> lower(v_machine_guid) then
    raise exception
      'Este patrimonio possui agente ativo em outra maquina. Revogue o agente anterior antes de mover a credencial.';
  end if;

  v_token :=
    'wti_' ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    ) ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    );

  v_token_hash :=
    public.m16_hash_secret(
      v_token
    );

  v_token_prefix :=
    left(v_token, 12);

  if v_agent.id is null then
    insert into public.agent_devices(
      asset_id,
      label,
      status,
      token_hash,
      token_prefix,
      machine_guid,
      hostname,
      agent_version,
      protocol_version,
      last_seen_at,
      created_by
    )
    values (
      v_asset.id,
      v_asset.asset_code,
      'active',
      v_token_hash,
      v_token_prefix,
      v_machine_guid,
      v_hostname,
      '2.0.0',
      '1',
      now(),
      v_activation.created_by
    )
    returning *
      into v_agent;
  else
    update public.agent_devices
    set
      token_hash = v_token_hash,
      token_prefix = v_token_prefix,
      machine_guid =
        coalesce(
          machine_guid,
          v_machine_guid
        ),
      hostname = v_hostname,
      agent_version = '2.0.0',
      protocol_version = '1',
      last_seen_at = now(),
      updated_at = now()
    where id = v_agent.id
    returning *
      into v_agent;
  end if;

  update public.agent_activation_codes
  set
    used_at = now(),
    used_machine_guid =
      v_machine_guid,
    used_hostname =
      v_hostname
  where id = v_activation.id;

  insert into public.agent_inventory_expectations(
    asset_id,
    expected_hostname,
    expected_manufacturer,
    expected_model,
    expected_serial_number,
    expected_os_name,
    updated_by
  )
  values (
    v_asset.id,
    v_asset.hostname,
    v_asset.manufacturer,
    v_asset.model,
    v_asset.serial_number,
    v_asset.os_name,
    v_activation.created_by
  )
  on conflict (asset_id)
  do nothing;

  insert into public.audit_logs(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    v_activation.created_by,
    'agent.activation.claim',
    'agent_devices',
    v_agent.id,
    null,
    jsonb_build_object(
      'asset_id',
      v_asset.id,
      'machine_guid',
      v_machine_guid,
      'hostname',
      v_hostname,
      'token_prefix',
      v_token_prefix
    ),
    jsonb_build_object(
      'activation_id',
      v_activation.id,
      'asset_code',
      v_asset.asset_code
    )
  );

  return jsonb_build_object(
    'agent_id',
    v_agent.id,
    'asset_id',
    v_asset.id,
    'asset_code',
    v_asset.asset_code,
    'agent_token',
    v_token
  );
end;
$$;

revoke all
on function public.claim_agent_activation(
  text,
  text,
  text
)
from public, authenticated;

grant execute
on function public.claim_agent_activation(
  text,
  text,
  text
)
to anon;

-- ---------------------------------------------------------------------
-- 3. Fila de comandos remotos
-- ---------------------------------------------------------------------

create table if not exists public.agent_commands (
  id uuid primary key default gen_random_uuid(),

  agent_id uuid not null
    references public.agent_devices(id)
    on delete restrict,

  asset_id uuid not null
    references public.assets(id)
    on delete restrict,

  maintenance_id uuid null
    references public.maintenance_orders(id)
    on delete set null,

  command_type text not null
    check (
      command_type in (
        'collect_inventory',
        'collect_diagnostics',
        'sfc_verify',
        'sfc_scannow',
        'dism_scanhealth',
        'dism_restorehealth',
        'flush_dns',
        'cleanup_temp',
        'optimize_system_drive'
      )
    ),

  status text not null default 'queued'
    check (
      status in (
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  parameters jsonb not null
    default '{}'::jsonb
    check (
      jsonb_typeof(parameters) =
        'object'
    ),

  reason text not null,

  requested_by uuid not null
    references auth.users(id),

  requested_at timestamptz not null
    default now(),

  started_at timestamptz null,
  completed_at timestamptz null,

  attempt_count integer not null
    default 0
    check (attempt_count >= 0),

  max_attempts integer not null
    default 3
    check (
      max_attempts between 1 and 5
    ),

  result jsonb null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index if not exists agent_commands_agent_queue_idx
  on public.agent_commands(
    agent_id,
    status,
    requested_at
  );

create index if not exists agent_commands_asset_time_idx
  on public.agent_commands(
    asset_id,
    requested_at desc
  );

alter table public.agent_commands
  enable row level security;

drop policy if exists m16_agent_commands_select
  on public.agent_commands;

create policy m16_agent_commands_select
on public.agent_commands
for select
to authenticated
using (
  public.has_permission('agents.remote')
  or public.has_permission('agents.manage')
  or public.has_permission('assets.update')
);

revoke insert, update, delete
on public.agent_commands
from authenticated, anon;

grant select
on public.agent_commands
to authenticated;

drop trigger if exists trg_m16_agent_commands_updated_at
  on public.agent_commands;

create trigger trg_m16_agent_commands_updated_at
before update on public.agent_commands
for each row
execute function public.set_updated_at();

create or replace function public.queue_agent_command(
  p_asset_id uuid,
  p_command_type text,
  p_reason text,
  p_maintenance_id uuid default null,
  p_parameters jsonb default '{}'::jsonb
)
returns public.agent_commands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_agent public.agent_devices%rowtype;

  v_reason text :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );

  v_result public.agent_commands%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not (
    public.has_permission('agents.remote')
    or public.has_permission('assets.update')
  ) then
    raise exception
      'Sem permissao para executar acao remota.';
  end if;

  if p_command_type not in (
    'collect_inventory',
    'collect_diagnostics',
    'sfc_verify',
    'sfc_scannow',
    'dism_scanhealth',
    'dism_restorehealth',
    'flush_dns',
    'cleanup_temp',
    'optimize_system_drive'
  ) then
    raise exception
      'Acao remota nao permitida.';
  end if;

  if v_reason is null
     or length(v_reason) < 5
     or length(v_reason) > 1000 then
    raise exception
      'Informe o motivo da acao remota.';
  end if;

  if jsonb_typeof(
    coalesce(
      p_parameters,
      '{}'::jsonb
    )
  ) <> 'object' then
    raise exception
      'Parametros invalidos.';
  end if;

  if p_maintenance_id is not null
     and not exists (
       select 1
       from public.maintenance_orders
       where id =
         p_maintenance_id
         and asset_id =
           p_asset_id
     ) then
    raise exception
      'A manutencao informada nao pertence a este patrimonio.';
  end if;

  select *
    into v_agent
  from public.agent_devices
  where asset_id =
      p_asset_id
    and status = 'active'
  limit 1;

  if not found then
    raise exception
      'Este patrimonio nao possui agente ativo.';
  end if;

  insert into public.agent_commands(
    agent_id,
    asset_id,
    maintenance_id,
    command_type,
    parameters,
    reason,
    requested_by
  )
  values (
    v_agent.id,
    p_asset_id,
    p_maintenance_id,
    p_command_type,
    coalesce(
      p_parameters,
      '{}'::jsonb
    ),
    v_reason,
    v_user
  )
  returning *
    into v_result;

  insert into public.audit_logs(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    v_user,
    'agent.command.queue',
    'agent_commands',
    v_result.id,
    null,
    to_jsonb(v_result),
    jsonb_build_object(
      'asset_id',
      p_asset_id,
      'agent_id',
      v_agent.id
    )
  );

  return v_result;
end;
$$;

revoke all
on function public.queue_agent_command(
  uuid,
  text,
  text,
  uuid,
  jsonb
)
from public, anon;

grant execute
on function public.queue_agent_command(
  uuid,
  text,
  text,
  uuid,
  jsonb
)
to authenticated;

create or replace function public.agent_poll_command(
  p_token text,
  p_agent_version text,
  p_machine_guid text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text :=
    public.m16_hash_secret(
      btrim(
        coalesce(
          p_token,
          ''
        )
      )
    );

  v_machine_guid text :=
    nullif(
      btrim(
        coalesce(
          p_machine_guid,
          ''
        )
      ),
      ''
    );

  v_agent public.agent_devices%rowtype;
  v_command public.agent_commands%rowtype;
begin
  if v_machine_guid is null then
    raise exception
      'Identidade da maquina ausente.';
  end if;

  select *
    into v_agent
  from public.agent_devices
  where token_hash =
      v_token_hash
    and status = 'active'
  limit 1
  for update;

  if not found then
    raise exception
      'Credencial do agente invalida ou revogada.';
  end if;

  if v_agent.machine_guid is not null
     and lower(
       btrim(
         v_agent.machine_guid
       )
     ) <> lower(v_machine_guid) then
    raise exception
      'Identidade da maquina nao corresponde ao agente.';
  end if;

  update public.agent_devices
  set
    machine_guid =
      coalesce(
        machine_guid,
        v_machine_guid
      ),
    agent_version =
      left(
        nullif(
          btrim(
            coalesce(
              p_agent_version,
              ''
            )
          ),
          ''
        ),
        50
      ),
    protocol_version = '1',
    last_seen_at = now(),
    updated_at = now()
  where id = v_agent.id;

  select *
    into v_command
  from public.agent_commands
  where agent_id = v_agent.id
    and (
      status = 'queued'
      or (
        status = 'running'
        and started_at <
          now() - interval '100 minutes'
        and attempt_count <
          max_attempts
      )
    )
  order by
    requested_at,
    id
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  update public.agent_commands
  set
    status = 'running',
    started_at = now(),
    attempt_count =
      attempt_count + 1
  where id = v_command.id
  returning *
    into v_command;

  return jsonb_build_object(
    'id',
    v_command.id,
    'command_type',
    v_command.command_type,
    'parameters',
    v_command.parameters,
    'reason',
    v_command.reason,
    'attempt_count',
    v_command.attempt_count
  );
end;
$$;

revoke all
on function public.agent_poll_command(
  text,
  text,
  text
)
from public, authenticated;

grant execute
on function public.agent_poll_command(
  text,
  text,
  text
)
to anon;

create or replace function public.agent_complete_command(
  p_token text,
  p_command_id uuid,
  p_success boolean,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text :=
    public.m16_hash_secret(
      btrim(
        coalesce(
          p_token,
          ''
        )
      )
    );

  v_agent public.agent_devices%rowtype;
  v_command public.agent_commands%rowtype;
  v_status text;
begin
  select *
    into v_agent
  from public.agent_devices
  where token_hash =
      v_token_hash
    and status = 'active'
  limit 1;

  if not found then
    raise exception
      'Credencial do agente invalida ou revogada.';
  end if;

  select *
    into v_command
  from public.agent_commands
  where id = p_command_id
    and agent_id =
      v_agent.id
  for update;

  if not found then
    raise exception
      'Comando remoto nao encontrado.';
  end if;

  if v_command.status in (
    'completed',
    'failed',
    'cancelled'
  ) then
    return jsonb_build_object(
      'id',
      v_command.id,
      'status',
      v_command.status
    );
  end if;

  v_status :=
    case
      when coalesce(
        p_success,
        false
      )
        then 'completed'
      else 'failed'
    end;

  update public.agent_commands
  set
    status = v_status,
    completed_at = now(),
    result =
      coalesce(
        p_result,
        '{}'::jsonb
      )
  where id = v_command.id
  returning *
    into v_command;

  insert into public.audit_logs(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    null,
    'agent.command.complete',
    'agent_commands',
    v_command.id,
    null,
    jsonb_build_object(
      'status',
      v_status,
      'result',
      v_command.result
    ),
    jsonb_build_object(
      'asset_id',
      v_command.asset_id,
      'agent_id',
      v_agent.id,
      'requested_by',
      v_command.requested_by
    )
  );

  return jsonb_build_object(
    'id',
    v_command.id,
    'status',
    v_status
  );
end;
$$;

revoke all
on function public.agent_complete_command(
  text,
  uuid,
  boolean,
  jsonb
)
from public, authenticated;

grant execute
on function public.agent_complete_command(
  text,
  uuid,
  boolean,
  jsonb
)
to anon;

-- ---------------------------------------------------------------------
-- 4. Complementacao automatica do patrimonio
--    O agente preenche somente lacunas. Nunca substitui dado humano/OCR.
-- ---------------------------------------------------------------------

create or replace function public.m16_merge_agent_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_asset jsonb;
  v_new_asset jsonb;
  v_previous_profile jsonb;
  v_new_profile jsonb;

  v_board_manufacturer text;
  v_board_model text;

  v_memory_type text;
  v_memory_speed integer;

  v_storage_capacity numeric;
  v_storage_type text;
  v_storage_interface text;

  v_wifi_manufacturer text;
  v_wifi_model text;
  v_wifi_mac text;

  v_processor_manufacturer text;
  v_profile_changed integer := 0;
begin
  select to_jsonb(a)
    into v_old_asset
  from public.assets a
  where a.id =
    new.asset_id;

  update public.assets
  set
    hostname =
      coalesce(
        hostname,
        nullif(
          btrim(new.hostname),
          ''
        )
      ),
    manufacturer =
      coalesce(
        manufacturer,
        nullif(
          btrim(new.manufacturer),
          ''
        )
      ),
    model =
      coalesce(
        model,
        nullif(
          btrim(new.model),
          ''
        )
      ),
    serial_number =
      coalesce(
        serial_number,
        nullif(
          btrim(new.serial_number),
          ''
        )
      ),
    os_name =
      coalesce(
        os_name,
        nullif(
          btrim(new.os_name),
          ''
        )
      ),
    updated_at = now()
  where id = new.asset_id
    and (
      (
        hostname is null
        and nullif(
          btrim(new.hostname),
          ''
        ) is not null
      )
      or (
        manufacturer is null
        and nullif(
          btrim(new.manufacturer),
          ''
        ) is not null
      )
      or (
        model is null
        and nullif(
          btrim(new.model),
          ''
        ) is not null
      )
      or (
        serial_number is null
        and nullif(
          btrim(new.serial_number),
          ''
        ) is not null
      )
      or (
        os_name is null
        and nullif(
          btrim(new.os_name),
          ''
        ) is not null
      )
    );

  select to_jsonb(a)
    into v_new_asset
  from public.assets a
  where a.id =
    new.asset_id;

  if v_old_asset is distinct from
     v_new_asset then
    insert into public.audit_logs(
      actor_user_id,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      metadata
    )
    values (
      null,
      'asset.agent.autofill',
      'assets',
      new.asset_id,
      v_old_asset,
      v_new_asset,
      jsonb_build_object(
        'snapshot_id',
        new.id,
        'source',
        'agent'
      )
    );
  end if;

  v_board_manufacturer :=
    nullif(
      btrim(
        new.health
          -> 'motherboard'
          ->> 'manufacturer'
      ),
      ''
    );

  v_board_model :=
    nullif(
      btrim(
        new.health
          -> 'motherboard'
          ->> 'model'
      ),
      ''
    );

  select
    nullif(
      btrim(
        item ->> 'memory_type'
      ),
      ''
    ),
    case
      when item ? 'configured_speed_mhz'
        then (
          item ->>
          'configured_speed_mhz'
        )::integer
      else null
    end
  into
    v_memory_type,
    v_memory_speed
  from jsonb_array_elements(
    coalesce(
      new.health ->
        'memory_modules',
      '[]'::jsonb
    )
  ) item
  limit 1;

  select
    case
      when item ? 'size_bytes'
        then round(
          (
            item ->>
            'size_bytes'
          )::numeric /
          1073741824.0,
          2
        )
      else null
    end,
    nullif(
      btrim(
        item ->> 'media_type'
      ),
      ''
    ),
    nullif(
      btrim(
        item ->> 'bus_type'
      ),
      ''
    )
  into
    v_storage_capacity,
    v_storage_type,
    v_storage_interface
  from jsonb_array_elements(
    coalesce(
      new.health ->
        'physical_disks',
      '[]'::jsonb
    )
  ) item
  order by
    case
      when item ? 'size_bytes'
        then (
          item ->>
          'size_bytes'
        )::numeric
      else 0
    end desc
  limit 1;

  select
    nullif(
      btrim(
        item ->> 'manufacturer'
      ),
      ''
    ),
    coalesce(
      nullif(
        btrim(
          item ->> 'product_name'
        ),
        ''
      ),
      nullif(
        btrim(
          item ->> 'name'
        ),
        ''
      )
    ),
    upper(
      nullif(
        btrim(
          item ->> 'mac_address'
        ),
        ''
      )
    )
  into
    v_wifi_manufacturer,
    v_wifi_model,
    v_wifi_mac
  from jsonb_array_elements(
    coalesce(
      new.health ->
        'network_adapters',
      '[]'::jsonb
    )
  ) item
  where coalesce(
    (
      item ->>
      'is_wifi'
    )::boolean,
    false
  )
  limit 1;

  v_processor_manufacturer :=
    case
      when upper(
        coalesce(
          new.cpu_name,
          ''
        )
      ) like '%AMD%'
        then 'AMD'
      when upper(
        coalesce(
          new.cpu_name,
          ''
        )
      ) like '%INTEL%'
        then 'Intel'
      else null
    end;

  select to_jsonb(p)
    into v_previous_profile
  from public.asset_technical_profiles p
  where p.asset_id =
    new.asset_id;

  if v_previous_profile is null then
    insert into public.asset_technical_profiles(
      asset_id,
      processor_manufacturer,
      processor_model,
      memory_total_gb,
      memory_type,
      memory_speed_mhz,
      storage_capacity_gb,
      storage_type,
      storage_interface,
      motherboard_manufacturer,
      motherboard_model,
      wifi_manufacturer,
      wifi_model,
      mac_address,
      source,
      updated_by
    )
    values (
      new.asset_id,
      v_processor_manufacturer,
      nullif(
        btrim(new.cpu_name),
        ''
      ),
      case
        when new.ram_bytes is null
          then null
        else round(
          new.ram_bytes /
          1073741824.0,
          2
        )
      end,
      v_memory_type,
      v_memory_speed,
      v_storage_capacity,
      v_storage_type,
      v_storage_interface,
      v_board_manufacturer,
      v_board_model,
      v_wifi_manufacturer,
      v_wifi_model,
      v_wifi_mac,
      'agent',
      null
    );

    v_profile_changed := 1;
  else
    update public.asset_technical_profiles
    set
      processor_manufacturer =
        coalesce(
          processor_manufacturer,
          v_processor_manufacturer
        ),
      processor_model =
        coalesce(
          processor_model,
          nullif(
            btrim(new.cpu_name),
            ''
          )
        ),
      memory_total_gb =
        coalesce(
          memory_total_gb,
          case
            when new.ram_bytes
                 is null
              then null
            else round(
              new.ram_bytes /
              1073741824.0,
              2
            )
          end
        ),
      memory_type =
        coalesce(
          memory_type,
          v_memory_type
        ),
      memory_speed_mhz =
        coalesce(
          memory_speed_mhz,
          v_memory_speed
        ),
      storage_capacity_gb =
        coalesce(
          storage_capacity_gb,
          v_storage_capacity
        ),
      storage_type =
        coalesce(
          storage_type,
          v_storage_type
        ),
      storage_interface =
        coalesce(
          storage_interface,
          v_storage_interface
        ),
      motherboard_manufacturer =
        coalesce(
          motherboard_manufacturer,
          v_board_manufacturer
        ),
      motherboard_model =
        coalesce(
          motherboard_model,
          v_board_model
        ),
      wifi_manufacturer =
        coalesce(
          wifi_manufacturer,
          v_wifi_manufacturer
        ),
      wifi_model =
        coalesce(
          wifi_model,
          v_wifi_model
        ),
      mac_address =
        coalesce(
          mac_address,
          v_wifi_mac
        ),
      updated_at = now()
    where asset_id =
      new.asset_id
      and (
        (
          processor_manufacturer
            is null
          and v_processor_manufacturer
            is not null
        )
        or (
          processor_model is null
          and nullif(
            btrim(new.cpu_name),
            ''
          ) is not null
        )
        or (
          memory_total_gb is null
          and new.ram_bytes
            is not null
        )
        or (
          memory_type is null
          and v_memory_type
            is not null
        )
        or (
          memory_speed_mhz is null
          and v_memory_speed
            is not null
        )
        or (
          storage_capacity_gb
            is null
          and v_storage_capacity
            is not null
        )
        or (
          storage_type is null
          and v_storage_type
            is not null
        )
        or (
          storage_interface is null
          and v_storage_interface
            is not null
        )
        or (
          motherboard_manufacturer
            is null
          and v_board_manufacturer
            is not null
        )
        or (
          motherboard_model is null
          and v_board_model
            is not null
        )
        or (
          wifi_manufacturer is null
          and v_wifi_manufacturer
            is not null
        )
        or (
          wifi_model is null
          and v_wifi_model
            is not null
        )
        or (
          mac_address is null
          and v_wifi_mac
            is not null
        )
      );

    get diagnostics v_profile_changed =
      row_count;
  end if;

  if v_profile_changed > 0 then
    select to_jsonb(p)
      into v_new_profile
    from public.asset_technical_profiles p
    where p.asset_id =
      new.asset_id;

    insert into public.asset_technical_profile_history(
      asset_id,
      previous_data,
      new_data,
      source,
      changed_by
    )
    values (
      new.asset_id,
      v_previous_profile,
      v_new_profile,
      'agent',
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_m16_merge_agent_snapshot
  on public.agent_inventory_snapshots;

create trigger trg_m16_merge_agent_snapshot
after insert
on public.agent_inventory_snapshots
for each row
execute function public.m16_merge_agent_snapshot();

-- ---------------------------------------------------------------------
-- 5. Alertas de saude derivados do Windows
-- ---------------------------------------------------------------------

create or replace function public.m16_sync_health_alert(
  p_agent_id uuid,
  p_asset_id uuid,
  p_key text,
  p_active boolean,
  p_severity text,
  p_title text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_id uuid;
begin
  select id
    into v_alert_id
  from public.system_alerts
  where source = 'agent'
    and agent_id = p_agent_id
    and category = 'health'
    and status <> 'resolved'
    and metadata ->>
      'm16_key' = p_key
  order by detected_at desc
  limit 1;

  if p_active then
    if v_alert_id is null then
      insert into public.system_alerts(
        source,
        agent_id,
        asset_id,
        category,
        severity,
        status,
        title,
        description,
        detected_at,
        last_seen_at,
        metadata
      )
      values (
        'agent',
        p_agent_id,
        p_asset_id,
        'health',
        p_severity,
        'open',
        p_title,
        p_description,
        now(),
        now(),
        coalesce(
          p_metadata,
          '{}'::jsonb
        ) ||
        jsonb_build_object(
          'm16_key',
          p_key,
          'origin',
          'm16_health'
        )
      );
    else
      update public.system_alerts
      set
        severity = p_severity,
        title = p_title,
        description = p_description,
        last_seen_at = now(),
        metadata =
          coalesce(
            p_metadata,
            '{}'::jsonb
          ) ||
          jsonb_build_object(
            'm16_key',
            p_key,
            'origin',
            'm16_health'
          ),
        updated_at = now()
      where id = v_alert_id;
    end if;
  elsif v_alert_id is not null then
    update public.system_alerts
    set
      status = 'resolved',
      resolved_at = now(),
      last_seen_at = now(),
      resolution_note =
        'Condicao normalizada na coleta mais recente do agente.',
      metadata =
        metadata ||
        jsonb_build_object(
          'auto_resolved',
          true
        ),
      updated_at = now()
    where id = v_alert_id;
  end if;
end;
$$;

revoke all
on function public.m16_sync_health_alert(
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

create or replace function public.m16_process_health_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diag jsonb :=
    coalesce(
      new.health ->
        'diagnostics',
      '{}'::jsonb
    );

  v_unexpected integer :=
    coalesce(
      nullif(
        v_diag ->>
        'unexpected_shutdowns_7d',
        ''
      )::integer,
      0
    );

  v_bugchecks integer :=
    coalesce(
      nullif(
        v_diag ->>
        'bugchecks_7d',
        ''
      )::integer,
      0
    );

  v_whea integer :=
    coalesce(
      nullif(
        v_diag ->>
        'whea_errors_7d',
        ''
      )::integer,
      0
    );

  v_memory integer :=
    coalesce(
      nullif(
        v_diag ->>
        'memory_diagnostic_errors_30d',
        ''
      )::integer,
      0
    );

  v_free numeric :=
    nullif(
      v_diag ->>
      'system_drive_free_percent',
      ''
    )::numeric;

  v_unhealthy_disks jsonb;
begin
  perform public.m16_sync_health_alert(
    new.agent_id,
    new.asset_id,
    'unexpected_shutdowns',
    v_unexpected >= 3,
    case
      when v_unexpected >= 8
        then 'critical'
      else 'warning'
    end,
    'Reinicializacoes inesperadas recorrentes',
    format(
      '%s desligamentos ou reinicializacoes inesperadas foram detectados nos ultimos 7 dias.',
      v_unexpected
    ),
    jsonb_build_object(
      'count_7d',
      v_unexpected,
      'snapshot_id',
      new.id
    )
  );

  perform public.m16_sync_health_alert(
    new.agent_id,
    new.asset_id,
    'bugchecks',
    v_bugchecks >= 1,
    case
      when v_bugchecks >= 3
        then 'critical'
      else 'warning'
    end,
    'Tela azul / BugCheck detectado',
    format(
      '%s evento(s) de BugCheck foram detectados nos ultimos 7 dias.',
      v_bugchecks
    ),
    jsonb_build_object(
      'count_7d',
      v_bugchecks,
      'snapshot_id',
      new.id
    )
  );

  perform public.m16_sync_health_alert(
    new.agent_id,
    new.asset_id,
    'whea',
    v_whea >= 1,
    'critical',
    'Erro de hardware WHEA detectado',
    format(
      '%s erro(s) critico(s) de hardware WHEA foram detectados nos ultimos 7 dias.',
      v_whea
    ),
    jsonb_build_object(
      'count_7d',
      v_whea,
      'snapshot_id',
      new.id
    )
  );

  perform public.m16_sync_health_alert(
    new.agent_id,
    new.asset_id,
    'memory_diagnostics',
    v_memory >= 1,
    'critical',
    'Falha de memoria registrada pelo Windows',
    format(
      '%s resultado(s) de diagnostico de memoria com erro foram encontrados nos ultimos 30 dias.',
      v_memory
    ),
    jsonb_build_object(
      'count_30d',
      v_memory,
      'snapshot_id',
      new.id
    )
  );

  perform public.m16_sync_health_alert(
    new.agent_id,
    new.asset_id,
    'system_drive_space',
    v_free is not null
      and v_free < 10,
    case
      when v_free is not null
           and v_free < 5
        then 'critical'
      else 'warning'
    end,
    'Pouco espaco livre no disco do sistema',
    case
      when v_free is null
        then 'Espaco livre nao informado.'
      else format(
        'O disco do sistema possui apenas %s%% de espaco livre.',
        v_free
      )
    end,
    jsonb_build_object(
      'free_percent',
      v_free,
      'snapshot_id',
      new.id
    )
  );

  select coalesce(
    jsonb_agg(item),
    '[]'::jsonb
  )
  into v_unhealthy_disks
  from jsonb_array_elements(
    coalesce(
      new.health ->
        'physical_disks',
      '[]'::jsonb
    )
  ) item
  where lower(
    coalesce(
      item ->>
        'health_status',
      ''
    )
  ) not in (
    '',
    'healthy',
    'unknown',
    'ok'
  );

  perform public.m16_sync_health_alert(
    new.agent_id,
    new.asset_id,
    'physical_disk_health',
    jsonb_array_length(
      v_unhealthy_disks
    ) > 0,
    'critical',
    'Disco fisico reporta problema de saude',
    'O Windows reportou estado de saude anormal em pelo menos um disco fisico.',
    jsonb_build_object(
      'disks',
      v_unhealthy_disks,
      'snapshot_id',
      new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_m16_process_health_snapshot
  on public.agent_inventory_snapshots;

create trigger trg_m16_process_health_snapshot
after insert
on public.agent_inventory_snapshots
for each row
execute function public.m16_process_health_snapshot();

commit;

select
  to_regclass(
    'public.agent_activation_codes'
  ) as agent_activation_codes,

  to_regclass(
    'public.agent_commands'
  ) as agent_commands,

  (
    select count(*)
    from public.permissions
    where code in (
      'agents.manage',
      'agents.remote'
    )
  ) as agent_permissions,

  (
    select count(*)
    from pg_proc p
    join pg_namespace n
      on n.oid =
        p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_agent_activation',
        'claim_agent_activation',
        'queue_agent_command',
        'agent_poll_command',
        'agent_complete_command'
      )
  ) as agent_rpc_count,

  (
    select count(*)
    from public.agent_commands
  ) as command_count;