-- =====================================================================
-- INVENTARIO TI - M16B
-- SUPORTE INTEGRADO, CODIGOS NEUTROS, CONTATOS, NOTIFICACOES,
-- DESINSTALACAO REMOTA SEGURA E PREPARACAO DE ACESSO REMOTO
-- Executar o MESMO SQL nos 2 projetos Supabase.
-- Idempotente. Sem secrets.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Aliases permanentes para codigos antigos
-- ---------------------------------------------------------------------

create table if not exists public.asset_code_aliases (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null
    references public.assets(id)
    on delete cascade,
  alias_code text not null,
  source text not null default 'legacy',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null
    references auth.users(id)
    on delete set null
);

create unique index if not exists asset_code_aliases_code_uidx
  on public.asset_code_aliases(upper(alias_code));

create index if not exists asset_code_aliases_asset_idx
  on public.asset_code_aliases(asset_id);

create table if not exists public.stock_code_aliases (
  id uuid primary key default gen_random_uuid(),
  stock_unit_id uuid not null
    references public.stock_units(id)
    on delete cascade,
  alias_code text not null,
  source text not null default 'legacy',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null
    references auth.users(id)
    on delete set null
);

create unique index if not exists stock_code_aliases_code_uidx
  on public.stock_code_aliases(upper(alias_code));

create index if not exists stock_code_aliases_stock_idx
  on public.stock_code_aliases(stock_unit_id);

do $$
begin
  if exists (
    select 1
    from public.assets old_asset
    join public.assets new_asset
      on upper(new_asset.asset_code) =
         upper(regexp_replace(old_asset.asset_code, '^WIS-', '', 'i'))
     and new_asset.id <> old_asset.id
    where old_asset.asset_code ~* '^WIS-'
  ) then
    raise exception
      'Migracao de codigos interrompida: existe colisao entre codigo legado e codigo neutro de patrimonio.';
  end if;

  if exists (
    select 1
    from public.stock_units old_stock
    join public.stock_units new_stock
      on upper(new_stock.stock_code) =
         upper(regexp_replace(old_stock.stock_code, '^WIS-', '', 'i'))
     and new_stock.id <> old_stock.id
    where old_stock.stock_code ~* '^WIS-'
  ) then
    raise exception
      'Migracao de codigos interrompida: existe colisao entre codigo legado e codigo neutro de estoque.';
  end if;
end;
$$;

insert into public.asset_code_aliases(
  asset_id,
  alias_code,
  source,
  created_by
)
select
  a.id,
  upper(btrim(a.asset_code)),
  'legacy_code_m16b',
  auth.uid()
from public.assets a
where a.asset_code ~* '^WIS-'
on conflict do nothing;

insert into public.stock_code_aliases(
  stock_unit_id,
  alias_code,
  source,
  created_by
)
select
  su.id,
  upper(btrim(su.stock_code)),
  'legacy_code_m16b',
  auth.uid()
from public.stock_units su
where su.stock_code ~* '^WIS-'
on conflict do nothing;

update public.assets
set asset_code =
  upper(
    regexp_replace(
      btrim(asset_code),
      '^WIS-',
      '',
      'i'
    )
  )
where asset_code ~* '^WIS-';

update public.stock_units
set stock_code =
  upper(
    regexp_replace(
      btrim(stock_code),
      '^WIS-',
      '',
      'i'
    )
  )
where stock_code ~* '^WIS-';

alter table public.asset_code_aliases
  enable row level security;

alter table public.stock_code_aliases
  enable row level security;

drop policy if exists m16b_asset_code_aliases_select
  on public.asset_code_aliases;

create policy m16b_asset_code_aliases_select
on public.asset_code_aliases
for select
to authenticated
using (
  public.has_permission('assets.view')
);

drop policy if exists m16b_stock_code_aliases_select
  on public.stock_code_aliases;

create policy m16b_stock_code_aliases_select
on public.stock_code_aliases
for select
to authenticated
using (
  public.has_permission('stock.view')
);

revoke all
on public.asset_code_aliases,
   public.stock_code_aliases
from anon, authenticated;

grant select
on public.asset_code_aliases
to authenticated;

grant select
on public.stock_code_aliases
to authenticated;

-- ---------------------------------------------------------------------
-- 2. Novos codigos neutros
-- ---------------------------------------------------------------------

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
        raise exception
          'Tipo de ativo inexistente ou inativo.';
      end if;

      new.asset_code :=
        v_type_code ||
        '-' ||
        lpad(
          nextval('public.asset_code_seq')::text,
          6,
          '0'
        );
    else
      new.asset_code :=
        upper(btrim(new.asset_code));
    end if;
  end if;

  if new.current_environment_id is not null then
    select e.unit_id
    into v_environment_unit
    from public.environments e
    where e.id = new.current_environment_id
      and e.active = true;

    if v_environment_unit is null then
      raise exception
        'Ambiente inexistente ou inativo.';
    end if;

    if new.current_unit_id is null then
      new.current_unit_id :=
        v_environment_unit;
    elsif new.current_unit_id <>
          v_environment_unit then
      raise exception
        'O ambiente nao pertence a unidade informada.';
    end if;
  end if;

  if new.current_unit_id is not null
     and not exists (
       select 1
       from public.units u
       where u.id = new.current_unit_id
         and u.active = true
     ) then
    raise exception
      'Unidade inexistente ou inativa.';
  end if;

  return new;
end;
$$;

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
        raise exception
          'Produto de estoque inexistente ou inativo.';
      end if;

      new.stock_code :=
        'CMP-' ||
        v_product_code ||
        '-' ||
        lpad(
          nextval('public.stock_unit_code_seq')::text,
          6,
          '0'
        );
    else
      new.stock_code :=
        upper(btrim(new.stock_code));
    end if;
  end if;

  if new.status <> 'installed' then
    if new.current_environment_id is not null then
      select e.unit_id
      into v_environment_unit
      from public.environments e
      where e.id =
        new.current_environment_id
        and e.active = true;

      if v_environment_unit is null then
        raise exception
          'Ambiente de estoque inexistente ou inativo.';
      end if;

      if new.current_unit_id is null then
        new.current_unit_id :=
          v_environment_unit;
      elsif new.current_unit_id <>
            v_environment_unit then
        raise exception
          'O ambiente de estoque nao pertence a unidade informada.';
      end if;
    end if;

    if new.current_unit_id is not null
       and not exists (
         select 1
         from public.units u
         where u.id =
           new.current_unit_id
           and u.active = true
       ) then
      raise exception
        'Unidade de estoque inexistente ou inativa.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Resolucao de patrimonio por codigo atual, alias ou identificador
-- ---------------------------------------------------------------------

create or replace function public.resolve_asset_by_code(
  p_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text :=
    upper(
      btrim(
        coalesce(
          p_code,
          ''
        )
      )
    );
  v_asset public.assets%rowtype;
begin
  if v_code = ''
     or length(v_code) > 240 then
    return jsonb_build_object(
      'asset_id',
      null
    );
  end if;

  select a.*
    into v_asset
  from public.assets a
  where upper(btrim(a.asset_code)) =
        v_code
  limit 1;

  if not found then
    select a.*
      into v_asset
    from public.asset_code_aliases ca
    join public.assets a
      on a.id = ca.asset_id
    where ca.active = true
      and upper(btrim(ca.alias_code)) =
          v_code
    order by ca.created_at
    limit 1;
  end if;

  if not found
     and to_regclass(
       'public.asset_external_identifiers'
     ) is not null then
    select a.*
      into v_asset
    from public.asset_external_identifiers ei
    join public.assets a
      on a.id = ei.asset_id
    where ei.active = true
      and upper(
        btrim(
          ei.identifier_value
        )
      ) = v_code
    order by ei.created_at
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'asset_id',
      null
    );
  end if;

  return jsonb_build_object(
    'asset_id',
    v_asset.id,
    'asset_code',
    v_asset.asset_code
  );
end;
$$;

revoke all
on function public.resolve_asset_by_code(text)
from public;

grant execute
on function public.resolve_asset_by_code(text)
to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Leitura de auditoria compativel com etiquetas antigas
-- ---------------------------------------------------------------------

create or replace function public.register_audit_scan(
    p_audit_id uuid,
    p_scanned_value text,
    p_observed_unit_id uuid,
    p_observed_environment_id uuid,
    p_scan_method text default 'qr',
    p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    audit_record public.audit_cycles%rowtype;
    asset_record public.assets%rowtype;
    item_record public.audit_items%rowtype;

    normalized_value text;
    extracted_code text;
    scan_result text;

    v_observed_unit_id uuid;
    environment_unit_id uuid;
    resolved_asset jsonb;
    resolved_asset_id uuid;
begin
    if not public.has_permission('audits.execute') then
        raise exception
          'Sem permissao para executar auditorias.';
    end if;

    if p_scan_method not in (
      'qr',
      'manual',
      'file'
    ) then
        raise exception
          'Metodo de leitura invalido.';
    end if;

    normalized_value :=
      btrim(
        coalesce(
          p_scanned_value,
          ''
        )
      );

    if normalized_value = '' then
        raise exception
          'O codigo lido esta vazio.';
    end if;

    select *
      into audit_record
    from public.audit_cycles
    where id = p_audit_id
    for update;

    if not found then
        raise exception
          'Auditoria nao encontrada.';
    end if;

    if audit_record.status <>
       'in_progress' then
        raise exception
          'A auditoria nao esta em andamento.';
    end if;

    v_observed_unit_id :=
      coalesce(
        p_observed_unit_id,
        audit_record.unit_id
      );

    if p_observed_environment_id
       is not null then
        select e.unit_id
          into environment_unit_id
        from public.environments e
        where e.id =
          p_observed_environment_id
          and e.active = true;

        if environment_unit_id
           is null then
            raise exception
              'Ambiente observado inexistente ou inativo.';
        end if;

        if p_observed_unit_id
           is not null
           and p_observed_unit_id <>
               environment_unit_id then
            raise exception
              'O ambiente observado nao pertence a unidade informada.';
        end if;

        v_observed_unit_id :=
          environment_unit_id;
    end if;

    extracted_code :=
      normalized_value;

    if position(
         '/ativo/'
         in lower(
           normalized_value
         )
       ) > 0 then
        extracted_code :=
          split_part(
            substring(
              normalized_value
              from position(
                '/ativo/'
                in lower(
                  normalized_value
                )
              ) + 7
            ),
            '?',
            1
          );

        extracted_code :=
          split_part(
            extracted_code,
            '#',
            1
          );

        extracted_code :=
          split_part(
            extracted_code,
            '/',
            1
          );
    end if;

    extracted_code :=
      upper(
        btrim(
          extracted_code
        )
      );

    resolved_asset :=
      public.resolve_asset_by_code(
        extracted_code
      );

    resolved_asset_id :=
      nullif(
        resolved_asset ->> 'asset_id',
        ''
      )::uuid;

    if resolved_asset_id is null then
        insert into public.audit_scan_events (
            audit_id,
            asset_id,
            scanned_value,
            scan_method,
            result,
            observed_unit_id,
            observed_environment_id,
            notes,
            scanned_by
        )
        values (
            p_audit_id,
            null,
            normalized_value,
            p_scan_method,
            'unknown_code',
            v_observed_unit_id,
            p_observed_environment_id,
            nullif(
              btrim(
                coalesce(
                  p_notes,
                  ''
                )
              ),
              ''
            ),
            auth.uid()
        );

        return jsonb_build_object(
            'result',
            'unknown_code',
            'asset_code',
            extracted_code,
            'known_asset',
            false
        );
    end if;

    select *
      into asset_record
    from public.assets
    where id = resolved_asset_id;

    if not found then
        raise exception
          'Patrimonio resolvido nao encontrado.';
    end if;

    select *
      into item_record
    from public.audit_items ai
    where ai.audit_id =
      p_audit_id
      and ai.asset_id =
        asset_record.id
    for update;

    if not found then
        scan_result :=
          'extra';

        insert into public.audit_items (
            audit_id,
            asset_id,
            expected,
            expected_unit_id,
            expected_environment_id,
            observed_unit_id,
            observed_environment_id,
            result,
            last_scanned_at,
            last_scanned_by,
            notes
        )
        values (
            p_audit_id,
            asset_record.id,
            false,
            asset_record.current_unit_id,
            asset_record.current_environment_id,
            v_observed_unit_id,
            p_observed_environment_id,
            'extra',
            now(),
            auth.uid(),
            nullif(
              btrim(
                coalesce(
                  p_notes,
                  ''
                )
              ),
              ''
            )
        )
        returning *
          into item_record;
    else
        if item_record.expected then
            if item_record.expected_unit_id
                   is not distinct from
                   v_observed_unit_id
               and item_record.expected_environment_id
                   is not distinct from
                   p_observed_environment_id then
                scan_result :=
                  'found';
            else
                scan_result :=
                  'divergent';
            end if;
        else
            scan_result :=
              'extra';
        end if;

        update public.audit_items
        set
            observed_unit_id =
              v_observed_unit_id,
            observed_environment_id =
              p_observed_environment_id,
            result =
              scan_result,
            last_scanned_at =
              now(),
            last_scanned_by =
              auth.uid(),
            notes =
              coalesce(
                nullif(
                  btrim(
                    coalesce(
                      p_notes,
                      ''
                    )
                  ),
                  ''
                ),
                notes
              )
        where id = item_record.id
        returning *
          into item_record;
    end if;

    insert into public.audit_scan_events (
        audit_id,
        asset_id,
        scanned_value,
        scan_method,
        result,
        observed_unit_id,
        observed_environment_id,
        notes,
        scanned_by,
        metadata
    )
    values (
        p_audit_id,
        asset_record.id,
        normalized_value,
        p_scan_method,
        scan_result,
        v_observed_unit_id,
        p_observed_environment_id,
        nullif(
          btrim(
            coalesce(
              p_notes,
              ''
            )
          ),
          ''
        ),
        auth.uid(),
        jsonb_build_object(
            'asset_code',
            asset_record.asset_code,
            'expected',
            item_record.expected,
            'scanned_code',
            extracted_code
        )
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
        auth.uid(),
        'audit.scan',
        'audit_cycles',
        p_audit_id,
        null,
        jsonb_build_object(
            'asset_id',
            asset_record.id,
            'asset_code',
            asset_record.asset_code,
            'result',
            scan_result,
            'observed_unit_id',
            v_observed_unit_id,
            'observed_environment_id',
            p_observed_environment_id
        ),
        jsonb_build_object(
            'scan_method',
            p_scan_method,
            'scanned_code',
            extracted_code
        )
    );

    return jsonb_build_object(
        'result',
        scan_result,
        'asset_id',
        asset_record.id,
        'asset_code',
        asset_record.asset_code,
        'known_asset',
        true,
        'expected',
        item_record.expected
    );
end;
$$;

revoke all
on function public.register_audit_scan(
  uuid,
  text,
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.register_audit_scan(
  uuid,
  text,
  uuid,
  uuid,
  text,
  text
)
to authenticated;

-- ---------------------------------------------------------------------
-- 5. Contatos estruturados do portal publico
-- ---------------------------------------------------------------------

alter table public.maintenance_requests
  add column if not exists requester_email text,
  add column if not exists requester_whatsapp text,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_whatsapp boolean not null default true;

update public.maintenance_requests
set requester_email =
  case
    when requester_email is null
     and requester_contact ~*
       '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then lower(btrim(requester_contact))
    else requester_email
  end
where requester_email is null;

update public.maintenance_requests
set identifier_kind = 'internal'
where identifier_kind = 'wisdom';

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid =
      'public.maintenance_requests'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid)
          ilike '%identifier_kind%'
  loop
    execute format(
      'alter table public.maintenance_requests drop constraint if exists %I',
      r.conname
    );
  end loop;
end;
$$;

alter table public.maintenance_requests
  add constraint maintenance_requests_identifier_kind_m16b_ck
  check (
    identifier_kind in (
      'internal',
      'patrimony',
      'serial',
      'other',
      'unknown'
    )
  );

create index if not exists maintenance_requests_email_time_idx
  on public.maintenance_requests(
    lower(requester_email),
    created_at desc
  )
  where requester_email is not null;

create index if not exists maintenance_requests_whatsapp_time_idx
  on public.maintenance_requests(
    requester_whatsapp,
    created_at desc
  )
  where requester_whatsapp is not null;

create or replace function public.create_public_maintenance_request(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'requester_name',
          ''
        )
      ),
      ''
    );

  v_email text :=
    lower(
      nullif(
        btrim(
          coalesce(
            p_payload ->> 'requester_email',
            ''
          )
        ),
        ''
      )
    );

  v_whatsapp text :=
    regexp_replace(
      coalesce(
        p_payload ->> 'requester_whatsapp',
        ''
      ),
      '[^0-9]',
      '',
      'g'
    );

  v_contact text;

  v_notify_email boolean :=
    coalesce(
      (
        p_payload ->>
        'notify_email'
      )::boolean,
      true
    );

  v_notify_whatsapp boolean :=
    coalesce(
      (
        p_payload ->>
        'notify_whatsapp'
      )::boolean,
      true
    );

  v_origin_organization text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'origin_organization',
          ''
        )
      ),
      ''
    );

  v_origin_unit text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'origin_unit',
          ''
        )
      ),
      ''
    );

  v_origin_environment text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'origin_environment',
          ''
        )
      ),
      ''
    );

  v_identifier_kind text :=
    coalesce(
      nullif(
        btrim(
          coalesce(
            p_payload ->> 'identifier_kind',
            ''
          )
        ),
        ''
      ),
      'unknown'
    );

  v_identifier text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'known_identifier',
          ''
        )
      ),
      ''
    );

  v_manufacturer text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'manufacturer',
          ''
        )
      ),
      ''
    );

  v_model text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'model',
          ''
        )
      ),
      ''
    );

  v_serial text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'serial_number',
          ''
        )
      ),
      ''
    );

  v_problem text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'problem_category',
          ''
        )
      ),
      ''
    );

  v_summary text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'summary_text',
          ''
        )
      ),
      ''
    );

  v_notes text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'requester_notes',
          ''
        )
      ),
      ''
    );

  v_flow_version integer :=
    coalesce(
      (
        p_payload ->>
        'triage_flow_version'
      )::integer,
      0
    );

  v_elapsed bigint :=
    coalesce(
      (
        p_payload ->>
        'form_elapsed_ms'
      )::bigint,
      0
    );

  v_equipment jsonb :=
    coalesce(
      p_payload -> 'equipment_items',
      '[]'::jsonb
    );

  v_answers jsonb :=
    coalesce(
      p_payload -> 'answers',
      '{}'::jsonb
    );

  v_checks jsonb :=
    coalesce(
      p_payload ->
      'self_service_checks',
      '[]'::jsonb
    );

  v_triage jsonb;
  v_asset_id uuid;
  v_resolved jsonb;
  v_request public.maintenance_requests%rowtype;
begin
  if nullif(
    btrim(
      coalesce(
        p_payload ->> 'website',
        ''
      )
    ),
    ''
  ) is not null then
    raise exception
      'Nao foi possivel enviar o chamado.';
  end if;

  if v_elapsed < 2500 then
    raise exception
      'Revise o formulario e tente enviar novamente.';
  end if;

  if v_name is null
     or length(v_name) < 3
     or length(v_name) > 120 then
    raise exception
      'Informe o nome do solicitante.';
  end if;

  if v_email is null
     or length(v_email) > 254
     or v_email !~*
       '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception
      'Informe um e-mail valido.';
  end if;

  if length(v_whatsapp) < 10
     or length(v_whatsapp) > 15 then
    raise exception
      'Informe um WhatsApp valido com DDD.';
  end if;

  v_contact :=
    v_email ||
    ' | ' ||
    v_whatsapp;

  if v_origin_unit is null
     or length(v_origin_unit) < 2
     or length(v_origin_unit) > 160 then
    raise exception
      'Informe a unidade ou setor.';
  end if;

  if jsonb_typeof(v_equipment) <> 'array'
     or jsonb_array_length(v_equipment) < 1
     or jsonb_array_length(v_equipment) > 12 then
    raise exception
      'Informe ao menos um item para atendimento.';
  end if;

  if v_identifier_kind not in (
    'internal',
    'patrimony',
    'serial',
    'other',
    'unknown'
  ) then
    raise exception
      'Tipo de identificacao invalido.';
  end if;

  if v_problem is null
     or length(v_problem) > 80 then
    raise exception
      'Problema principal invalido.';
  end if;

  if jsonb_typeof(v_answers) <> 'object' then
    raise exception
      'Respostas da triagem invalidas.';
  end if;

  if jsonb_typeof(v_checks) <> 'array' then
    raise exception
      'Checklist invalido.';
  end if;

  if coalesce(
    (
      p_payload ->>
      'self_service_completed'
    )::boolean,
    false
  ) is not true then
    raise exception
      'Confirme as verificacoes orientadas antes de enviar.';
  end if;

  if v_summary is null
     or length(v_summary) > 4000 then
    raise exception
      'Resumo tecnico invalido.';
  end if;

  select definition
    into v_triage
  from public.maintenance_triage_catalog
  where flow_code =
      'workstation_support'
    and version =
      v_flow_version
    and active = true
  limit 1;

  if v_triage is null then
    raise exception
      'Versao da triagem nao esta ativa. Atualize a pagina.';
  end if;

  if exists (
    select 1
    from public.maintenance_requests mr
    where (
      lower(
        coalesce(
          mr.requester_email,
          ''
        )
      ) = lower(v_email)
      or regexp_replace(
        coalesce(
          mr.requester_whatsapp,
          ''
        ),
        '[^0-9]',
        '',
        'g'
      ) = v_whatsapp
    )
      and mr.created_at >
        now() - interval '90 seconds'
      and mr.status <> 'cancelled'
  ) then
    raise exception
      'Ja recebemos um chamado recente deste contato. Aguarde um pouco antes de enviar outro.';
  end if;

  if v_identifier is not null then
    v_resolved :=
      public.resolve_asset_by_code(
        v_identifier
      );

    v_asset_id :=
      nullif(
        v_resolved ->> 'asset_id',
        ''
      )::uuid;

    if v_asset_id is null then
      select a.id
        into v_asset_id
      from public.assets a
      where upper(
        btrim(
          coalesce(
            a.serial_number,
            ''
          )
        )
      ) = upper(v_identifier)
        or upper(
          btrim(
            coalesce(
              a.service_tag,
              ''
            )
          )
        ) = upper(v_identifier)
        or upper(
          btrim(
            coalesce(
              a.product_number,
              ''
            )
          )
        ) = upper(v_identifier)
      order by a.created_at
      limit 1;
    end if;
  end if;

  insert into public.maintenance_requests(
    requester_name,
    requester_contact,
    requester_email,
    requester_whatsapp,
    notify_email,
    notify_whatsapp,
    origin_organization,
    origin_unit,
    origin_environment,
    equipment_items,
    identifier_kind,
    known_identifier,
    manufacturer,
    model,
    serial_number,
    problem_category,
    answers,
    self_service_checks,
    self_service_completed,
    summary_text,
    requester_notes,
    triage_flow_version,
    triage_snapshot,
    asset_id
  )
  values (
    v_name,
    v_contact,
    v_email,
    v_whatsapp,
    v_notify_email,
    v_notify_whatsapp,
    v_origin_organization,
    v_origin_unit,
    v_origin_environment,
    v_equipment,
    v_identifier_kind,
    v_identifier,
    v_manufacturer,
    v_model,
    v_serial,
    v_problem,
    v_answers,
    v_checks,
    true,
    v_summary,
    v_notes,
    v_flow_version,
    v_triage,
    v_asset_id
  )
  returning *
    into v_request;

  insert into public.maintenance_request_events(
    request_id,
    event_type,
    new_data,
    notes,
    actor_user_id
  )
  values (
    v_request.id,
    'submitted',
    jsonb_build_object(
      'status',
      v_request.status,
      'asset_id',
      v_asset_id
    ),
    'Chamado enviado pelo portal publico.',
    null
  );

  return jsonb_build_object(
    'request_id',
    v_request.id,
    'request_code',
    v_request.request_code,
    'status',
    v_request.status,
    'asset_recognized',
    v_asset_id is not null
  );
end;
$$;

revoke all
on function public.create_public_maintenance_request(jsonb)
from public, anon, authenticated;

grant execute
on function public.create_public_maintenance_request(jsonb)
to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Caixa de saida de notificacoes por e-mail
-- ---------------------------------------------------------------------

create table if not exists public.maintenance_notification_outbox (
  id uuid primary key default gen_random_uuid(),

  request_id uuid null
    references public.maintenance_requests(id)
    on delete cascade,

  maintenance_id uuid null
    references public.maintenance_orders(id)
    on delete cascade,

  event_key text not null,
  channel text not null
    default 'email'
    check (
      channel in (
        'email'
      )
    ),

  recipient text not null,
  subject text not null,
  body text not null,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'sent',
        'failed',
        'skipped'
      )
    ),

  attempts integer not null
    default 0
    check (
      attempts between 0 and 20
    ),

  last_error text null,
  created_at timestamptz not null
    default now(),
  sent_at timestamptz null,

  unique(
    event_key,
    channel,
    recipient
  )
);

create index if not exists maintenance_notification_outbox_pending_idx
  on public.maintenance_notification_outbox(
    status,
    created_at
  );

alter table public.maintenance_notification_outbox
  enable row level security;

drop policy if exists m16b_notification_outbox_select
  on public.maintenance_notification_outbox;

create policy m16b_notification_outbox_select
on public.maintenance_notification_outbox
for select
to authenticated
using (
  public.has_permission(
    'maintenance.requests.view'
  )
);

revoke all
on public.maintenance_notification_outbox
from anon, authenticated;

grant select
on public.maintenance_notification_outbox
to authenticated;

create or replace function public.m16b_queue_request_email(
  p_request_id uuid,
  p_event_key text,
  p_subject text,
  p_body text,
  p_maintenance_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.maintenance_requests%rowtype;
begin
  select *
    into v_request
  from public.maintenance_requests
  where id = p_request_id;

  if not found
     or v_request.notify_email is not true
     or nullif(
       btrim(
         coalesce(
           v_request.requester_email,
           ''
         )
       ),
       ''
     ) is null then
    return;
  end if;

  insert into public.maintenance_notification_outbox(
    request_id,
    maintenance_id,
    event_key,
    recipient,
    subject,
    body
  )
  values (
    v_request.id,
    coalesce(
      p_maintenance_id,
      v_request.maintenance_id
    ),
    left(
      p_event_key,
      300
    ),
    lower(
      btrim(
        v_request.requester_email
      )
    ),
    left(
      coalesce(
        p_subject,
        'Atualizacao do atendimento'
      ),
      300
    ),
    left(
      coalesce(
        p_body,
        ''
      ),
      12000
    )
  )
  on conflict (
    event_key,
    channel,
    recipient
  )
  do nothing;
end;
$$;

revoke all
on function public.m16b_queue_request_email(
  uuid,
  text,
  text,
  text,
  uuid
)
from public, anon, authenticated;

create or replace function public.m16b_request_event_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.maintenance_requests%rowtype;
  v_title text;
  v_message text;
  v_label text;
begin
  select *
    into v_request
  from public.maintenance_requests
  where id = new.request_id;

  if not found then
    return new;
  end if;

  v_label :=
    case new.event_type
      when 'submitted' then
        'Chamado recebido'
      when 'received' then
        'Equipamento recebido pela TI'
      when 'asset_linked' then
        'Patrimonio identificado'
      when 'maintenance_created' then
        'Atendimento tecnico iniciado'
      when 'updated' then
        'Atendimento atualizado'
      when 'resolved' then
        'Atendimento concluido'
      when 'cancelled' then
        'Atendimento cancelado'
      else
        'Atualizacao do atendimento'
    end;

  v_title :=
    v_request.request_code ||
    ' - ' ||
    v_label;

  v_message :=
    concat_ws(
      E'\n',
      'Ola ' ||
        v_request.requester_name ||
        ',',
      '',
      v_label ||
        ' para o protocolo ' ||
        v_request.request_code ||
        '.',
      case
        when nullif(
          btrim(
            coalesce(
              new.notes,
              ''
            )
          ),
          ''
        ) is not null
        then 'Atualizacao: ' ||
          btrim(new.notes)
        else null
      end,
      '',
      'Unidade/setor: ' ||
        coalesce(
          v_request.origin_unit,
          'nao informado'
        ),
      'A equipe de TI continuara acompanhando o atendimento.'
    );

  perform public.m16b_queue_request_email(
    v_request.id,
    'request_event:' ||
      new.id::text,
    v_title,
    v_message,
    v_request.maintenance_id
  );

  return new;
end;
$$;

drop trigger if exists trg_m16b_request_event_notify
  on public.maintenance_request_events;

create trigger trg_m16b_request_event_notify
after insert
on public.maintenance_request_events
for each row
execute function public.m16b_request_event_notify();

create or replace function public.m16b_maintenance_event_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.maintenance_requests%rowtype;
  v_order public.maintenance_orders%rowtype;
  v_title text;
  v_message text;
  v_label text;
begin
  select *
    into v_request
  from public.maintenance_requests
  where maintenance_id =
    new.maintenance_id
  limit 1;

  if not found then
    return new;
  end if;

  select *
    into v_order
  from public.maintenance_orders
  where id = new.maintenance_id;

  if not found then
    return new;
  end if;

  v_label :=
    case new.event_type
      when 'created' then
        'Atendimento tecnico iniciado'
      when 'updated' then
        'Atendimento atualizado'
      when 'status_changed' then
        'Status do atendimento alterado'
      when 'part_added' then
        'Peca ou material registrado'
      when 'part_removed' then
        'Peca ou material atualizado'
      when 'completed' then
        'Atendimento concluido'
      when 'cancelled' then
        'Atendimento cancelado'
      else
        'Atualizacao tecnica'
    end;

  v_title :=
    v_request.request_code ||
    ' - ' ||
    v_label;

  v_message :=
    concat_ws(
      E'\n',
      'Ola ' ||
        v_request.requester_name ||
        ',',
      '',
      v_label ||
        ' no protocolo ' ||
        v_request.request_code ||
        '.',
      'Ordem: ' ||
        v_order.maintenance_code ||
        '.',
      case v_order.status
        when 'open' then
          'Status: aberta.'
        when 'in_progress' then
          'Status: em andamento.'
        when 'waiting_parts' then
          'Status: aguardando peca.'
        when 'external' then
          'Status: atendimento externo.'
        when 'completed' then
          'Status: concluida.'
        when 'cancelled' then
          'Status: cancelada.'
        else null
      end,
      case
        when nullif(
          btrim(
            coalesce(
              v_order.diagnosis,
              ''
            )
          ),
          ''
        ) is not null
        then 'Diagnostico: ' ||
          btrim(
            v_order.diagnosis
          )
        else null
      end,
      case
        when nullif(
          btrim(
            coalesce(
              v_order.action_taken,
              ''
            )
          ),
          ''
        ) is not null
        then 'Acao realizada: ' ||
          btrim(
            v_order.action_taken
          )
        else null
      end,
      case
        when nullif(
          btrim(
            coalesce(
              new.reason,
              ''
            )
          ),
          ''
        ) is not null
        then 'Observacao: ' ||
          btrim(
            new.reason
          )
        else null
      end,
      '',
      'A equipe de TI continuara acompanhando o atendimento.'
    );

  perform public.m16b_queue_request_email(
    v_request.id,
    'maintenance_event:' ||
      new.id::text,
    v_title,
    v_message,
    v_order.id
  );

  return new;
end;
$$;

drop trigger if exists trg_m16b_maintenance_event_notify
  on public.maintenance_events;

create trigger trg_m16b_maintenance_event_notify
after insert
on public.maintenance_events
for each row
execute function public.m16b_maintenance_event_notify();

-- ---------------------------------------------------------------------
-- 7. Acesso remoto: vinculo seguro com provedor persistente
-- ---------------------------------------------------------------------

create table if not exists public.asset_remote_access (
  asset_id uuid primary key
    references public.assets(id)
    on delete cascade,

  provider text not null
    default 'meshcentral'
    check (
      provider in (
        'meshcentral'
      )
    ),

  device_id text null,
  connect_url text null,
  active boolean not null
    default true,

  created_by uuid null
    references auth.users(id)
    on delete set null,

  updated_by uuid null
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),
  updated_at timestamptz not null
    default now(),

  constraint asset_remote_access_https_ck
    check (
      connect_url is null
      or connect_url ~* '^https://'
    )
);

alter table public.asset_remote_access
  enable row level security;

drop policy if exists m16b_remote_access_select
  on public.asset_remote_access;

create policy m16b_remote_access_select
on public.asset_remote_access
for select
to authenticated
using (
  public.has_permission('assets.view')
);

revoke all
on public.asset_remote_access
from anon, authenticated;

grant select
on public.asset_remote_access
to authenticated;

create or replace function public.set_asset_remote_access(
  p_asset_id uuid,
  p_provider text,
  p_device_id text,
  p_connect_url text
)
returns public.asset_remote_access
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_url text :=
    nullif(
      btrim(
        coalesce(
          p_connect_url,
          ''
        )
      ),
      ''
    );
  v_row public.asset_remote_access%rowtype;
begin
  if v_user is null then
    raise exception
      'Sessao invalida.';
  end if;

  if not (
    public.has_permission('agents.manage')
    or public.has_permission('agents.remote')
    or public.has_permission('assets.update')
  ) then
    raise exception
      'Sem permissao para configurar acesso remoto.';
  end if;

  if p_provider <> 'meshcentral' then
    raise exception
      'Provedor de acesso remoto invalido.';
  end if;

  if v_url is null
     or v_url !~* '^https://' then
    raise exception
      'URL HTTPS de acesso remoto obrigatoria.';
  end if;

  if not exists (
    select 1
    from public.assets
    where id = p_asset_id
  ) then
    raise exception
      'Patrimonio nao encontrado.';
  end if;

  insert into public.asset_remote_access(
    asset_id,
    provider,
    device_id,
    connect_url,
    active,
    created_by,
    updated_by
  )
  values (
    p_asset_id,
    p_provider,
    nullif(
      btrim(
        coalesce(
          p_device_id,
          ''
        )
      ),
      ''
    ),
    v_url,
    true,
    v_user,
    v_user
  )
  on conflict (asset_id)
  do update set
    provider =
      excluded.provider,
    device_id =
      excluded.device_id,
    connect_url =
      excluded.connect_url,
    active = true,
    updated_by =
      v_user,
    updated_at =
      now()
  returning *
    into v_row;

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
    'remote_access.configure',
    'assets',
    p_asset_id,
    null,
    to_jsonb(v_row),
    jsonb_build_object(
      'provider',
      p_provider
    )
  );

  return v_row;
end;
$$;

revoke all
on function public.set_asset_remote_access(
  uuid,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.set_asset_remote_access(
  uuid,
  text,
  text,
  text
)
to authenticated;

create or replace function public.clear_asset_remote_access(
  p_asset_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception
      'Sessao invalida.';
  end if;

  if not (
    public.has_permission('agents.manage')
    or public.has_permission('agents.remote')
    or public.has_permission('assets.update')
  ) then
    raise exception
      'Sem permissao para configurar acesso remoto.';
  end if;

  update public.asset_remote_access
  set
    active = false,
    updated_by = v_user,
    updated_at = now()
  where asset_id = p_asset_id;

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
    'remote_access.disable',
    'assets',
    p_asset_id,
    null,
    jsonb_build_object(
      'active',
      false
    ),
    '{}'::jsonb
  );
end;
$$;

revoke all
on function public.clear_asset_remote_access(uuid)
from public, anon;

grant execute
on function public.clear_asset_remote_access(uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- 8. Agente 2.0.1: desinstalacao segura
-- ---------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid =
      'public.agent_commands'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid)
          ilike '%command_type%'
  loop
    execute format(
      'alter table public.agent_commands drop constraint if exists %I',
      r.conname
    );
  end loop;
end;
$$;

alter table public.agent_commands
  add constraint agent_commands_command_type_m16b_ck
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
      'optimize_system_drive',
      'uninstall_software'
    )
  );

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
      'AG-' ||
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
     or left(v_normalized, 2) not in ('AG', 'WT') then
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
      '2.0.1',
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
      agent_version = '2.0.1',
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
    'optimize_system_drive',
    'uninstall_software'
  ) then
    raise exception
      'Acao remota nao permitida.';
  end if;

  if p_command_type = 'uninstall_software' then
    if jsonb_typeof(coalesce(p_parameters, '{}'::jsonb)) <> 'object'
       or nullif(btrim(coalesce(p_parameters ->> 'software_id', '')), '') is null
       or nullif(btrim(coalesce(p_parameters ->> 'expected_name', '')), '') is null then
      raise exception
        'Parametros de desinstalacao invalidos.';
    end if;
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

commit;

select
  (
    select count(*)
    from public.asset_code_aliases
  ) as asset_aliases,
  (
    select count(*)
    from public.stock_code_aliases
  ) as stock_aliases,
  (
    select count(*)
    from public.assets
    where asset_code ~* '^WIS-'
  ) as legacy_asset_codes_remaining,
  (
    select count(*)
    from public.stock_units
    where stock_code ~* '^WIS-'
  ) as legacy_stock_codes_remaining,
  to_regclass(
    'public.maintenance_notification_outbox'
  ) as notification_outbox,
  to_regclass(
    'public.asset_remote_access'
  ) as asset_remote_access,
  (
    select count(*)
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'resolve_asset_by_code',
        'create_public_maintenance_request',
        'queue_agent_command',
        'set_asset_remote_access'
      )
  ) as expected_rpcs;
