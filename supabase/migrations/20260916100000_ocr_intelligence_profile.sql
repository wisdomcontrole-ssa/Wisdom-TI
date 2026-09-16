-- =====================================================================
-- INVENTARIO TI - OCR INTELLIGENCE / PERFIL TECNICO
-- Executar este MESMO SQL nos 2 projetos Supabase.
-- Idempotente.
-- =====================================================================

begin;

create table if not exists public.asset_technical_profiles (
  asset_id uuid primary key
    references public.assets(id)
    on delete cascade,

  processor_manufacturer text null,
  processor_model text null,

  memory_total_gb numeric(10,2) null,
  memory_type text null,
  memory_speed_mhz integer null,

  storage_capacity_gb numeric(12,2) null,
  storage_type text null,
  storage_interface text null,
  storage_form_factor text null,

  motherboard_manufacturer text null,
  motherboard_model text null,

  wifi_manufacturer text null,
  wifi_model text null,
  mac_address text null,

  source text not null default 'manual',
  updated_by uuid null
    references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_technical_profile_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null
    references public.assets(id)
    on delete cascade,
  previous_data jsonb null,
  new_data jsonb not null,
  source text not null default 'manual',
  changed_by uuid null
    references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_asset_technical_profile_history_asset
  on public.asset_technical_profile_history(asset_id, changed_at desc);

alter table public.asset_technical_profiles
  enable row level security;

alter table public.asset_technical_profile_history
  enable row level security;

drop policy if exists asset_technical_profiles_select
  on public.asset_technical_profiles;

create policy asset_technical_profiles_select
  on public.asset_technical_profiles
  for select
  to authenticated
  using (public.has_permission('assets.view'));

drop policy if exists asset_technical_profiles_insert
  on public.asset_technical_profiles;

create policy asset_technical_profiles_insert
  on public.asset_technical_profiles
  for insert
  to authenticated
  with check (
    public.has_permission('assets.create')
    or public.has_permission('assets.update')
  );

drop policy if exists asset_technical_profiles_update
  on public.asset_technical_profiles;

create policy asset_technical_profiles_update
  on public.asset_technical_profiles
  for update
  to authenticated
  using (
    public.has_permission('assets.create')
    or public.has_permission('assets.update')
  )
  with check (
    public.has_permission('assets.create')
    or public.has_permission('assets.update')
  );

drop policy if exists asset_technical_profile_history_select
  on public.asset_technical_profile_history;

create policy asset_technical_profile_history_select
  on public.asset_technical_profile_history
  for select
  to authenticated
  using (public.has_permission('assets.view'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ti_ocr_extraction_runs_asset_id_fkey'
      and conrelid = 'public.ti_ocr_extraction_runs'::regclass
  ) then
    alter table public.ti_ocr_extraction_runs
      add constraint ti_ocr_extraction_runs_asset_id_fkey
      foreign key (asset_id)
      references public.assets(id)
      on delete set null;
  end if;
end
$$;

create or replace function public.set_asset_technical_profile(
  p_asset_id uuid,
  p_processor_manufacturer text default null,
  p_processor_model text default null,
  p_memory_total_gb numeric default null,
  p_memory_type text default null,
  p_memory_speed_mhz integer default null,
  p_storage_capacity_gb numeric default null,
  p_storage_type text default null,
  p_storage_interface text default null,
  p_storage_form_factor text default null,
  p_motherboard_manufacturer text default null,
  p_motherboard_model text default null,
  p_operating_system text default null,
  p_wifi_manufacturer text default null,
  p_wifi_model text default null,
  p_mac_address text default null,
  p_source text default 'manual'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_previous jsonb;
  v_new jsonb;
  v_source text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_permission('assets.create')
    or public.has_permission('assets.update')
  ) then
    raise exception 'Permission denied';
  end if;

  if not exists (
    select 1
    from public.assets
    where id = p_asset_id
  ) then
    raise exception 'Asset not found';
  end if;

  v_source := coalesce(
    nullif(btrim(p_source), ''),
    'manual'
  );

  select to_jsonb(t)
    into v_previous
  from public.asset_technical_profiles t
  where t.asset_id = p_asset_id;

  insert into public.asset_technical_profiles (
    asset_id,
    processor_manufacturer,
    processor_model,
    memory_total_gb,
    memory_type,
    memory_speed_mhz,
    storage_capacity_gb,
    storage_type,
    storage_interface,
    storage_form_factor,
    motherboard_manufacturer,
    motherboard_model,
    wifi_manufacturer,
    wifi_model,
    mac_address,
    source,
    updated_by,
    created_at,
    updated_at
  )
  values (
    p_asset_id,
    nullif(btrim(p_processor_manufacturer), ''),
    nullif(btrim(p_processor_model), ''),
    p_memory_total_gb,
    nullif(btrim(p_memory_type), ''),
    p_memory_speed_mhz,
    p_storage_capacity_gb,
    nullif(btrim(p_storage_type), ''),
    nullif(btrim(p_storage_interface), ''),
    nullif(btrim(p_storage_form_factor), ''),
    nullif(btrim(p_motherboard_manufacturer), ''),
    nullif(btrim(p_motherboard_model), ''),
    nullif(btrim(p_wifi_manufacturer), ''),
    nullif(btrim(p_wifi_model), ''),
    upper(nullif(btrim(p_mac_address), '')),
    v_source,
    auth.uid(),
    now(),
    now()
  )
  on conflict (asset_id)
  do update set
    processor_manufacturer =
      excluded.processor_manufacturer,
    processor_model =
      excluded.processor_model,
    memory_total_gb =
      excluded.memory_total_gb,
    memory_type =
      excluded.memory_type,
    memory_speed_mhz =
      excluded.memory_speed_mhz,
    storage_capacity_gb =
      excluded.storage_capacity_gb,
    storage_type =
      excluded.storage_type,
    storage_interface =
      excluded.storage_interface,
    storage_form_factor =
      excluded.storage_form_factor,
    motherboard_manufacturer =
      excluded.motherboard_manufacturer,
    motherboard_model =
      excluded.motherboard_model,
    wifi_manufacturer =
      excluded.wifi_manufacturer,
    wifi_model =
      excluded.wifi_model,
    mac_address =
      excluded.mac_address,
    source =
      excluded.source,
    updated_by =
      excluded.updated_by,
    updated_at = now();

  if nullif(btrim(p_operating_system), '') is not null then
    update public.assets
    set
      os_name =
        nullif(btrim(p_operating_system), ''),
      updated_at = now()
    where id = p_asset_id;
  end if;

  select to_jsonb(t)
    into v_new
  from public.asset_technical_profiles t
  where t.asset_id = p_asset_id;

  insert into public.asset_technical_profile_history (
    asset_id,
    previous_data,
    new_data,
    source,
    changed_by
  )
  values (
    p_asset_id,
    v_previous,
    v_new,
    v_source,
    auth.uid()
  );
end;
$$;

revoke all on function public.set_asset_technical_profile(
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.set_asset_technical_profile(
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

commit;

select
  to_regclass('public.asset_technical_profiles')
    as asset_technical_profiles,
  to_regclass('public.asset_technical_profile_history')
    as asset_technical_profile_history,
  (
    select count(*)
    from public.ti_manufacturers
  ) as fabricantes,
  (
    select count(*)
    from public.ti_equipment_categories
  ) as categorias;