-- ============================================================
-- INVENTARIO TI
-- M12 - OPERACAO DE CAMPO, VINCULOS E IDENTIFICACAO CURTA
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. PRE-CADASTRO EXPRESS
-- ------------------------------------------------------------

alter table public.assets
  add column if not exists registration_state text not null default 'complete';

alter table public.assets
  add column if not exists entry_origin text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_registration_state_m12_ck'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_registration_state_m12_ck
      check (registration_state in ('complete', 'express_pending'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'assets_entry_origin_m12_ck'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_entry_origin_m12_ck
      check (
        entry_origin is null
        or entry_origin in ('purchase', 'donation', 'used', 'transfer', 'other')
      );
  end if;
end;
$$;

create index if not exists assets_registration_state_m12_idx
  on public.assets(registration_state, created_at desc);

create or replace function public.create_express_asset(
  p_asset_type_id uuid,
  p_serial_number text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_entry_origin text default 'purchase',
  p_unit_id uuid default null,
  p_environment_id uuid default null,
  p_notes text default null
)
returns public.assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_environment_unit uuid;
  v_asset public.assets%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.create') then
    raise exception 'Sem permissao para criar ativos.';
  end if;

  if p_entry_origin not in ('purchase', 'donation', 'used', 'transfer', 'other') then
    raise exception 'Origem de entrada invalida.';
  end if;

  if not exists (
    select 1
    from public.asset_types t
    where t.id = p_asset_type_id
      and t.active = true
  ) then
    raise exception 'Tipo de ativo inexistente ou inativo.';
  end if;

  if p_unit_id is not null and not exists (
    select 1
    from public.units u
    where u.id = p_unit_id
      and u.active = true
  ) then
    raise exception 'Unidade inexistente ou inativa.';
  end if;

  if p_environment_id is not null then
    select e.unit_id
      into v_environment_unit
    from public.environments e
    where e.id = p_environment_id
      and e.active = true;

    if v_environment_unit is null then
      raise exception 'Ambiente inexistente ou inativo.';
    end if;

    if p_unit_id is null or v_environment_unit <> p_unit_id then
      raise exception 'O ambiente nao pertence a unidade informada.';
    end if;
  end if;

  insert into public.assets (
    asset_type_id,
    manufacturer,
    model,
    serial_number,
    status,
    current_unit_id,
    current_environment_id,
    notes,
    registration_state,
    entry_origin
  )
  values (
    p_asset_type_id,
    nullif(btrim(coalesce(p_manufacturer, '')), ''),
    nullif(btrim(coalesce(p_model, '')), ''),
    nullif(btrim(coalesce(p_serial_number, '')), ''),
    'stock',
    p_unit_id,
    p_environment_id,
    nullif(btrim(coalesce(p_notes, '')), ''),
    'express_pending',
    p_entry_origin
  )
  returning * into v_asset;

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
    'asset.express_create',
    'assets',
    v_asset.id,
    null,
    to_jsonb(v_asset),
    jsonb_build_object('entry_origin', p_entry_origin)
  );

  return v_asset;
end;
$$;

revoke all
on function public.create_express_asset(uuid, text, text, text, text, uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.create_express_asset(uuid, text, text, text, text, uuid, uuid, text)
to authenticated;

create or replace function public.complete_express_asset(
  p_asset_id uuid
)
returns public.assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_before public.assets%rowtype;
  v_after public.assets%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para concluir cadastro.';
  end if;

  select *
    into v_before
  from public.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  update public.assets
  set registration_state = 'complete'
  where id = p_asset_id
  returning * into v_after;

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
    'asset.express_complete',
    'assets',
    p_asset_id,
    to_jsonb(v_before),
    to_jsonb(v_after),
    jsonb_build_object('source', 'm12')
  );

  return v_after;
end;
$$;

revoke all
on function public.complete_express_asset(uuid)
from public, anon, authenticated;

grant execute
on function public.complete_express_asset(uuid)
to authenticated;

-- ------------------------------------------------------------
-- 2. CODIGO CURTO PARA UNIDADES FISICAS DE ESTOQUE
-- ------------------------------------------------------------

alter table public.stock_units
  add column if not exists short_code text;

create or replace function public.m12_generate_short_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';

    for i in 1..6 loop
      candidate :=
        candidate ||
        substr(
          alphabet,
          1 + floor(random() * length(alphabet))::integer,
          1
        );
    end loop;

    exit when not exists (
      select 1
      from public.stock_units su
      where su.short_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

revoke all
on function public.m12_generate_short_code()
from public, anon, authenticated;

create or replace function public.m12_stock_short_code_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.short_code is null or btrim(new.short_code) = '' then
    new.short_code := public.m12_generate_short_code();
  else
    new.short_code := upper(btrim(new.short_code));
  end if;

  return new;
end;
$$;

revoke all
on function public.m12_stock_short_code_trigger()
from public, anon, authenticated;

drop trigger if exists stock_units_m12_short_code
  on public.stock_units;

create trigger stock_units_m12_short_code
before insert or update of short_code
on public.stock_units
for each row
execute function public.m12_stock_short_code_trigger();

do $$
declare
  row_record record;
begin
  for row_record in
    select id
    from public.stock_units
    where short_code is null or btrim(short_code) = ''
  loop
    update public.stock_units
    set short_code = public.m12_generate_short_code()
    where id = row_record.id;
  end loop;
end;
$$;

alter table public.stock_units
  alter column short_code set not null;

create unique index if not exists stock_units_short_code_m12_uidx
  on public.stock_units(short_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_units_short_code_m12_ck'
      and conrelid = 'public.stock_units'::regclass
  ) then
    alter table public.stock_units
      add constraint stock_units_short_code_m12_ck
      check (short_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$');
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 3. VINCULO GENERICO DE STOCK UNIT -> ATIVO
-- Nao depende de stock_products.can_install.
-- ------------------------------------------------------------

create table if not exists public.asset_stock_bindings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null
    references public.assets(id)
    on delete restrict,
  stock_unit_id uuid not null
    references public.stock_units(id)
    on delete restrict,
  relation_type text not null default 'accessory'
    check (
      relation_type in (
        'component',
        'accessory',
        'cable',
        'peripheral',
        'consumable',
        'other'
      )
    ),
  linked_at timestamptz not null default now(),
  linked_by uuid not null
    references auth.users(id)
    on delete restrict,
  link_reason text not null,
  unlinked_at timestamptz,
  unlinked_by uuid
    references auth.users(id)
    on delete set null,
  unlink_reason text
);

create unique index if not exists asset_stock_bindings_one_active_m12_uidx
  on public.asset_stock_bindings(stock_unit_id)
  where unlinked_at is null;

create index if not exists asset_stock_bindings_asset_m12_idx
  on public.asset_stock_bindings(asset_id, linked_at desc);

-- ------------------------------------------------------------
-- 4. VINCULO ATIVO -> ATIVO
-- ------------------------------------------------------------

create table if not exists public.asset_links (
  id uuid primary key default gen_random_uuid(),
  parent_asset_id uuid not null
    references public.assets(id)
    on delete restrict,
  child_asset_id uuid not null
    references public.assets(id)
    on delete restrict,
  relation_type text not null default 'peripheral'
    check (
      relation_type in (
        'peripheral',
        'accessory',
        'part_of',
        'paired',
        'other'
      )
    ),
  linked_at timestamptz not null default now(),
  linked_by uuid not null
    references auth.users(id)
    on delete restrict,
  link_reason text not null,
  removed_at timestamptz,
  removed_by uuid
    references auth.users(id)
    on delete set null,
  removal_reason text,
  constraint asset_links_no_self_m12_ck
    check (parent_asset_id <> child_asset_id)
);

create unique index if not exists asset_links_child_active_m12_uidx
  on public.asset_links(child_asset_id)
  where removed_at is null;

create index if not exists asset_links_parent_m12_idx
  on public.asset_links(parent_asset_id, linked_at desc);

-- ------------------------------------------------------------
-- 5. RLS / GRANTS
-- ------------------------------------------------------------

alter table public.asset_stock_bindings enable row level security;
alter table public.asset_links enable row level security;

drop policy if exists asset_stock_bindings_select_m12
  on public.asset_stock_bindings;

create policy asset_stock_bindings_select_m12
on public.asset_stock_bindings
for select
to authenticated
using (
  public.has_permission('assets.view')
  or public.has_permission('stock.view')
);

drop policy if exists asset_links_select_m12
  on public.asset_links;

create policy asset_links_select_m12
on public.asset_links
for select
to authenticated
using (public.has_permission('assets.view'));

revoke all
on table
  public.asset_stock_bindings,
  public.asset_links
from anon, authenticated;

grant select
on table
  public.asset_stock_bindings,
  public.asset_links
to authenticated;

-- ------------------------------------------------------------
-- 6. RESOLVEDOR UNIVERSAL
-- ------------------------------------------------------------

create or replace function public.resolve_inventory_code(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text;
  v_can_assets boolean := public.has_permission('assets.view');
  v_can_stock boolean := public.has_permission('stock.view');
  v_asset public.assets%rowtype;
  v_stock public.stock_units%rowtype;
  v_product public.stock_products%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessao invalida.';
  end if;

  if not (v_can_assets or v_can_stock) then
    raise exception 'Sem permissao para identificar itens.';
  end if;

  v_value := upper(btrim(coalesce(p_code, '')));

  if v_value = '' then
    raise exception 'Codigo nao informado.';
  end if;

  if position('/ATIVO/' in v_value) > 0 then
    v_value := split_part(v_value, '/ATIVO/', 2);
    v_value := split_part(v_value, '?', 1);
    v_value := split_part(v_value, '#', 1);
    v_value := trim(both '/' from v_value);
  elsif position('/IDENTIFICAR/' in v_value) > 0 then
    v_value := split_part(v_value, '/IDENTIFICAR/', 2);
    v_value := split_part(v_value, '?', 1);
    v_value := split_part(v_value, '#', 1);
    v_value := trim(both '/' from v_value);
  end if;

  if v_can_assets then
    select *
      into v_asset
    from public.assets a
    where upper(a.asset_code) = v_value
    limit 1;

    if found then
      return jsonb_build_object(
        'kind', 'asset',
        'id', v_asset.id,
        'code', v_asset.asset_code,
        'short_code', null,
        'status', v_asset.status,
        'display_name',
          concat_ws(
            ' ',
            nullif(v_asset.manufacturer, ''),
            nullif(v_asset.model, '')
          ),
        'registration_state', v_asset.registration_state
      );
    end if;
  end if;

  if v_can_stock then
    select su.*
      into v_stock
    from public.stock_units su
    where upper(su.short_code) = v_value
       or upper(su.stock_code) = v_value
    order by
      case when upper(su.short_code) = v_value then 0 else 1 end
    limit 1;

    if found then
      select *
        into v_product
      from public.stock_products sp
      where sp.id = v_stock.product_id;

      return jsonb_build_object(
        'kind', 'stock_unit',
        'id', v_stock.id,
        'code', v_stock.stock_code,
        'short_code', v_stock.short_code,
        'status', v_stock.status,
        'display_name', coalesce(v_product.name, 'Item de estoque'),
        'installed_asset_id', v_stock.installed_asset_id
      );
    end if;
  end if;

  return jsonb_build_object(
    'kind', 'unknown',
    'id', null,
    'code', v_value,
    'short_code', null,
    'status', null,
    'display_name', null
  );
end;
$$;

revoke all
on function public.resolve_inventory_code(text)
from public, anon, authenticated;

grant execute
on function public.resolve_inventory_code(text)
to authenticated;

-- ------------------------------------------------------------
-- 7. STOCK UNIT -> ATIVO, SEM REGRA can_install
-- ------------------------------------------------------------

create or replace function public.link_stock_unit_to_asset(
  p_stock_unit_id uuid,
  p_asset_id uuid,
  p_relation_type text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_stock public.stock_units%rowtype;
  v_generic public.asset_stock_bindings%rowtype;
  v_classic public.asset_components%rowtype;
  v_new public.asset_stock_bindings%rowtype;
  v_previous_asset_id uuid;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not (
    public.has_permission('assets.update')
    or public.has_permission('stock.move')
    or public.has_permission('stock.adjust')
  ) then
    raise exception 'Sem permissao para vincular itens.';
  end if;

  if p_relation_type not in (
    'component', 'accessory', 'cable', 'peripheral', 'consumable', 'other'
  ) then
    raise exception 'Tipo de vinculo invalido.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Justificativa obrigatoria.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = p_asset_id
  for update;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  if v_asset.status in ('retired', 'disposed') then
    raise exception 'Ativo baixado ou descartado nao aceita novos vinculos.';
  end if;

  select *
    into v_stock
  from public.stock_units
  where id = p_stock_unit_id
  for update;

  if not found then
    raise exception 'Item de estoque nao encontrado.';
  end if;

  if v_stock.status in ('disposed', 'maintenance') then
    raise exception 'Item descartado ou em manutencao nao pode ser vinculado.';
  end if;

  v_previous_asset_id := v_stock.installed_asset_id;

  select *
    into v_generic
  from public.asset_stock_bindings
  where stock_unit_id = p_stock_unit_id
    and unlinked_at is null
  for update;

  if found then
    if v_generic.asset_id = p_asset_id then
      return jsonb_build_object(
        'binding_id', v_generic.id,
        'asset_id', v_generic.asset_id,
        'stock_unit_id', v_generic.stock_unit_id,
        'relation_type', v_generic.relation_type,
        'transferred', false,
        'already_linked', true
      );
    end if;

    update public.asset_stock_bindings
    set
      unlinked_at = now(),
      unlinked_by = v_user,
      unlink_reason = 'Transferencia de vinculo: ' || btrim(p_reason)
    where id = v_generic.id;
  end if;

  select *
    into v_classic
  from public.asset_components
  where stock_unit_id = p_stock_unit_id
    and removed_at is null
  for update;

  if found then
    if v_classic.asset_id = p_asset_id then
      return jsonb_build_object(
        'binding_id', v_classic.id,
        'asset_id', v_classic.asset_id,
        'stock_unit_id', v_classic.stock_unit_id,
        'relation_type', 'component',
        'transferred', false,
        'already_linked', true,
        'source', 'classic'
      );
    end if;

    update public.asset_components
    set
      removed_at = now(),
      removed_by = v_user,
      removal_reason = 'Transferencia para vinculo M12: ' || btrim(p_reason)
    where id = v_classic.id;
  end if;

  update public.stock_units
  set
    status = 'installed',
    installed_asset_id = p_asset_id,
    current_unit_id = v_asset.current_unit_id,
    current_environment_id = v_asset.current_environment_id
  where id = p_stock_unit_id;

  insert into public.asset_stock_bindings (
    asset_id,
    stock_unit_id,
    relation_type,
    linked_by,
    link_reason
  )
  values (
    p_asset_id,
    p_stock_unit_id,
    p_relation_type,
    v_user,
    btrim(p_reason)
  )
  returning * into v_new;

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
    'asset.binding.link',
    'asset_stock_bindings',
    v_new.id,
    jsonb_build_object(
      'previous_installed_asset_id', v_previous_asset_id,
      'previous_status', v_stock.status
    ),
    to_jsonb(v_new),
    jsonb_build_object(
      'asset_id', p_asset_id,
      'stock_unit_id', p_stock_unit_id,
      'short_code', v_stock.short_code,
      'source', 'm12_generic_binding'
    )
  );

  return jsonb_build_object(
    'binding_id', v_new.id,
    'asset_id', p_asset_id,
    'stock_unit_id', p_stock_unit_id,
    'relation_type', p_relation_type,
    'transferred',
      (
        v_previous_asset_id is not null
        and v_previous_asset_id <> p_asset_id
      ),
    'already_linked', false
  );
end;
$$;

revoke all
on function public.link_stock_unit_to_asset(uuid, uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.link_stock_unit_to_asset(uuid, uuid, text, text)
to authenticated;

create or replace function public.unlink_stock_unit_from_asset(
  p_stock_unit_id uuid,
  p_asset_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_stock public.stock_units%rowtype;
  v_generic public.asset_stock_bindings%rowtype;
  v_classic public.asset_components%rowtype;
  v_found boolean := false;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not (
    public.has_permission('assets.update')
    or public.has_permission('stock.move')
    or public.has_permission('stock.adjust')
  ) then
    raise exception 'Sem permissao para desvincular itens.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Justificativa obrigatoria.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = p_asset_id;

  if not found then
    raise exception 'Ativo nao encontrado.';
  end if;

  select *
    into v_stock
  from public.stock_units
  where id = p_stock_unit_id
  for update;

  if not found then
    raise exception 'Item de estoque nao encontrado.';
  end if;

  select *
    into v_generic
  from public.asset_stock_bindings
  where stock_unit_id = p_stock_unit_id
    and asset_id = p_asset_id
    and unlinked_at is null
  for update;

  if found then
    update public.asset_stock_bindings
    set
      unlinked_at = now(),
      unlinked_by = v_user,
      unlink_reason = btrim(p_reason)
    where id = v_generic.id;

    v_found := true;
  end if;

  select *
    into v_classic
  from public.asset_components
  where stock_unit_id = p_stock_unit_id
    and asset_id = p_asset_id
    and removed_at is null
  for update;

  if found then
    update public.asset_components
    set
      removed_at = now(),
      removed_by = v_user,
      removal_reason = btrim(p_reason)
    where id = v_classic.id;

    v_found := true;
  end if;

  if not v_found then
    raise exception 'Nao existe vinculo ativo deste item com o ativo informado.';
  end if;

  update public.stock_units
  set
    status = 'in_stock',
    installed_asset_id = null,
    current_unit_id = v_asset.current_unit_id,
    current_environment_id = v_asset.current_environment_id
  where id = p_stock_unit_id;

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
    'asset.binding.unlink',
    'stock_units',
    p_stock_unit_id,
    to_jsonb(v_stock),
    jsonb_build_object(
      'status', 'in_stock',
      'installed_asset_id', null,
      'current_unit_id', v_asset.current_unit_id,
      'current_environment_id', v_asset.current_environment_id
    ),
    jsonb_build_object(
      'asset_id', p_asset_id,
      'reason', btrim(p_reason),
      'short_code', v_stock.short_code,
      'source', 'm12_generic_binding'
    )
  );

  return jsonb_build_object(
    'asset_id', p_asset_id,
    'stock_unit_id', p_stock_unit_id,
    'status', 'in_stock'
  );
end;
$$;

revoke all
on function public.unlink_stock_unit_from_asset(uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.unlink_stock_unit_from_asset(uuid, uuid, text)
to authenticated;

-- ------------------------------------------------------------
-- 8. ATIVO -> ATIVO
-- ------------------------------------------------------------

create or replace function public.link_asset_to_asset(
  p_parent_asset_id uuid,
  p_child_asset_id uuid,
  p_relation_type text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_parent public.assets%rowtype;
  v_child public.assets%rowtype;
  v_existing public.asset_links%rowtype;
  v_new public.asset_links%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para vincular ativos.';
  end if;

  if p_parent_asset_id = p_child_asset_id then
    raise exception 'Um ativo nao pode ser vinculado a ele mesmo.';
  end if;

  if p_relation_type not in (
    'peripheral', 'accessory', 'part_of', 'paired', 'other'
  ) then
    raise exception 'Tipo de vinculo invalido.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Justificativa obrigatoria.';
  end if;

  select *
    into v_parent
  from public.assets
  where id = p_parent_asset_id
  for update;

  if not found then
    raise exception 'Ativo principal nao encontrado.';
  end if;

  select *
    into v_child
  from public.assets
  where id = p_child_asset_id
  for update;

  if not found then
    raise exception 'Ativo vinculado nao encontrado.';
  end if;

  if v_parent.status in ('retired', 'disposed')
     or v_child.status = 'disposed' then
    raise exception 'Ativo baixado/descartado nao aceita este vinculo.';
  end if;

  select *
    into v_existing
  from public.asset_links
  where child_asset_id = p_child_asset_id
    and removed_at is null
  for update;

  if found then
    if v_existing.parent_asset_id = p_parent_asset_id then
      return jsonb_build_object(
        'link_id', v_existing.id,
        'parent_asset_id', p_parent_asset_id,
        'child_asset_id', p_child_asset_id,
        'relation_type', v_existing.relation_type,
        'already_linked', true
      );
    end if;

    update public.asset_links
    set
      removed_at = now(),
      removed_by = v_user,
      removal_reason = 'Transferencia de vinculo: ' || btrim(p_reason)
    where id = v_existing.id;
  end if;

  insert into public.asset_links (
    parent_asset_id,
    child_asset_id,
    relation_type,
    linked_by,
    link_reason
  )
  values (
    p_parent_asset_id,
    p_child_asset_id,
    p_relation_type,
    v_user,
    btrim(p_reason)
  )
  returning * into v_new;

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
    'asset.asset_link.link',
    'asset_links',
    v_new.id,
    case when v_existing.id is null then null else to_jsonb(v_existing) end,
    to_jsonb(v_new),
    jsonb_build_object(
      'parent_asset_id', p_parent_asset_id,
      'child_asset_id', p_child_asset_id,
      'source', 'm12'
    )
  );

  return jsonb_build_object(
    'link_id', v_new.id,
    'parent_asset_id', p_parent_asset_id,
    'child_asset_id', p_child_asset_id,
    'relation_type', p_relation_type,
    'already_linked', false
  );
end;
$$;

revoke all
on function public.link_asset_to_asset(uuid, uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.link_asset_to_asset(uuid, uuid, text, text)
to authenticated;

create or replace function public.unlink_asset_from_asset(
  p_parent_asset_id uuid,
  p_child_asset_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_link public.asset_links%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para desvincular ativos.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Justificativa obrigatoria.';
  end if;

  select *
    into v_link
  from public.asset_links
  where parent_asset_id = p_parent_asset_id
    and child_asset_id = p_child_asset_id
    and removed_at is null
  for update;

  if not found then
    raise exception 'Vinculo ativo nao encontrado.';
  end if;

  update public.asset_links
  set
    removed_at = now(),
    removed_by = v_user,
    removal_reason = btrim(p_reason)
  where id = v_link.id;

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
    'asset.asset_link.unlink',
    'asset_links',
    v_link.id,
    to_jsonb(v_link),
    jsonb_build_object(
      'removed_at', now(),
      'removal_reason', btrim(p_reason)
    ),
    jsonb_build_object(
      'parent_asset_id', p_parent_asset_id,
      'child_asset_id', p_child_asset_id,
      'source', 'm12'
    )
  );

  return jsonb_build_object(
    'link_id', v_link.id,
    'parent_asset_id', p_parent_asset_id,
    'child_asset_id', p_child_asset_id,
    'removed', true
  );
end;
$$;

revoke all
on function public.unlink_asset_from_asset(uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.unlink_asset_from_asset(uuid, uuid, text)
to authenticated;


-- ------------------------------------------------------------
-- 9. INTEGRIDADE DE CICLO DE VIDA E LOCALIZACAO
-- ------------------------------------------------------------

create or replace function public.m12_guard_asset_disposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'disposed'
     and old.status is distinct from new.status then
    if exists (
      select 1
      from public.asset_stock_bindings b
      where b.asset_id = new.id
        and b.unlinked_at is null
    ) then
      raise exception 'Desvincule componentes e acessorios M12 antes do descarte.';
    end if;

    if exists (
      select 1
      from public.asset_links l
      where (l.parent_asset_id = new.id or l.child_asset_id = new.id)
        and l.removed_at is null
    ) then
      raise exception 'Desvincule os ativos relacionados antes do descarte.';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function public.m12_guard_asset_disposal()
from public, anon, authenticated;

drop trigger if exists assets_m12_guard_disposal
  on public.assets;

create trigger assets_m12_guard_disposal
before update of status
on public.assets
for each row
execute function public.m12_guard_asset_disposal();

create or replace function public.m12_sync_bound_stock_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.current_unit_id is distinct from new.current_unit_id
     or old.current_environment_id is distinct from new.current_environment_id then
    update public.stock_units su
    set
      current_unit_id = new.current_unit_id,
      current_environment_id = new.current_environment_id
    where exists (
      select 1
      from public.asset_stock_bindings b
      where b.asset_id = new.id
        and b.stock_unit_id = su.id
        and b.unlinked_at is null
    );
  end if;

  return new;
end;
$$;

revoke all
on function public.m12_sync_bound_stock_location()
from public, anon, authenticated;

drop trigger if exists assets_m12_sync_bound_stock_location
  on public.assets;

create trigger assets_m12_sync_bound_stock_location
after update of current_unit_id, current_environment_id
on public.assets
for each row
execute function public.m12_sync_bound_stock_location();

commit;
