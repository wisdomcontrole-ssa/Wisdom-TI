-- ============================================================
-- WISDOM TI
-- M07 - MANUTENCAO, CICLO DE VIDA E DESCARTE
-- Executar no SUPABASE SQL EDITOR
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Sequencias
-- ------------------------------------------------------------

create sequence if not exists public.maintenance_code_seq;
create sequence if not exists public.disposal_code_seq;

-- ------------------------------------------------------------
-- 2. Geradores de codigo
-- ------------------------------------------------------------

create or replace function public.next_maintenance_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return
    'MAN-' ||
    to_char(current_date, 'YYYY') ||
    '-' ||
    lpad(nextval('public.maintenance_code_seq')::text, 6, '0');
end;
$$;

create or replace function public.next_disposal_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return
    'DSC-' ||
    to_char(current_date, 'YYYY') ||
    '-' ||
    lpad(nextval('public.disposal_code_seq')::text, 6, '0');
end;
$$;

revoke all on function public.next_maintenance_code() from public;
revoke all on function public.next_disposal_code() from public;

-- ------------------------------------------------------------
-- 3. Ordens de manutencao
-- ------------------------------------------------------------

create table if not exists public.maintenance_orders (
  id uuid primary key default gen_random_uuid(),

  maintenance_code text not null unique
    default public.next_maintenance_code(),

  asset_id uuid not null
    references public.assets(id)
    on delete restrict,

  maintenance_type text not null
    check (
      maintenance_type in (
        'corrective',
        'preventive',
        'inspection',
        'upgrade'
      )
    ),

  priority text not null default 'normal'
    check (
      priority in (
        'low',
        'normal',
        'high',
        'critical'
      )
    ),

  status text not null default 'open'
    check (
      status in (
        'open',
        'in_progress',
        'waiting_parts',
        'external',
        'completed',
        'cancelled'
      )
    ),

  symptom text not null,
  diagnosis text,
  action_taken text,

  assigned_to uuid
    references auth.users(id)
    on delete set null,

  external_service boolean not null default false,
  provider_name text,
  provider_reference text,

  labor_cost numeric(14,2) not null default 0
    check (labor_cost >= 0),

  external_cost numeric(14,2) not null default 0
    check (external_cost >= 0),

  other_cost numeric(14,2) not null default 0
    check (other_cost >= 0),

  total_cost numeric(14,2)
    generated always as (
      labor_cost + external_cost + other_cost
    ) stored,

  asset_status_before text not null
    check (
      asset_status_before in (
        'active',
        'stock',
        'maintenance',
        'retired'
      )
    ),

  result_asset_status text
    check (
      result_asset_status is null
      or result_asset_status in (
        'active',
        'stock',
        'retired'
      )
    ),

  unit_id_snapshot uuid
    references public.units(id)
    on delete set null,

  environment_id_snapshot uuid
    references public.environments(id)
    on delete set null,

  opened_at timestamptz not null default now(),
  opened_by uuid not null
    references auth.users(id)
    on delete restrict,

  started_at timestamptz,
  started_by uuid
    references auth.users(id)
    on delete set null,

  completed_at timestamptz,
  completed_by uuid
    references auth.users(id)
    on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid
    references auth.users(id)
    on delete set null,

  cancel_reason text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint maintenance_orders_completed_ck
    check (
      status <> 'completed'
      or (
        completed_at is not null
        and completed_by is not null
        and result_asset_status is not null
        and nullif(btrim(action_taken), '') is not null
      )
    ),

  constraint maintenance_orders_cancelled_ck
    check (
      status <> 'cancelled'
      or (
        cancelled_at is not null
        and cancelled_by is not null
        and nullif(btrim(cancel_reason), '') is not null
      )
    )
);

create unique index if not exists maintenance_orders_one_active_per_asset_uidx
  on public.maintenance_orders(asset_id)
  where status in (
    'open',
    'in_progress',
    'waiting_parts',
    'external'
  );

create index if not exists maintenance_orders_asset_idx
  on public.maintenance_orders(asset_id, opened_at desc);

create index if not exists maintenance_orders_status_idx
  on public.maintenance_orders(status, opened_at desc);

create index if not exists maintenance_orders_assigned_idx
  on public.maintenance_orders(assigned_to, status);

-- ------------------------------------------------------------
-- 4. Pecas / materiais vinculados a manutencao
-- ------------------------------------------------------------

create table if not exists public.maintenance_parts (
  id uuid primary key default gen_random_uuid(),

  maintenance_id uuid not null
    references public.maintenance_orders(id)
    on delete restrict,

  stock_unit_id uuid
    references public.stock_units(id)
    on delete restrict,

  action text not null
    check (
      action in (
        'installed',
        'removed',
        'consumed',
        'replaced',
        'other'
      )
    ),

  description text not null,

  quantity numeric(12,3) not null default 1
    check (quantity > 0),

  unit_cost numeric(14,2) not null default 0
    check (unit_cost >= 0),

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz not null default now(),

  removed_at timestamptz,
  removed_by uuid
    references auth.users(id)
    on delete set null,

  remove_reason text,

  constraint maintenance_parts_stock_quantity_ck
    check (
      stock_unit_id is null
      or quantity = 1
    ),

  constraint maintenance_parts_logical_remove_ck
    check (
      removed_at is null
      or (
        removed_by is not null
        and nullif(btrim(remove_reason), '') is not null
      )
    )
);

create index if not exists maintenance_parts_order_idx
  on public.maintenance_parts(maintenance_id, created_at desc);

create index if not exists maintenance_parts_stock_idx
  on public.maintenance_parts(stock_unit_id)
  where stock_unit_id is not null;

-- ------------------------------------------------------------
-- 5. Eventos internos da manutencao
-- ------------------------------------------------------------

create table if not exists public.maintenance_events (
  id uuid primary key default gen_random_uuid(),

  maintenance_id uuid not null
    references public.maintenance_orders(id)
    on delete restrict,

  event_type text not null
    check (
      event_type in (
        'created',
        'updated',
        'status_changed',
        'part_added',
        'part_removed',
        'completed',
        'cancelled'
      )
    ),

  reason text,

  previous_data jsonb,
  new_data jsonb,

  actor_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  occurred_at timestamptz not null default now()
);

create index if not exists maintenance_events_order_idx
  on public.maintenance_events(
    maintenance_id,
    occurred_at desc
  );

-- ------------------------------------------------------------
-- 6. Linha do tempo de ciclo de vida do ativo
-- ------------------------------------------------------------

create table if not exists public.asset_lifecycle_events (
  id uuid primary key default gen_random_uuid(),

  asset_id uuid not null
    references public.assets(id)
    on delete restrict,

  event_type text not null
    check (
      event_type in (
        'maintenance_opened',
        'maintenance_completed',
        'maintenance_cancelled',
        'retired',
        'disposed'
      )
    ),

  from_status text,
  to_status text,

  reference_type text,
  reference_id uuid,

  reason text not null,

  actor_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  metadata jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now()
);

create index if not exists asset_lifecycle_events_asset_idx
  on public.asset_lifecycle_events(
    asset_id,
    occurred_at desc
  );

-- ------------------------------------------------------------
-- 7. Registro final de descarte
-- ------------------------------------------------------------

create table if not exists public.asset_disposals (
  id uuid primary key default gen_random_uuid(),

  disposal_code text not null unique
    default public.next_disposal_code(),

  asset_id uuid not null unique
    references public.assets(id)
    on delete restrict,

  reason_category text not null
    check (
      reason_category in (
        'damage',
        'obsolete',
        'unrepairable',
        'lost',
        'donation',
        'sale',
        'recycling',
        'other'
      )
    ),

  disposal_method text not null
    check (
      disposal_method in (
        'recycling',
        'donation',
        'sale',
        'destruction',
        'return',
        'other'
      )
    ),

  reason text not null,

  destination text,

  residual_value numeric(14,2)
    check (
      residual_value is null
      or residual_value >= 0
    ),

  previous_status text not null,
  unit_id_snapshot uuid
    references public.units(id)
    on delete set null,

  environment_id_snapshot uuid
    references public.environments(id)
    on delete set null,

  disposed_at timestamptz not null default now(),

  disposed_by uuid not null
    references auth.users(id)
    on delete restrict,

  notes text,

  created_at timestamptz not null default now()
);

create index if not exists asset_disposals_date_idx
  on public.asset_disposals(disposed_at desc);

-- ------------------------------------------------------------
-- 8. Updated_at proprio do M07
-- ------------------------------------------------------------

create or replace function public.m07_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_m07_maintenance_updated_at
  on public.maintenance_orders;

create trigger trg_m07_maintenance_updated_at
before update on public.maintenance_orders
for each row
execute function public.m07_touch_updated_at();

-- ------------------------------------------------------------
-- 9. Guardas de ciclo de vida
-- ------------------------------------------------------------

create or replace function public.m07_guard_asset_component_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select a.status
    into v_status
  from public.assets a
  where a.id = new.asset_id;

  if v_status in ('retired', 'disposed') then
    raise exception
      'Nao e permitido instalar componente em ativo %.',
      v_status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_m07_guard_asset_component_target
  on public.asset_components;

create trigger trg_m07_guard_asset_component_target
before insert or update of asset_id
on public.asset_components
for each row
when (new.removed_at is null)
execute function public.m07_guard_asset_component_target();

create or replace function public.m07_guard_stock_install_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if new.installed_asset_id is null then
    return new;
  end if;

  select a.status
    into v_status
  from public.assets a
  where a.id = new.installed_asset_id;

  if v_status in ('retired', 'disposed') then
    raise exception
      'Nao e permitido instalar estoque em ativo %.',
      v_status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_m07_guard_stock_install_target
  on public.stock_units;

create trigger trg_m07_guard_stock_install_target
before insert or update of installed_asset_id
on public.stock_units
for each row
execute function public.m07_guard_stock_install_target();

-- ------------------------------------------------------------
-- 10. Criar manutencao
-- ------------------------------------------------------------

create or replace function public.create_maintenance_order(
  p_asset_id uuid,
  p_maintenance_type text,
  p_priority text,
  p_symptom text,
  p_assigned_to uuid default null,
  p_external_service boolean default false,
  p_provider_name text default null,
  p_provider_reference text default null,
  p_notes text default null
)
returns table (
  maintenance_id uuid,
  maintenance_code text,
  status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_order public.maintenance_orders%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception
      'Sem permissao para abrir manutencao.';
  end if;

  if p_maintenance_type not in (
    'corrective',
    'preventive',
    'inspection',
    'upgrade'
  ) then
    raise exception 'Tipo de manutencao invalido.';
  end if;

  if p_priority not in (
    'low',
    'normal',
    'high',
    'critical'
  ) then
    raise exception 'Prioridade invalida.';
  end if;

  if nullif(btrim(p_symptom), '') is null then
    raise exception
      'Defeito, sintoma ou objetivo e obrigatorio.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  if v_asset.status = 'disposed' then
    raise exception
      'Ativo descartado nao pode entrar em manutencao.';
  end if;

  if exists (
    select 1
    from public.maintenance_orders m
    where m.asset_id = p_asset_id
      and m.status in (
        'open',
        'in_progress',
        'waiting_parts',
        'external'
      )
  ) then
    raise exception
      'Ja existe manutencao ativa para este ativo.';
  end if;

  insert into public.maintenance_orders (
    asset_id,
    maintenance_type,
    priority,
    symptom,
    assigned_to,
    external_service,
    provider_name,
    provider_reference,
    asset_status_before,
    unit_id_snapshot,
    environment_id_snapshot,
    opened_by,
    notes
  )
  values (
    p_asset_id,
    p_maintenance_type,
    p_priority,
    btrim(p_symptom),
    p_assigned_to,
    coalesce(p_external_service, false),
    nullif(btrim(p_provider_name), ''),
    nullif(btrim(p_provider_reference), ''),
    v_asset.status,
    v_asset.current_unit_id,
    v_asset.current_environment_id,
    v_user,
    nullif(btrim(p_notes), '')
  )
  returning *
  into v_order;

  if v_asset.status <> 'maintenance' then
    update public.assets
    set status = 'maintenance'
    where id = p_asset_id;
  end if;

  insert into public.maintenance_events (
    maintenance_id,
    event_type,
    reason,
    new_data,
    actor_user_id
  )
  values (
    v_order.id,
    'created',
    'Abertura da manutencao.',
    to_jsonb(v_order),
    v_user
  );

  insert into public.asset_lifecycle_events (
    asset_id,
    event_type,
    from_status,
    to_status,
    reference_type,
    reference_id,
    reason,
    actor_user_id,
    metadata
  )
  values (
    p_asset_id,
    'maintenance_opened',
    v_asset.status,
    'maintenance',
    'maintenance_orders',
    v_order.id,
    btrim(p_symptom),
    v_user,
    jsonb_build_object(
      'maintenance_code',
      v_order.maintenance_code,
      'maintenance_type',
      v_order.maintenance_type,
      'priority',
      v_order.priority
    )
  );

  return query
  select
    v_order.id,
    v_order.maintenance_code,
    v_order.status;
end;
$$;

-- ------------------------------------------------------------
-- 11. Atualizar manutencao ativa
-- ------------------------------------------------------------

create or replace function public.update_maintenance_order(
  p_maintenance_id uuid,
  p_status text,
  p_priority text,
  p_symptom text,
  p_diagnosis text default null,
  p_action_taken text default null,
  p_assigned_to uuid default null,
  p_external_service boolean default false,
  p_provider_name text default null,
  p_provider_reference text default null,
  p_labor_cost numeric default 0,
  p_external_cost numeric default 0,
  p_other_cost numeric default 0,
  p_notes text default null,
  p_reason text default 'Atualizacao da manutencao.'
)
returns public.maintenance_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_before public.maintenance_orders%rowtype;
  v_after public.maintenance_orders%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception
      'Sem permissao para atualizar manutencao.';
  end if;

  if p_status not in (
    'open',
    'in_progress',
    'waiting_parts',
    'external'
  ) then
    raise exception
      'Status de manutencao invalido para atualizacao.';
  end if;

  if p_priority not in (
    'low',
    'normal',
    'high',
    'critical'
  ) then
    raise exception 'Prioridade invalida.';
  end if;

  if nullif(btrim(p_symptom), '') is null then
    raise exception
      'Defeito, sintoma ou objetivo e obrigatorio.';
  end if;

  if coalesce(p_labor_cost, 0) < 0
     or coalesce(p_external_cost, 0) < 0
     or coalesce(p_other_cost, 0) < 0 then
    raise exception 'Custos nao podem ser negativos.';
  end if;

  select *
    into v_before
  from public.maintenance_orders
  where id = p_maintenance_id
  for update;

  if not found then
    raise exception 'Manutencao nao encontrada.';
  end if;

  if v_before.status in ('completed', 'cancelled') then
    raise exception
      'Manutencao finalizada nao pode ser alterada.';
  end if;

  update public.maintenance_orders
  set
    status = p_status,
    priority = p_priority,
    symptom = btrim(p_symptom),
    diagnosis = nullif(btrim(p_diagnosis), ''),
    action_taken = nullif(btrim(p_action_taken), ''),
    assigned_to = p_assigned_to,
    external_service = coalesce(p_external_service, false),
    provider_name = nullif(btrim(p_provider_name), ''),
    provider_reference = nullif(btrim(p_provider_reference), ''),
    labor_cost = coalesce(p_labor_cost, 0),
    external_cost = coalesce(p_external_cost, 0),
    other_cost = coalesce(p_other_cost, 0),
    notes = nullif(btrim(p_notes), ''),
    started_at = case
      when p_status <> 'open'
        then coalesce(started_at, now())
      else started_at
    end,
    started_by = case
      when p_status <> 'open'
        then coalesce(started_by, v_user)
      else started_by
    end
  where id = p_maintenance_id
  returning *
  into v_after;

  insert into public.maintenance_events (
    maintenance_id,
    event_type,
    reason,
    previous_data,
    new_data,
    actor_user_id
  )
  values (
    p_maintenance_id,
    case
      when v_before.status is distinct from v_after.status
        then 'status_changed'
      else 'updated'
    end,
    coalesce(
      nullif(btrim(p_reason), ''),
      'Atualizacao da manutencao.'
    ),
    to_jsonb(v_before),
    to_jsonb(v_after),
    v_user
  );

  return v_after;
end;
$$;

-- ------------------------------------------------------------
-- 12. Vincular peca/material a manutencao
-- ------------------------------------------------------------

create or replace function public.add_maintenance_part(
  p_maintenance_id uuid,
  p_action text,
  p_description text,
  p_stock_unit_id uuid default null,
  p_quantity numeric default 1,
  p_unit_cost numeric default 0
)
returns public.maintenance_parts
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_order public.maintenance_orders%rowtype;
  v_part public.maintenance_parts%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception
      'Sem permissao para registrar peca de manutencao.';
  end if;

  if p_action not in (
    'installed',
    'removed',
    'consumed',
    'replaced',
    'other'
  ) then
    raise exception 'Acao da peca invalida.';
  end if;

  if nullif(btrim(p_description), '') is null then
    raise exception 'Descricao da peca e obrigatoria.';
  end if;

  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'Quantidade invalida.';
  end if;

  if coalesce(p_unit_cost, 0) < 0 then
    raise exception 'Custo unitario invalido.';
  end if;

  select *
    into v_order
  from public.maintenance_orders
  where id = p_maintenance_id
  for update;

  if not found then
    raise exception 'Manutencao nao encontrada.';
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception
      'Nao e permitido alterar pecas de manutencao finalizada.';
  end if;

  if p_stock_unit_id is not null then
    if coalesce(p_quantity, 1) <> 1 then
      raise exception
        'Item fisico do estoque deve ter quantidade igual a 1.';
    end if;

    if not exists (
      select 1
      from public.stock_units
      where id = p_stock_unit_id
    ) then
      raise exception
        'Item de estoque nao encontrado.';
    end if;
  end if;

  insert into public.maintenance_parts (
    maintenance_id,
    stock_unit_id,
    action,
    description,
    quantity,
    unit_cost,
    created_by
  )
  values (
    p_maintenance_id,
    p_stock_unit_id,
    p_action,
    btrim(p_description),
    coalesce(p_quantity, 1),
    coalesce(p_unit_cost, 0),
    v_user
  )
  returning *
  into v_part;

  insert into public.maintenance_events (
    maintenance_id,
    event_type,
    reason,
    new_data,
    actor_user_id
  )
  values (
    p_maintenance_id,
    'part_added',
    'Peca ou material vinculado.',
    to_jsonb(v_part),
    v_user
  );

  return v_part;
end;
$$;

-- ------------------------------------------------------------
-- 13. Remover logicamente peca/material
-- ------------------------------------------------------------

create or replace function public.remove_maintenance_part(
  p_maintenance_part_id uuid,
  p_reason text
)
returns public.maintenance_parts
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_part public.maintenance_parts%rowtype;
  v_order public.maintenance_orders%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception
      'Sem permissao para alterar peca de manutencao.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'Justificativa de remocao e obrigatoria.';
  end if;

  select *
    into v_part
  from public.maintenance_parts
  where id = p_maintenance_part_id
  for update;

  if not found then
    raise exception 'Peca de manutencao nao encontrada.';
  end if;

  if v_part.removed_at is not null then
    return v_part;
  end if;

  select *
    into v_order
  from public.maintenance_orders
  where id = v_part.maintenance_id;

  if v_order.status in ('completed', 'cancelled') then
    raise exception
      'Manutencao finalizada nao pode ter pecas alteradas.';
  end if;

  update public.maintenance_parts
  set
    removed_at = now(),
    removed_by = v_user,
    remove_reason = btrim(p_reason)
  where id = p_maintenance_part_id
  returning *
  into v_part;

  insert into public.maintenance_events (
    maintenance_id,
    event_type,
    reason,
    new_data,
    actor_user_id
  )
  values (
    v_part.maintenance_id,
    'part_removed',
    btrim(p_reason),
    to_jsonb(v_part),
    v_user
  );

  return v_part;
end;
$$;

-- ------------------------------------------------------------
-- 14. Concluir manutencao
-- ------------------------------------------------------------

create or replace function public.complete_maintenance_order(
  p_maintenance_id uuid,
  p_action_taken text,
  p_result_asset_status text,
  p_diagnosis text default null,
  p_notes text default null
)
returns public.maintenance_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_before public.maintenance_orders%rowtype;
  v_after public.maintenance_orders%rowtype;
  v_asset public.assets%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception
      'Sem permissao para concluir manutencao.';
  end if;

  if nullif(btrim(p_action_taken), '') is null then
    raise exception
      'Acao executada e obrigatoria.';
  end if;

  if p_result_asset_status not in (
    'active',
    'stock',
    'retired'
  ) then
    raise exception
      'Status final do ativo invalido.';
  end if;

  select *
    into v_before
  from public.maintenance_orders
  where id = p_maintenance_id
  for update;

  if not found then
    raise exception 'Manutencao nao encontrada.';
  end if;

  if v_before.status in ('completed', 'cancelled') then
    raise exception
      'Manutencao ja finalizada.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = v_before.asset_id
  for update;

  update public.maintenance_orders
  set
    status = 'completed',
    diagnosis = coalesce(
      nullif(btrim(p_diagnosis), ''),
      diagnosis
    ),
    action_taken = btrim(p_action_taken),
    result_asset_status = p_result_asset_status,
    completed_at = now(),
    completed_by = v_user,
    notes = coalesce(
      nullif(btrim(p_notes), ''),
      notes
    )
  where id = p_maintenance_id
  returning *
  into v_after;

  update public.assets
  set status = p_result_asset_status
  where id = v_before.asset_id;

  insert into public.maintenance_events (
    maintenance_id,
    event_type,
    reason,
    previous_data,
    new_data,
    actor_user_id
  )
  values (
    p_maintenance_id,
    'completed',
    btrim(p_action_taken),
    to_jsonb(v_before),
    to_jsonb(v_after),
    v_user
  );

  insert into public.asset_lifecycle_events (
    asset_id,
    event_type,
    from_status,
    to_status,
    reference_type,
    reference_id,
    reason,
    actor_user_id,
    metadata
  )
  values (
    v_before.asset_id,
    'maintenance_completed',
    v_asset.status,
    p_result_asset_status,
    'maintenance_orders',
    p_maintenance_id,
    btrim(p_action_taken),
    v_user,
    jsonb_build_object(
      'maintenance_code',
      v_after.maintenance_code,
      'diagnosis',
      v_after.diagnosis
    )
  );

  return v_after;
end;
$$;

-- ------------------------------------------------------------
-- 15. Cancelar manutencao
-- ------------------------------------------------------------

create or replace function public.cancel_maintenance_order(
  p_maintenance_id uuid,
  p_reason text
)
returns public.maintenance_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_before public.maintenance_orders%rowtype;
  v_after public.maintenance_orders%rowtype;
  v_asset public.assets%rowtype;
  v_restore_status text;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception
      'Sem permissao para cancelar manutencao.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'Justificativa de cancelamento e obrigatoria.';
  end if;

  select *
    into v_before
  from public.maintenance_orders
  where id = p_maintenance_id
  for update;

  if not found then
    raise exception 'Manutencao nao encontrada.';
  end if;

  if v_before.status in ('completed', 'cancelled') then
    raise exception
      'Manutencao ja finalizada.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = v_before.asset_id
  for update;

  v_restore_status :=
    case
      when v_before.asset_status_before = 'maintenance'
        then 'active'
      else v_before.asset_status_before
    end;

  update public.maintenance_orders
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_user,
    cancel_reason = btrim(p_reason)
  where id = p_maintenance_id
  returning *
  into v_after;

  update public.assets
  set status = v_restore_status
  where id = v_before.asset_id;

  insert into public.maintenance_events (
    maintenance_id,
    event_type,
    reason,
    previous_data,
    new_data,
    actor_user_id
  )
  values (
    p_maintenance_id,
    'cancelled',
    btrim(p_reason),
    to_jsonb(v_before),
    to_jsonb(v_after),
    v_user
  );

  insert into public.asset_lifecycle_events (
    asset_id,
    event_type,
    from_status,
    to_status,
    reference_type,
    reference_id,
    reason,
    actor_user_id,
    metadata
  )
  values (
    v_before.asset_id,
    'maintenance_cancelled',
    v_asset.status,
    v_restore_status,
    'maintenance_orders',
    p_maintenance_id,
    btrim(p_reason),
    v_user,
    jsonb_build_object(
      'maintenance_code',
      v_after.maintenance_code
    )
  );

  return v_after;
end;
$$;

-- ------------------------------------------------------------
-- 16. Baixar / aposentar ativo
-- ------------------------------------------------------------

create or replace function public.retire_asset(
  p_asset_id uuid,
  p_reason text
)
returns table (
  asset_id uuid,
  asset_code text,
  status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.retire') then
    raise exception
      'Sem permissao para baixar ativo.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'Justificativa de baixa e obrigatoria.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  if v_asset.status = 'disposed' then
    raise exception
      'Ativo ja foi descartado.';
  end if;

  if v_asset.status = 'retired' then
    return query
    select
      v_asset.id,
      v_asset.asset_code,
      v_asset.status;
    return;
  end if;

  if exists (
    select 1
    from public.maintenance_orders m
    where m.asset_id = p_asset_id
      and m.status in (
        'open',
        'in_progress',
        'waiting_parts',
        'external'
      )
  ) then
    raise exception
      'Conclua ou cancele a manutencao ativa antes da baixa.';
  end if;

  update public.assets
  set status = 'retired'
  where id = p_asset_id;

  insert into public.asset_lifecycle_events (
    asset_id,
    event_type,
    from_status,
    to_status,
    reference_type,
    reference_id,
    reason,
    actor_user_id
  )
  values (
    p_asset_id,
    'retired',
    v_asset.status,
    'retired',
    'assets',
    p_asset_id,
    btrim(p_reason),
    v_user
  );

  return query
  select
    v_asset.id,
    v_asset.asset_code,
    'retired'::text;
end;
$$;

-- ------------------------------------------------------------
-- 17. Descartar ativo
-- ------------------------------------------------------------

create or replace function public.dispose_asset(
  p_asset_id uuid,
  p_reason_category text,
  p_disposal_method text,
  p_reason text,
  p_destination text default null,
  p_residual_value numeric default null,
  p_notes text default null
)
returns table (
  disposal_id uuid,
  disposal_code text,
  asset_id uuid,
  asset_code text,
  status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_disposal public.asset_disposals%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.retire') then
    raise exception
      'Sem permissao para descartar ativo.';
  end if;

  if p_reason_category not in (
    'damage',
    'obsolete',
    'unrepairable',
    'lost',
    'donation',
    'sale',
    'recycling',
    'other'
  ) then
    raise exception
      'Categoria de descarte invalida.';
  end if;

  if p_disposal_method not in (
    'recycling',
    'donation',
    'sale',
    'destruction',
    'return',
    'other'
  ) then
    raise exception
      'Metodo de descarte invalido.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'Justificativa de descarte e obrigatoria.';
  end if;

  if p_residual_value is not null
     and p_residual_value < 0 then
    raise exception
      'Valor residual nao pode ser negativo.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  if v_asset.status = 'disposed' then
    raise exception
      'Ativo ja foi descartado.';
  end if;

  if v_asset.status <> 'retired' then
    raise exception
      'O ativo deve estar baixado antes do descarte.';
  end if;

  if exists (
    select 1
    from public.maintenance_orders m
    where m.asset_id = p_asset_id
      and m.status in (
        'open',
        'in_progress',
        'waiting_parts',
        'external'
      )
  ) then
    raise exception
      'Existe manutencao ativa para este ativo.';
  end if;

  if exists (
    select 1
    from public.asset_components ac
    where ac.asset_id = p_asset_id
      and ac.removed_at is null
  ) or exists (
    select 1
    from public.stock_units su
    where su.installed_asset_id = p_asset_id
  ) then
    raise exception
      'Retire ou trate os componentes instalados antes do descarte.';
  end if;

  insert into public.asset_disposals (
    asset_id,
    reason_category,
    disposal_method,
    reason,
    destination,
    residual_value,
    previous_status,
    unit_id_snapshot,
    environment_id_snapshot,
    disposed_by,
    notes
  )
  values (
    p_asset_id,
    p_reason_category,
    p_disposal_method,
    btrim(p_reason),
    nullif(btrim(p_destination), ''),
    p_residual_value,
    v_asset.status,
    v_asset.current_unit_id,
    v_asset.current_environment_id,
    v_user,
    nullif(btrim(p_notes), '')
  )
  returning *
  into v_disposal;

  update public.assets
  set status = 'disposed'
  where id = p_asset_id;

  insert into public.asset_lifecycle_events (
    asset_id,
    event_type,
    from_status,
    to_status,
    reference_type,
    reference_id,
    reason,
    actor_user_id,
    metadata
  )
  values (
    p_asset_id,
    'disposed',
    v_asset.status,
    'disposed',
    'asset_disposals',
    v_disposal.id,
    btrim(p_reason),
    v_user,
    jsonb_build_object(
      'disposal_code',
      v_disposal.disposal_code,
      'reason_category',
      v_disposal.reason_category,
      'disposal_method',
      v_disposal.disposal_method,
      'destination',
      v_disposal.destination
    )
  );

  return query
  select
    v_disposal.id,
    v_disposal.disposal_code,
    v_asset.id,
    v_asset.asset_code,
    'disposed'::text;
end;
$$;

-- ------------------------------------------------------------
-- 18. RLS
-- ------------------------------------------------------------

alter table public.maintenance_orders
  enable row level security;

alter table public.maintenance_parts
  enable row level security;

alter table public.maintenance_events
  enable row level security;

alter table public.asset_lifecycle_events
  enable row level security;

alter table public.asset_disposals
  enable row level security;

drop policy if exists maintenance_orders_select
  on public.maintenance_orders;

create policy maintenance_orders_select
on public.maintenance_orders
for select
to authenticated
using (
  public.has_permission('assets.view')
);

drop policy if exists maintenance_parts_select
  on public.maintenance_parts;

create policy maintenance_parts_select
on public.maintenance_parts
for select
to authenticated
using (
  public.has_permission('assets.view')
  or public.has_permission('stock.view')
);

drop policy if exists maintenance_events_select
  on public.maintenance_events;

create policy maintenance_events_select
on public.maintenance_events
for select
to authenticated
using (
  public.has_permission('assets.view')
);

drop policy if exists asset_lifecycle_events_select
  on public.asset_lifecycle_events;

create policy asset_lifecycle_events_select
on public.asset_lifecycle_events
for select
to authenticated
using (
  public.has_permission('assets.view')
);

drop policy if exists asset_disposals_select
  on public.asset_disposals;

create policy asset_disposals_select
on public.asset_disposals
for select
to authenticated
using (
  public.has_permission('assets.view')
);

-- ------------------------------------------------------------
-- 19. Grants
-- Escrita somente pelas RPCs SECURITY DEFINER.
-- ------------------------------------------------------------

revoke all
on public.maintenance_orders,
   public.maintenance_parts,
   public.maintenance_events,
   public.asset_lifecycle_events,
   public.asset_disposals
from anon;

revoke insert, update, delete
on public.maintenance_orders,
   public.maintenance_parts,
   public.maintenance_events,
   public.asset_lifecycle_events,
   public.asset_disposals
from authenticated;

grant select
on public.maintenance_orders,
   public.maintenance_parts,
   public.maintenance_events,
   public.asset_lifecycle_events,
   public.asset_disposals
to authenticated;

grant execute
on function public.create_maintenance_order(
  uuid,
  text,
  text,
  text,
  uuid,
  boolean,
  text,
  text,
  text
)
to authenticated;

grant execute
on function public.update_maintenance_order(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  boolean,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  text
)
to authenticated;

grant execute
on function public.add_maintenance_part(
  uuid,
  text,
  text,
  uuid,
  numeric,
  numeric
)
to authenticated;

grant execute
on function public.remove_maintenance_part(
  uuid,
  text
)
to authenticated;

grant execute
on function public.complete_maintenance_order(
  uuid,
  text,
  text,
  text,
  text
)
to authenticated;

grant execute
on function public.cancel_maintenance_order(
  uuid,
  text
)
to authenticated;

grant execute
on function public.retire_asset(
  uuid,
  text
)
to authenticated;

grant execute
on function public.dispose_asset(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text
)
to authenticated;

commit;

-- ============================================================
-- FIM M07
-- ============================================================