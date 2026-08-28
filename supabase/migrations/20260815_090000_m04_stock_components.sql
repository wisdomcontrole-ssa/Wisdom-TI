-- ============================================================
-- INVENTARIO TI
-- M04 RECOVERY - STOCK + COMPONENTS
-- Reconstructed from the current frontend/backend contract.
-- ============================================================

begin;

create sequence if not exists public.stock_unit_code_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  cache 20;

create table if not exists public.stock_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  track_serial boolean not null default false,
  can_install boolean not null default true,
  active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_products_code_ck
    check (code ~ '^[A-Z0-9]{2,12}$')
);

insert into public.stock_products (
  code,
  name,
  category,
  track_serial,
  can_install,
  active,
  description
)
values
  ('RAM', 'Memória RAM',        'Memória',        false, true,  true, 'Módulo de memória RAM.'),
  ('SSD', 'SSD',                'Armazenamento',  true,  true,  true, 'Unidade de estado sólido.'),
  ('HDD', 'HD',                 'Armazenamento',  true,  true,  true, 'Disco rígido.'),
  ('PSU', 'Fonte de alimentação','Energia',       true,  true,  true, 'Fonte de alimentação.'),
  ('GPU', 'Placa de vídeo',     'Expansão',       true,  true,  true, 'Adaptador gráfico.'),
  ('NIC', 'Placa de rede',      'Rede',           true,  true,  true, 'Adaptador de rede.'),
  ('KB',  'Teclado',            'Periférico',     false, false, true, 'Teclado.'),
  ('MOU', 'Mouse',              'Periférico',     false, false, true, 'Mouse.'),
  ('CAB', 'Cabo / adaptador',   'Acessório',      false, false, true, 'Cabos e adaptadores.'),
  ('OUT', 'Outro componente',   'Outros',         false, true,  true, 'Outro item de estoque.')
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  track_serial = excluded.track_serial,
  can_install = excluded.can_install,
  active = excluded.active,
  description = excluded.description;

create table if not exists public.stock_units (
  id uuid primary key default gen_random_uuid(),

  stock_code text not null unique,

  product_id uuid not null
    references public.stock_products(id)
    on delete restrict,

  manufacturer text,
  model text,
  serial_number text,

  condition text not null default 'new'
    check (
      condition in (
        'new',
        'used',
        'refurbished',
        'damaged'
      )
    ),

  status text not null default 'in_stock'
    check (
      status in (
        'in_stock',
        'reserved',
        'installed',
        'maintenance',
        'disposed'
      )
    ),

  specs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(specs) = 'object'),

  current_unit_id uuid
    references public.units(id)
    on delete restrict,

  current_environment_id uuid
    references public.environments(id)
    on delete restrict,

  installed_asset_id uuid
    references public.assets(id)
    on delete restrict,

  supplier_name text,
  purchase_reference text,
  acquired_at date,
  warranty_until date,

  cost_amount numeric(14,2)
    check (
      cost_amount is null
      or cost_amount >= 0
    ),

  notes text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_units_installed_state_ck
    check (
      (status = 'installed' and installed_asset_id is not null)
      or
      (status <> 'installed' and installed_asset_id is null)
    )
);

create table if not exists public.asset_components (
  id uuid primary key default gen_random_uuid(),

  asset_id uuid not null
    references public.assets(id)
    on delete restrict,

  stock_unit_id uuid not null
    references public.stock_units(id)
    on delete restrict,

  installed_at timestamptz not null default now(),

  installed_by uuid
    references auth.users(id)
    on delete set null,

  install_reason text not null,

  removed_at timestamptz,

  removed_by uuid
    references auth.users(id)
    on delete set null,

  removal_reason text,

  constraint asset_components_removal_ck
    check (
      removed_at is null
      or (
        removed_by is not null
        and nullif(btrim(removal_reason), '') is not null
      )
    )
);

create unique index if not exists asset_components_one_active_stock_uidx
  on public.asset_components(stock_unit_id)
  where removed_at is null;

create index if not exists asset_components_asset_time_idx
  on public.asset_components(asset_id, installed_at desc);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),

  stock_unit_id uuid not null
    references public.stock_units(id)
    on delete restrict,

  movement_type text not null,

  from_status text,
  to_status text,

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

  from_asset_id uuid
    references public.assets(id)
    on delete restrict,

  to_asset_id uuid
    references public.assets(id)
    on delete restrict,

  reason text not null,

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  occurred_at timestamptz not null default now()
);

create index if not exists stock_units_product_idx
  on public.stock_units(product_id);

create index if not exists stock_units_status_idx
  on public.stock_units(status);

create index if not exists stock_units_location_idx
  on public.stock_units(current_unit_id, current_environment_id);

create index if not exists stock_units_asset_idx
  on public.stock_units(installed_asset_id)
  where installed_asset_id is not null;

create index if not exists stock_movements_unit_time_idx
  on public.stock_movements(stock_unit_id, occurred_at desc);

drop trigger if exists stock_products_set_updated_at
  on public.stock_products;

create trigger stock_products_set_updated_at
before update on public.stock_products
for each row
execute function public.set_updated_at();

drop trigger if exists stock_units_set_updated_at
  on public.stock_units;

create trigger stock_units_set_updated_at
before update on public.stock_units
for each row
execute function public.set_updated_at();

create or replace function public.m04_prepare_stock_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_code text;
  v_environment_unit uuid;
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;

    new.status := 'in_stock';
    new.installed_asset_id := null;

    if nullif(btrim(coalesce(new.stock_code, '')), '') is null then
      select upper(sp.code)
      into v_product_code
      from public.stock_products sp
      where sp.id = new.product_id
        and sp.active = true;

      if v_product_code is null then
        raise exception 'Produto de estoque inexistente ou inativo.';
      end if;

      new.stock_code :=
        'WIS-CMP-' ||
        v_product_code ||
        '-' ||
        lpad(
          nextval('public.stock_unit_code_seq')::text,
          6,
          '0'
        );
    else
      new.stock_code := upper(btrim(new.stock_code));
    end if;
  end if;

  if new.status <> 'installed' then
    if new.current_environment_id is not null then
      select e.unit_id
      into v_environment_unit
      from public.environments e
      where e.id = new.current_environment_id
        and e.active = true;

      if v_environment_unit is null then
        raise exception 'Ambiente de estoque inexistente ou inativo.';
      end if;

      if new.current_unit_id is null then
        new.current_unit_id := v_environment_unit;
      elsif new.current_unit_id <> v_environment_unit then
        raise exception 'O ambiente de estoque nao pertence a unidade informada.';
      end if;
    end if;

    if new.current_unit_id is not null
       and not exists (
         select 1
         from public.units u
         where u.id = new.current_unit_id
           and u.active = true
       ) then
      raise exception 'Unidade de estoque inexistente ou inativa.';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function public.m04_prepare_stock_unit()
from public, anon, authenticated;

drop trigger if exists trg_m04_prepare_stock_unit
  on public.stock_units;

create trigger trg_m04_prepare_stock_unit
before insert or update of
  product_id,
  status,
  current_unit_id,
  current_environment_id,
  installed_asset_id
on public.stock_units
for each row
execute function public.m04_prepare_stock_unit();

create or replace function public.m04_stock_entry_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stock_movements (
    stock_unit_id,
    movement_type,
    from_status,
    to_status,
    from_unit_id,
    from_environment_id,
    to_unit_id,
    to_environment_id,
    from_asset_id,
    to_asset_id,
    reason,
    actor_user_id
  )
  values (
    new.id,
    'entry',
    null,
    new.status,
    null,
    null,
    new.current_unit_id,
    new.current_environment_id,
    null,
    null,
    'Entrada inicial no estoque.',
    coalesce(auth.uid(), new.created_by)
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
    coalesce(auth.uid(), new.created_by),
    'stock.entry',
    'stock_units',
    new.id,
    null,
    to_jsonb(new),
    jsonb_build_object(
      'module', 'stock',
      'source', 'database_trigger'
    )
  );

  return new;
end;
$$;

revoke all
on function public.m04_stock_entry_history()
from public, anon, authenticated;

drop trigger if exists trg_m04_stock_entry_history
  on public.stock_units;

create trigger trg_m04_stock_entry_history
after insert on public.stock_units
for each row
execute function public.m04_stock_entry_history();

create or replace function public.m04_validate_destination(
  p_unit_id uuid,
  p_environment_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_environment_unit uuid;
begin
  if p_environment_id is not null then
    select e.unit_id
    into v_environment_unit
    from public.environments e
    where e.id = p_environment_id
      and e.active = true;

    if v_environment_unit is null then
      raise exception 'Ambiente de destino inexistente ou inativo.';
    end if;

    if p_unit_id is null
       or p_unit_id <> v_environment_unit then
      raise exception 'O ambiente de destino nao pertence a unidade informada.';
    end if;
  end if;

  if p_unit_id is not null
     and not exists (
       select 1
       from public.units u
       where u.id = p_unit_id
         and u.active = true
     ) then
    raise exception 'Unidade de destino inexistente ou inativa.';
  end if;

  return p_unit_id;
end;
$$;

revoke all
on function public.m04_validate_destination(uuid, uuid)
from public, anon, authenticated;

create or replace function public.install_stock_unit(
  p_stock_unit_id uuid,
  p_asset_id uuid,
  p_reason text
)
returns public.stock_units
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reason text;
  v_stock public.stock_units%rowtype;
  v_asset public.assets%rowtype;
  v_product public.stock_products%rowtype;
  v_result public.stock_units%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('stock.move') then
    raise exception 'Sem permissao para instalar item de estoque.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception 'Justificativa da instalacao e obrigatoria.';
  end if;

  select *
  into v_stock
  from public.stock_units su
  where su.id = p_stock_unit_id
  for update;

  if not found then
    raise exception 'Item de estoque nao encontrado.';
  end if;

  if v_stock.status not in ('in_stock', 'reserved') then
    raise exception 'Item de estoque nao esta disponivel para instalacao.';
  end if;

  if v_stock.installed_asset_id is not null
     or exists (
       select 1
       from public.asset_components ac
       where ac.stock_unit_id = p_stock_unit_id
         and ac.removed_at is null
     ) then
    raise exception 'Item de estoque ja possui instalacao ativa.';
  end if;

  select *
  into v_product
  from public.stock_products sp
  where sp.id = v_stock.product_id;

  if not found or not v_product.active then
    raise exception 'Produto de estoque inexistente ou inativo.';
  end if;

  if not v_product.can_install then
    raise exception 'Este tipo de item nao pode ser instalado em ativo.';
  end if;

  select *
  into v_asset
  from public.assets a
  where a.id = p_asset_id
  for update;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  if v_asset.status in ('retired', 'disposed') then
    raise exception 'Ativo baixado ou descartado nao pode receber componente.';
  end if;

  update public.stock_units su
  set
    status = 'installed',
    installed_asset_id = p_asset_id,
    current_unit_id = v_asset.current_unit_id,
    current_environment_id = v_asset.current_environment_id
  where su.id = p_stock_unit_id
  returning *
  into v_result;

  insert into public.asset_components (
    asset_id,
    stock_unit_id,
    installed_by,
    install_reason
  )
  values (
    p_asset_id,
    p_stock_unit_id,
    v_user,
    v_reason
  );

  insert into public.stock_movements (
    stock_unit_id,
    movement_type,
    from_status,
    to_status,
    from_unit_id,
    from_environment_id,
    to_unit_id,
    to_environment_id,
    from_asset_id,
    to_asset_id,
    reason,
    actor_user_id
  )
  values (
    p_stock_unit_id,
    'install',
    v_stock.status,
    'installed',
    v_stock.current_unit_id,
    v_stock.current_environment_id,
    v_asset.current_unit_id,
    v_asset.current_environment_id,
    v_stock.installed_asset_id,
    p_asset_id,
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
    'stock.install',
    'stock_units',
    p_stock_unit_id,
    to_jsonb(v_stock),
    to_jsonb(v_result),
    jsonb_build_object(
      'asset_id', p_asset_id,
      'reason', v_reason,
      'module', 'stock'
    )
  );

  return v_result;
end;
$$;

revoke all
on function public.install_stock_unit(uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.install_stock_unit(uuid, uuid, text)
to authenticated;

create or replace function public.remove_stock_unit(
  p_stock_unit_id uuid,
  p_to_unit_id uuid,
  p_to_environment_id uuid,
  p_condition text,
  p_reason text
)
returns public.stock_units
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reason text;
  v_stock public.stock_units%rowtype;
  v_result public.stock_units%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('stock.move') then
    raise exception 'Sem permissao para retirar componente.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception 'Justificativa da retirada e obrigatoria.';
  end if;

  if p_condition not in (
    'new',
    'used',
    'refurbished',
    'damaged'
  ) then
    raise exception 'Condicao informada e invalida.';
  end if;

  perform public.m04_validate_destination(
    p_to_unit_id,
    p_to_environment_id
  );

  select *
  into v_stock
  from public.stock_units su
  where su.id = p_stock_unit_id
  for update;

  if not found then
    raise exception 'Item de estoque nao encontrado.';
  end if;

  if v_stock.status <> 'installed'
     or v_stock.installed_asset_id is null then
    raise exception 'Item de estoque nao esta instalado.';
  end if;

  update public.asset_components ac
  set
    removed_at = now(),
    removed_by = v_user,
    removal_reason = v_reason
  where ac.stock_unit_id = p_stock_unit_id
    and ac.removed_at is null;

  if not found then
    raise exception 'Historico de instalacao ativa nao encontrado.';
  end if;

  update public.stock_units su
  set
    status = 'in_stock',
    condition = p_condition,
    installed_asset_id = null,
    current_unit_id = p_to_unit_id,
    current_environment_id = p_to_environment_id
  where su.id = p_stock_unit_id
  returning *
  into v_result;

  insert into public.stock_movements (
    stock_unit_id,
    movement_type,
    from_status,
    to_status,
    from_unit_id,
    from_environment_id,
    to_unit_id,
    to_environment_id,
    from_asset_id,
    to_asset_id,
    reason,
    actor_user_id
  )
  values (
    p_stock_unit_id,
    'remove',
    v_stock.status,
    'in_stock',
    v_stock.current_unit_id,
    v_stock.current_environment_id,
    p_to_unit_id,
    p_to_environment_id,
    v_stock.installed_asset_id,
    null,
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
    'stock.remove',
    'stock_units',
    p_stock_unit_id,
    to_jsonb(v_stock),
    to_jsonb(v_result),
    jsonb_build_object(
      'reason', v_reason,
      'module', 'stock'
    )
  );

  return v_result;
end;
$$;

revoke all
on function public.remove_stock_unit(uuid, uuid, uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.remove_stock_unit(uuid, uuid, uuid, text, text)
to authenticated;

create or replace function public.move_stock_unit(
  p_stock_unit_id uuid,
  p_to_unit_id uuid,
  p_to_environment_id uuid,
  p_reason text
)
returns public.stock_units
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reason text;
  v_stock public.stock_units%rowtype;
  v_result public.stock_units%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('stock.move') then
    raise exception 'Sem permissao para movimentar estoque.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception 'Justificativa da movimentacao e obrigatoria.';
  end if;

  perform public.m04_validate_destination(
    p_to_unit_id,
    p_to_environment_id
  );

  select *
  into v_stock
  from public.stock_units su
  where su.id = p_stock_unit_id
  for update;

  if not found then
    raise exception 'Item de estoque nao encontrado.';
  end if;

  if v_stock.status = 'installed'
     or v_stock.installed_asset_id is not null then
    raise exception 'Item instalado deve ser retirado do ativo antes da transferencia.';
  end if;

  update public.stock_units su
  set
    current_unit_id = p_to_unit_id,
    current_environment_id = p_to_environment_id
  where su.id = p_stock_unit_id
  returning *
  into v_result;

  insert into public.stock_movements (
    stock_unit_id,
    movement_type,
    from_status,
    to_status,
    from_unit_id,
    from_environment_id,
    to_unit_id,
    to_environment_id,
    from_asset_id,
    to_asset_id,
    reason,
    actor_user_id
  )
  values (
    p_stock_unit_id,
    'move',
    v_stock.status,
    v_stock.status,
    v_stock.current_unit_id,
    v_stock.current_environment_id,
    p_to_unit_id,
    p_to_environment_id,
    null,
    null,
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
    'stock.move',
    'stock_units',
    p_stock_unit_id,
    to_jsonb(v_stock),
    to_jsonb(v_result),
    jsonb_build_object(
      'reason', v_reason,
      'module', 'stock'
    )
  );

  return v_result;
end;
$$;

revoke all
on function public.move_stock_unit(uuid, uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.move_stock_unit(uuid, uuid, uuid, text)
to authenticated;

create or replace function public.change_stock_unit_status(
  p_stock_unit_id uuid,
  p_status text,
  p_reason text
)
returns public.stock_units
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reason text;
  v_stock public.stock_units%rowtype;
  v_result public.stock_units%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('stock.adjust') then
    raise exception 'Sem permissao para alterar status do estoque.';
  end if;

  if p_status not in (
    'in_stock',
    'reserved',
    'maintenance',
    'disposed'
  ) then
    raise exception 'Status de estoque invalido.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception 'Justificativa da alteracao de status e obrigatoria.';
  end if;

  select *
  into v_stock
  from public.stock_units su
  where su.id = p_stock_unit_id
  for update;

  if not found then
    raise exception 'Item de estoque nao encontrado.';
  end if;

  if v_stock.status = 'installed'
     or v_stock.installed_asset_id is not null then
    raise exception 'Item instalado deve ser retirado do ativo antes de alterar o status.';
  end if;

  update public.stock_units su
  set status = p_status
  where su.id = p_stock_unit_id
  returning *
  into v_result;

  insert into public.stock_movements (
    stock_unit_id,
    movement_type,
    from_status,
    to_status,
    from_unit_id,
    from_environment_id,
    to_unit_id,
    to_environment_id,
    from_asset_id,
    to_asset_id,
    reason,
    actor_user_id
  )
  values (
    p_stock_unit_id,
    'status',
    v_stock.status,
    p_status,
    v_stock.current_unit_id,
    v_stock.current_environment_id,
    v_stock.current_unit_id,
    v_stock.current_environment_id,
    null,
    null,
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
    'stock.status',
    'stock_units',
    p_stock_unit_id,
    to_jsonb(v_stock),
    to_jsonb(v_result),
    jsonb_build_object(
      'reason', v_reason,
      'module', 'stock'
    )
  );

  return v_result;
end;
$$;

revoke all
on function public.change_stock_unit_status(uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.change_stock_unit_status(uuid, text, text)
to authenticated;

alter table public.stock_products
  enable row level security;

alter table public.stock_units
  enable row level security;

alter table public.asset_components
  enable row level security;

alter table public.stock_movements
  enable row level security;

drop policy if exists stock_products_select
  on public.stock_products;

create policy stock_products_select
on public.stock_products
for select
to authenticated
using (
  public.has_permission('stock.view')
  or public.has_permission('stock.adjust')
);

drop policy if exists stock_units_select
  on public.stock_units;

create policy stock_units_select
on public.stock_units
for select
to authenticated
using (
  public.has_permission('stock.view')
);

drop policy if exists stock_units_insert
  on public.stock_units;

create policy stock_units_insert
on public.stock_units
for insert
to authenticated
with check (
  public.has_permission('stock.adjust')
);

drop policy if exists stock_units_update
  on public.stock_units;

create policy stock_units_update
on public.stock_units
for update
to authenticated
using (
  public.has_permission('stock.adjust')
)
with check (
  public.has_permission('stock.adjust')
);

drop policy if exists asset_components_select
  on public.asset_components;

create policy asset_components_select
on public.asset_components
for select
to authenticated
using (
  public.has_permission('assets.view')
  or public.has_permission('stock.view')
);

drop policy if exists stock_movements_select
  on public.stock_movements;

create policy stock_movements_select
on public.stock_movements
for select
to authenticated
using (
  public.has_permission('stock.view')
);

revoke all
on table
  public.stock_products,
  public.stock_units,
  public.asset_components,
  public.stock_movements
from anon;

revoke all
on table
  public.stock_products,
  public.stock_units,
  public.asset_components,
  public.stock_movements
from authenticated;

grant select
on table public.stock_products
to authenticated;

grant select, insert
on table public.stock_units
to authenticated;

grant update (
  product_id,
  manufacturer,
  model,
  serial_number,
  condition,
  supplier_name,
  purchase_reference,
  acquired_at,
  warranty_until,
  cost_amount,
  notes
)
on public.stock_units
to authenticated;

grant select
on table
  public.asset_components,
  public.stock_movements
to authenticated;

grant usage, select
on sequence public.stock_unit_code_seq
to authenticated;

commit;
