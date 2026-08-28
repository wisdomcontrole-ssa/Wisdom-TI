-- WISDOM TI - M09 AGENTE WINDOWS + INVENTARIO + ALERTAS
-- Projeto oficial: dqfbzsneaamihfphjfcj
-- Executar somente no Supabase SQL Editor.
-- Idempotente, sem secrets e com historico nao destrutivo.

begin;

create table if not exists public.agent_devices (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  label text,
  status text not null default 'active' check (status in ('active','revoked')),
  token_hash text not null unique,
  token_prefix text not null,
  machine_guid text,
  hostname text,
  agent_version text,
  protocol_version text,
  last_seen_at timestamptz,
  last_inventory_at timestamptz,
  created_by uuid references auth.users(id),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_devices_one_active_per_asset_uidx
  on public.agent_devices(asset_id) where status = 'active';
create index if not exists agent_devices_last_seen_idx
  on public.agent_devices(status, last_seen_at);

create table if not exists public.agent_inventory_expectations (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  expected_hostname text,
  expected_manufacturer text,
  expected_model text,
  expected_serial_number text,
  expected_os_name text,
  expected_cpu_name text,
  expected_ram_bytes bigint check (expected_ram_bytes is null or expected_ram_bytes >= 0),
  min_free_system_disk_bytes bigint not null default 10737418240 check (min_free_system_disk_bytes >= 0),
  required_software jsonb not null default '[]'::jsonb check (jsonb_typeof(required_software) = 'array'),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_devices(id),
  asset_id uuid not null references public.assets(id),
  protocol_version text not null,
  agent_version text not null,
  collected_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload_hash text not null,
  machine_guid text,
  hostname text,
  manufacturer text,
  model text,
  serial_number text,
  os_name text,
  os_version text,
  os_build text,
  os_architecture text,
  last_boot_at timestamptz,
  cpu_name text,
  cpu_cores integer,
  logical_processors integer,
  ram_bytes bigint,
  disks jsonb not null default '[]'::jsonb check (jsonb_typeof(disks) = 'array'),
  software jsonb not null default '[]'::jsonb check (jsonb_typeof(software) = 'array'),
  health jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_inventory_snapshots_agent_time_idx
  on public.agent_inventory_snapshots(agent_id, received_at desc);
create index if not exists agent_inventory_snapshots_asset_time_idx
  on public.agent_inventory_snapshots(asset_id, received_at desc);

create table if not exists public.agent_divergences (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_devices(id),
  asset_id uuid not null references public.assets(id),
  snapshot_id uuid not null references public.agent_inventory_snapshots(id),
  kind text not null check (kind in ('identity','hardware','software','health')),
  divergence_key text not null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  expected jsonb,
  actual jsonb,
  status text not null default 'open' check (status in ('open','resolved')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_divergences_one_open_key_uidx
  on public.agent_divergences(agent_id, divergence_key) where status = 'open';
create index if not exists agent_divergences_asset_status_idx
  on public.agent_divergences(asset_id, status, last_detected_at desc);

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'agent' check (source in ('agent','system')),
  agent_id uuid references public.agent_devices(id),
  asset_id uuid references public.assets(id),
  divergence_id uuid references public.agent_divergences(id),
  category text not null check (category in ('connectivity','identity','hardware','software','health')),
  severity text not null check (severity in ('info','warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  title text not null,
  description text not null,
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  acknowledge_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists system_alerts_divergence_uidx
  on public.system_alerts(divergence_id) where divergence_id is not null;
create unique index if not exists system_alerts_connectivity_open_uidx
  on public.system_alerts(agent_id) where category = 'connectivity' and status <> 'resolved';
create index if not exists system_alerts_status_time_idx
  on public.system_alerts(status, severity, detected_at desc);
create index if not exists system_alerts_asset_time_idx
  on public.system_alerts(asset_id, detected_at desc);

-- updated_at

drop trigger if exists agent_devices_set_updated_at on public.agent_devices;
create trigger agent_devices_set_updated_at before update on public.agent_devices
for each row execute function public.set_updated_at();

drop trigger if exists agent_inventory_expectations_set_updated_at on public.agent_inventory_expectations;
create trigger agent_inventory_expectations_set_updated_at before update on public.agent_inventory_expectations
for each row execute function public.set_updated_at();

drop trigger if exists agent_divergences_set_updated_at on public.agent_divergences;
create trigger agent_divergences_set_updated_at before update on public.agent_divergences
for each row execute function public.set_updated_at();

drop trigger if exists system_alerts_set_updated_at on public.system_alerts;
create trigger system_alerts_set_updated_at before update on public.system_alerts
for each row execute function public.set_updated_at();

-- RLS: leitura conforme permissoes; escrita direta bloqueada.
alter table public.agent_devices enable row level security;
alter table public.agent_inventory_expectations enable row level security;
alter table public.agent_inventory_snapshots enable row level security;
alter table public.agent_divergences enable row level security;
alter table public.system_alerts enable row level security;

drop policy if exists agent_devices_select on public.agent_devices;
create policy agent_devices_select on public.agent_devices for select to authenticated
using (public.has_permission('assets.view') or public.has_permission('alerts.view'));

drop policy if exists agent_inventory_expectations_select on public.agent_inventory_expectations;
create policy agent_inventory_expectations_select on public.agent_inventory_expectations for select to authenticated
using (public.has_permission('assets.view'));

drop policy if exists agent_inventory_snapshots_select on public.agent_inventory_snapshots;
create policy agent_inventory_snapshots_select on public.agent_inventory_snapshots for select to authenticated
using (public.has_permission('assets.view') or public.has_permission('alerts.view'));

drop policy if exists agent_divergences_select on public.agent_divergences;
create policy agent_divergences_select on public.agent_divergences for select to authenticated
using (public.has_permission('assets.view') or public.has_permission('alerts.view'));

drop policy if exists system_alerts_select on public.system_alerts;
create policy system_alerts_select on public.system_alerts for select to authenticated
using (public.has_permission('alerts.view'));

revoke all on table public.agent_devices from anon;
revoke all on table public.agent_inventory_expectations from anon;
revoke all on table public.agent_inventory_snapshots from anon;
revoke all on table public.agent_divergences from anon;
revoke all on table public.system_alerts from anon;

revoke insert, update, delete on table public.agent_devices from authenticated;
revoke insert, update, delete on table public.agent_inventory_expectations from authenticated;
revoke insert, update, delete on table public.agent_inventory_snapshots from authenticated;
revoke insert, update, delete on table public.agent_divergences from authenticated;
revoke insert, update, delete on table public.system_alerts from authenticated;

grant select on table public.agent_devices to authenticated;
grant select on table public.agent_inventory_expectations to authenticated;
grant select on table public.agent_inventory_snapshots to authenticated;
grant select on table public.agent_divergences to authenticated;
grant select on table public.system_alerts to authenticated;

create or replace function public.set_asset_inventory_expectation(
  p_asset_id uuid,
  p_expected_hostname text default null,
  p_expected_manufacturer text default null,
  p_expected_model text default null,
  p_expected_serial_number text default null,
  p_expected_os_name text default null,
  p_expected_cpu_name text default null,
  p_expected_ram_bytes bigint default null,
  p_min_free_system_disk_bytes bigint default 10737418240,
  p_required_software jsonb default '[]'::jsonb
)
returns public.agent_inventory_expectations
language plpgsql security definer set search_path = ''
as $$
declare
  old_row public.agent_inventory_expectations;
  result_row public.agent_inventory_expectations;
begin
  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para alterar baseline de inventario.';
  end if;
  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Ativo nao encontrado.';
  end if;
  if p_expected_ram_bytes is not null and p_expected_ram_bytes < 0 then
    raise exception 'RAM esperada invalida.';
  end if;
  if p_min_free_system_disk_bytes is null or p_min_free_system_disk_bytes < 0 then
    raise exception 'Limite de disco invalido.';
  end if;
  if jsonb_typeof(coalesce(p_required_software, '[]'::jsonb)) <> 'array' then
    raise exception 'Software obrigatorio deve ser uma lista JSON.';
  end if;

  select * into old_row from public.agent_inventory_expectations where asset_id = p_asset_id;

  insert into public.agent_inventory_expectations (
    asset_id, expected_hostname, expected_manufacturer, expected_model,
    expected_serial_number, expected_os_name, expected_cpu_name,
    expected_ram_bytes, min_free_system_disk_bytes, required_software, updated_by
  ) values (
    p_asset_id, nullif(trim(p_expected_hostname), ''), nullif(trim(p_expected_manufacturer), ''),
    nullif(trim(p_expected_model), ''), nullif(trim(p_expected_serial_number), ''),
    nullif(trim(p_expected_os_name), ''), nullif(trim(p_expected_cpu_name), ''),
    p_expected_ram_bytes, p_min_free_system_disk_bytes,
    coalesce(p_required_software, '[]'::jsonb), auth.uid()
  )
  on conflict (asset_id) do update set
    expected_hostname = excluded.expected_hostname,
    expected_manufacturer = excluded.expected_manufacturer,
    expected_model = excluded.expected_model,
    expected_serial_number = excluded.expected_serial_number,
    expected_os_name = excluded.expected_os_name,
    expected_cpu_name = excluded.expected_cpu_name,
    expected_ram_bytes = excluded.expected_ram_bytes,
    min_free_system_disk_bytes = excluded.min_free_system_disk_bytes,
    required_software = excluded.required_software,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into result_row;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    auth.uid(), 'agent.expectation.update', 'agent_inventory_expectations', p_asset_id,
    case when old_row.asset_id is null then null else to_jsonb(old_row) end,
    to_jsonb(result_row), jsonb_build_object('module','agent_inventory')
  );

  return result_row;
end;
$$;

revoke all on function public.set_asset_inventory_expectation(uuid,text,text,text,text,text,text,bigint,bigint,jsonb)
from public, anon, authenticated;
grant execute on function public.set_asset_inventory_expectation(uuid,text,text,text,text,text,text,bigint,bigint,jsonb)
to authenticated;

create or replace function public.update_system_alert_status(
  p_alert_id uuid,
  p_status text,
  p_note text default null
)
returns public.system_alerts
language plpgsql security definer set search_path = ''
as $$
declare
  old_row public.system_alerts;
  result_row public.system_alerts;
  clean_note text := nullif(trim(p_note), '');
begin
  if not public.has_permission('alerts.manage') then
    raise exception 'Sem permissao para tratar alertas.';
  end if;
  if p_status not in ('open','acknowledged','resolved') then
    raise exception 'Status de alerta invalido.';
  end if;
  select * into old_row from public.system_alerts where id = p_alert_id for update;
  if not found then raise exception 'Alerta nao encontrado.'; end if;
  if p_status = 'resolved' and clean_note is null then
    raise exception 'Informe a resolucao do alerta.';
  end if;

  update public.system_alerts set
    status = p_status,
    acknowledged_by = case when p_status='acknowledged' then auth.uid() when p_status='open' then null else acknowledged_by end,
    acknowledged_at = case when p_status='acknowledged' then now() when p_status='open' then null else acknowledged_at end,
    acknowledge_note = case when p_status='acknowledged' then clean_note when p_status='open' then null else acknowledge_note end,
    resolved_by = case when p_status='resolved' then auth.uid() when p_status='open' then null else resolved_by end,
    resolved_at = case when p_status='resolved' then now() when p_status='open' then null else resolved_at end,
    resolution_note = case when p_status='resolved' then clean_note when p_status='open' then null else resolution_note end,
    updated_at = now()
  where id = p_alert_id returning * into result_row;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    auth.uid(), 'alert.status.update', 'system_alerts', p_alert_id,
    to_jsonb(old_row), to_jsonb(result_row), jsonb_build_object('module','alerts','note',clean_note)
  );

  return result_row;
end;
$$;

revoke all on function public.update_system_alert_status(uuid,text,text)
from public, anon, authenticated;
grant execute on function public.update_system_alert_status(uuid,text,text) to authenticated;

create or replace function public.refresh_agent_connectivity_alerts()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare inserted_count integer := 0;
begin
  insert into public.system_alerts (
    source, agent_id, asset_id, category, severity, status,
    title, description, detected_at, last_seen_at, metadata
  )
  select
    'system', ad.id, ad.asset_id, 'connectivity', 'warning', 'open',
    'Agente sem comunicacao',
    case when ad.last_seen_at is null
      then 'O agente ainda nao enviou heartbeat apos o periodo de tolerancia.'
      else 'Ultima comunicacao recebida ha mais de 30 minutos.' end,
    now(), now(), jsonb_build_object('last_seen_at',ad.last_seen_at,'threshold_minutes',30)
  from public.agent_devices ad
  where ad.status='active'
    and ((ad.last_seen_at is null and ad.created_at < now()-interval '30 minutes')
      or ad.last_seen_at < now()-interval '30 minutes')
    and not exists (
      select 1 from public.system_alerts sa
      where sa.agent_id=ad.id and sa.category='connectivity' and sa.status <> 'resolved'
    );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function public.refresh_agent_connectivity_alerts() from public, anon, authenticated;

-- Cron automatico. Supabase Cron usa pg_cron.
create extension if not exists pg_cron;
select cron.schedule(
  'wisdom-ti-agent-connectivity',
  '*/10 * * * *',
  'select public.refresh_agent_connectivity_alerts();'
);

commit;
