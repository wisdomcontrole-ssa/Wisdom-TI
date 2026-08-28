-- ============================================================
-- INVENTARIO TI
-- M03 RECOVERY - LOCATIONS + ASSETS
-- Reconstructed from the current frontend/backend contract.
-- ============================================================

begin;

alter table public.units
  add column if not exists description text,
  add column if not exists address_text text;

alter table public.environments
  add column if not exists description text;

create sequence if not exists public.asset_code_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  cache 20;

create table if not exists public.asset_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_types_code_ck
    check (code ~ '^[A-Z0-9]{2,12}$')
);

insert into public.asset_types (
  code,
  name,
  description,
  active
)
values
  ('DT',  'Desktop',       'Computador desktop.', true),
  ('NB',  'Notebook',      'Computador portátil.', true),
  ('MON', 'Monitor',       'Monitor de vídeo.', true),
  ('IMP', 'Impressora',    'Impressora ou multifuncional.', true),
  ('NOB', 'Nobreak',       'Nobreak / UPS.', true),
  ('EST', 'Estabilizador', 'Estabilizador de energia.', true),
  ('CMP', 'Componente',    'Componente patrimonial individual.', true),
  ('OUT', 'Outro',         'Outro tipo de ativo.', true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),

  asset_code text not null unique,

  asset_type_id uuid not null
    references public.asset_types(id)
    on delete restrict,

  manufacturer text,
  model text,
  serial_number text,
  hostname text,
  os_name text,

  status text not null default 'active'
    check (
      status in (
        'active',
        'stock',
        'maintenance',
        'retired',
        'disposed'
      )
    ),

  current_unit_id uuid
    references public.units(id)
    on delete restrict,

  current_environment_id uuid
    references public.environments(id)
    on delete restrict,

  notes text,
  acquired_at date,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_movements (
  id uuid primary key default gen_random_uuid(),

  asset_id uuid not null
    references public.assets(id)
    on delete restrict,

  movement_type text not null default 'move',

  from_unit_id uuid
    references public.units(id)
    on delete restrict,

  from_environment_id uuid
    references public.environments(id)
    on delete restrict,

  to_unit_id uuid
    references public.units(id)
    on delete restrict,

  to_environment_id uuid
    references public.environments(id)
    on delete restrict,

  reason text not null,

  moved_by uuid
    references auth.users(id)
    on delete set null,

  moved_at timestamptz not null default now()
);

create index if not exists assets_type_idx
  on public.assets(asset_type_id);

create index if not exists assets_status_idx
  on public.assets(status);

create index if not exists assets_location_idx
  on public.assets(current_unit_id, current_environment_id);

create index if not exists assets_serial_idx
  on public.assets(serial_number)
  where serial_number is not null;

create index if not exists asset_movements_asset_time_idx
  on public.asset_movements(asset_id, moved_at desc);

drop trigger if exists asset_types_set_updated_at
  on public.asset_types;

create trigger asset_types_set_updated_at
before update on public.asset_types
for each row
execute function public.set_updated_at();

drop trigger if exists assets_set_updated_at
  on public.assets;

create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

create or replace function public.m03_prepare_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type_code text;
  v_environment_unit uuid;
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;

    if nullif(btrim(coalesce(new.asset_code, '')), '') is null then
      select upper(at.code)
      into v_type_code
      from public.asset_types at
      where at.id = new.asset_type_id
        and at.active = true;

      if v_type_code is null then
        raise exception 'Tipo de ativo inexistente ou inativo.';
      end if;

      new.asset_code :=
        'WIS-' ||
        v_type_code ||
        '-' ||
        lpad(
          nextval('public.asset_code_seq')::text,
          6,
          '0'
        );
    else
      new.asset_code := upper(btrim(new.asset_code));
    end if;
  end if;

  if new.current_environment_id is not null then
    select e.unit_id
    into v_environment_unit
    from public.environments e
    where e.id = new.current_environment_id
      and e.active = true;

    if v_environment_unit is null then
      raise exception 'Ambiente inexistente ou inativo.';
    end if;

    if new.current_unit_id is null then
      new.current_unit_id := v_environment_unit;
    elsif new.current_unit_id <> v_environment_unit then
      raise exception 'O ambiente nao pertence a unidade informada.';
    end if;
  end if;

  if new.current_unit_id is not null
     and not exists (
       select 1
       from public.units u
       where u.id = new.current_unit_id
         and u.active = true
     ) then
    raise exception 'Unidade inexistente ou inativa.';
  end if;

  return new;
end;
$$;

revoke all
on function public.m03_prepare_asset()
from public, anon, authenticated;

drop trigger if exists trg_m03_prepare_asset
  on public.assets;

create trigger trg_m03_prepare_asset
before insert or update of
  asset_type_id,
  current_unit_id,
  current_environment_id
on public.assets
for each row
execute function public.m03_prepare_asset();

create or replace function public.m03_audit_asset_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    coalesce(auth.uid(), new.created_by),
    case
      when tg_op = 'INSERT' then 'asset.create'
      else 'asset.update'
    end,
    'assets',
    new.id,
    case
      when tg_op = 'INSERT' then null
      else to_jsonb(old)
    end,
    to_jsonb(new),
    jsonb_build_object(
      'module', 'assets',
      'source', 'database_trigger'
    )
  );

  return new;
end;
$$;

revoke all
on function public.m03_audit_asset_change()
from public, anon, authenticated;

drop trigger if exists trg_m03_audit_asset_change
  on public.assets;

create trigger trg_m03_audit_asset_change
after insert or update on public.assets
for each row
execute function public.m03_audit_asset_change();

create or replace function public.move_asset(
  p_asset_id uuid,
  p_to_unit_id uuid,
  p_to_environment_id uuid,
  p_reason text
)
returns table (
  asset_id uuid,
  asset_code text,
  unit_id uuid,
  environment_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_environment_unit uuid;
  v_reason text;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.move') then
    raise exception 'Sem permissao para movimentar ativos.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception 'Justificativa da movimentacao e obrigatoria.';
  end if;

  if p_to_environment_id is not null then
    select e.unit_id
    into v_environment_unit
    from public.environments e
    where e.id = p_to_environment_id
      and e.active = true;

    if v_environment_unit is null then
      raise exception 'Ambiente de destino inexistente ou inativo.';
    end if;

    if p_to_unit_id is null
       or p_to_unit_id <> v_environment_unit then
      raise exception 'O ambiente de destino nao pertence a unidade informada.';
    end if;
  end if;

  if p_to_unit_id is not null
     and not exists (
       select 1
       from public.units u
       where u.id = p_to_unit_id
         and u.active = true
     ) then
    raise exception 'Unidade de destino inexistente ou inativa.';
  end if;

  select *
  into v_asset
  from public.assets a
  where a.id = p_asset_id
  for update;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  if v_asset.status = 'disposed' then
    raise exception 'Ativo descartado nao pode ser movimentado.';
  end if;

  update public.assets a
  set
    current_unit_id = p_to_unit_id,
    current_environment_id = p_to_environment_id
  where a.id = p_asset_id;

  insert into public.asset_movements (
    asset_id,
    movement_type,
    from_unit_id,
    from_environment_id,
    to_unit_id,
    to_environment_id,
    reason,
    moved_by
  )
  values (
    p_asset_id,
    'move',
    v_asset.current_unit_id,
    v_asset.current_environment_id,
    p_to_unit_id,
    p_to_environment_id,
    v_reason,
    v_user
  );

  insert into public.audit_logs (
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
    'asset.move',
    'assets',
    p_asset_id,
    jsonb_build_object(
      'current_unit_id', v_asset.current_unit_id,
      'current_environment_id', v_asset.current_environment_id
    ),
    jsonb_build_object(
      'current_unit_id', p_to_unit_id,
      'current_environment_id', p_to_environment_id
    ),
    jsonb_build_object(
      'reason', v_reason,
      'module', 'assets'
    )
  );

  return query
  select
    v_asset.id,
    v_asset.asset_code,
    p_to_unit_id,
    p_to_environment_id;
end;
$$;

revoke all
on function public.move_asset(uuid, uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.move_asset(uuid, uuid, uuid, text)
to authenticated;

alter table public.asset_types
  enable row level security;

alter table public.assets
  enable row level security;

alter table public.asset_movements
  enable row level security;

drop policy if exists asset_types_select
  on public.asset_types;

create policy asset_types_select
on public.asset_types
for select
to authenticated
using (
  public.has_permission('assets.view')
  or public.has_permission('assets.create')
);

drop policy if exists assets_select
  on public.assets;

create policy assets_select
on public.assets
for select
to authenticated
using (
  public.has_permission('assets.view')
);

drop policy if exists assets_insert
  on public.assets;

create policy assets_insert
on public.assets
for insert
to authenticated
with check (
  public.has_permission('assets.create')
);

drop policy if exists assets_update
  on public.assets;

create policy assets_update
on public.assets
for update
to authenticated
using (
  public.has_permission('assets.update')
)
with check (
  public.has_permission('assets.update')
);

drop policy if exists asset_movements_select
  on public.asset_movements;

create policy asset_movements_select
on public.asset_movements
for select
to authenticated
using (
  public.has_permission('assets.view')
);

revoke all
on table
  public.asset_types,
  public.assets,
  public.asset_movements
from anon;

revoke all
on table
  public.asset_types,
  public.assets,
  public.asset_movements
from authenticated;

grant select
on table public.asset_types
to authenticated;

grant select, insert
on table public.assets
to authenticated;

grant update (
  asset_type_id,
  manufacturer,
  model,
  serial_number,
  hostname,
  os_name,
  status,
  notes,
  acquired_at
)
on public.assets
to authenticated;

grant select
on table public.asset_movements
to authenticated;

grant usage, select
on sequence public.asset_code_seq
to authenticated;

commit;
