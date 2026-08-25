-- ============================================================
-- WISDOM TI
-- MARCO 05
-- AUDITORIAS FISICAS + QR + DIVERGENCIAS
-- Execute no SQL Editor do Supabase APOS o M04.
-- Script idempotente e nao destrutivo.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. SEQUENCIA DE CODIGO DA AUDITORIA
-- ------------------------------------------------------------

create sequence if not exists public.audit_cycle_code_seq
    as bigint
    start with 1
    increment by 1
    minvalue 1
    cache 20;

-- ------------------------------------------------------------
-- 2. CICLOS DE AUDITORIA
-- ------------------------------------------------------------

create table if not exists public.audit_cycles (
    id uuid primary key default gen_random_uuid(),

    audit_code text not null unique,
    title text not null,

    unit_id uuid not null
        references public.units(id),

    environment_id uuid
        references public.environments(id),

    status text not null default 'in_progress',

    notes text,

    started_at timestamptz not null default now(),
    closed_at timestamptz,

    created_by uuid
        references auth.users(id),

    closed_by uuid
        references auth.users(id),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'audit_cycles_status_check'
          and conrelid = 'public.audit_cycles'::regclass
    ) then
        alter table public.audit_cycles
            add constraint audit_cycles_status_check
            check (
                status in (
                    'in_progress',
                    'closed',
                    'cancelled'
                )
            );
    end if;
end;
$$;

create index if not exists audit_cycles_unit_time_idx
    on public.audit_cycles(unit_id, started_at desc);

create index if not exists audit_cycles_environment_time_idx
    on public.audit_cycles(environment_id, started_at desc);

create index if not exists audit_cycles_status_idx
    on public.audit_cycles(status);

-- ------------------------------------------------------------
-- 3. ITENS DA AUDITORIA
-- Snapshot do esperado + estado atual da conferencia.
-- ------------------------------------------------------------

create table if not exists public.audit_items (
    id uuid primary key default gen_random_uuid(),

    audit_id uuid not null
        references public.audit_cycles(id),

    asset_id uuid not null
        references public.assets(id),

    expected boolean not null default true,

    expected_unit_id uuid
        references public.units(id),

    expected_environment_id uuid
        references public.environments(id),

    observed_unit_id uuid
        references public.units(id),

    observed_environment_id uuid
        references public.environments(id),

    result text not null default 'pending',

    last_scanned_at timestamptz,
    last_scanned_by uuid
        references auth.users(id),

    notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique(audit_id, asset_id)
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'audit_items_result_check'
          and conrelid = 'public.audit_items'::regclass
    ) then
        alter table public.audit_items
            add constraint audit_items_result_check
            check (
                result in (
                    'pending',
                    'found',
                    'missing',
                    'divergent',
                    'extra'
                )
            );
    end if;
end;
$$;

create index if not exists audit_items_audit_result_idx
    on public.audit_items(audit_id, result);

create index if not exists audit_items_asset_idx
    on public.audit_items(asset_id);

-- ------------------------------------------------------------
-- 4. EVENTOS DE LEITURA
-- Cada scan fica preservado mesmo se o item for lido novamente.
-- ------------------------------------------------------------

create table if not exists public.audit_scan_events (
    id uuid primary key default gen_random_uuid(),

    audit_id uuid not null
        references public.audit_cycles(id),

    asset_id uuid
        references public.assets(id),

    scanned_value text not null,

    scan_method text not null default 'qr',

    result text not null,

    observed_unit_id uuid
        references public.units(id),

    observed_environment_id uuid
        references public.environments(id),

    notes text,

    scanned_by uuid
        references auth.users(id),

    scanned_at timestamptz not null default now(),

    metadata jsonb not null default '{}'::jsonb
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'audit_scan_events_method_check'
          and conrelid = 'public.audit_scan_events'::regclass
    ) then
        alter table public.audit_scan_events
            add constraint audit_scan_events_method_check
            check (
                scan_method in (
                    'qr',
                    'manual',
                    'file'
                )
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'audit_scan_events_result_check'
          and conrelid = 'public.audit_scan_events'::regclass
    ) then
        alter table public.audit_scan_events
            add constraint audit_scan_events_result_check
            check (
                result in (
                    'found',
                    'divergent',
                    'extra',
                    'unknown_code'
                )
            );
    end if;
end;
$$;

create index if not exists audit_scan_events_audit_time_idx
    on public.audit_scan_events(audit_id, scanned_at desc);

create index if not exists audit_scan_events_asset_time_idx
    on public.audit_scan_events(asset_id, scanned_at desc);

-- ------------------------------------------------------------
-- 5. UPDATED_AT
-- ------------------------------------------------------------

drop trigger if exists audit_cycles_set_updated_at
    on public.audit_cycles;

create trigger audit_cycles_set_updated_at
before update on public.audit_cycles
for each row
execute function public.set_updated_at();

drop trigger if exists audit_items_set_updated_at
    on public.audit_items;

create trigger audit_items_set_updated_at
before update on public.audit_items
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. AUDITORIA DE ALTERACOES DO MODULO
-- ------------------------------------------------------------

create or replace function public.audit_m05_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    entity_uuid uuid;
    old_json jsonb;
    new_json jsonb;
begin
    if tg_op = 'INSERT' then
        entity_uuid := new.id;
        old_json := null;
        new_json := to_jsonb(new);
    elsif tg_op = 'UPDATE' then
        entity_uuid := new.id;
        old_json := to_jsonb(old);
        new_json := to_jsonb(new);
    else
        return coalesce(new, old);
    end if;

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
        lower(tg_table_name) || '.' || lower(tg_op),
        tg_table_name,
        entity_uuid,
        old_json,
        new_json,
        jsonb_build_object(
            'source',
            'database_trigger',
            'module',
            'physical_audit'
        )
    );

    return new;
end;
$$;

revoke all
on function public.audit_m05_change()
from public, anon, authenticated;

drop trigger if exists audit_cycles_audit
    on public.audit_cycles;

create trigger audit_cycles_audit
after insert or update on public.audit_cycles
for each row
execute function public.audit_m05_change();

drop trigger if exists audit_items_audit
    on public.audit_items;

create trigger audit_items_audit
after insert or update on public.audit_items
for each row
execute function public.audit_m05_change();

-- ------------------------------------------------------------
-- 7. CRIAR AUDITORIA + SNAPSHOT DO ESPERADO
-- ------------------------------------------------------------

create or replace function public.create_physical_audit(
    p_title text,
    p_unit_id uuid,
    p_environment_id uuid,
    p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_audit_id uuid;
    new_audit_code text;
    clean_title text;
    environment_unit_id uuid;
    expected_count integer;
begin
    if not public.has_permission('audits.create') then
        raise exception 'Sem permissao para criar auditorias.';
    end if;

    clean_title := btrim(coalesce(p_title, ''));

    if clean_title = '' then
        raise exception 'O titulo da auditoria e obrigatorio.';
    end if;

    if not exists (
        select 1
        from public.units u
        where u.id = p_unit_id
          and u.active = true
    ) then
        raise exception 'Unidade inexistente ou inativa.';
    end if;

    if p_environment_id is not null then
        select e.unit_id
        into environment_unit_id
        from public.environments e
        where e.id = p_environment_id
          and e.active = true;

        if environment_unit_id is null then
            raise exception 'Ambiente inexistente ou inativo.';
        end if;

        if environment_unit_id <> p_unit_id then
            raise exception 'O ambiente nao pertence a unidade informada.';
        end if;
    end if;

    new_audit_code :=
        'AUD-' ||
        to_char(now(), 'YYYY') ||
        '-' ||
        lpad(
            nextval('public.audit_cycle_code_seq')::text,
            6,
            '0'
        );

    insert into public.audit_cycles (
        audit_code,
        title,
        unit_id,
        environment_id,
        status,
        notes,
        started_at,
        created_by
    )
    values (
        new_audit_code,
        clean_title,
        p_unit_id,
        p_environment_id,
        'in_progress',
        nullif(btrim(coalesce(p_notes, '')), ''),
        now(),
        auth.uid()
    )
    returning id
    into new_audit_id;

    insert into public.audit_items (
        audit_id,
        asset_id,
        expected,
        expected_unit_id,
        expected_environment_id,
        result
    )
    select
        new_audit_id,
        a.id,
        true,
        a.current_unit_id,
        a.current_environment_id,
        'pending'
    from public.assets a
    where a.status <> 'disposed'
      and (
          (
              p_environment_id is not null
              and a.current_environment_id = p_environment_id
          )
          or
          (
              p_environment_id is null
              and a.current_unit_id = p_unit_id
          )
      );

    select count(*)
    into expected_count
    from public.audit_items ai
    where ai.audit_id = new_audit_id
      and ai.expected = true;

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
        'audit.create',
        'audit_cycles',
        new_audit_id,
        null,
        jsonb_build_object(
            'audit_code', new_audit_code,
            'unit_id', p_unit_id,
            'environment_id', p_environment_id,
            'expected_count', expected_count
        ),
        jsonb_build_object(
            'title', clean_title
        )
    );

    return jsonb_build_object(
        'audit_id', new_audit_id,
        'audit_code', new_audit_code,
        'expected_count', expected_count,
        'status', 'in_progress'
    );
end;
$$;

revoke all
on function public.create_physical_audit(text, uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.create_physical_audit(text, uuid, uuid, text)
to authenticated;

-- ------------------------------------------------------------
-- 8. REGISTRAR LEITURA
-- Aceita codigo bruto ou URL /ativo/{asset_code}.
-- ------------------------------------------------------------

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

    observed_unit_id uuid;
    environment_unit_id uuid;
begin
    if not public.has_permission('audits.execute') then
        raise exception 'Sem permissao para executar auditorias.';
    end if;

    if p_scan_method not in ('qr','manual','file') then
        raise exception 'Metodo de leitura invalido.';
    end if;

    normalized_value := btrim(coalesce(p_scanned_value, ''));

    if normalized_value = '' then
        raise exception 'O codigo lido esta vazio.';
    end if;

    select *
    into audit_record
    from public.audit_cycles
    where id = p_audit_id
    for update;

    if not found then
        raise exception 'Auditoria nao encontrada.';
    end if;

    if audit_record.status <> 'in_progress' then
        raise exception 'A auditoria nao esta em andamento.';
    end if;

    observed_unit_id :=
        coalesce(p_observed_unit_id, audit_record.unit_id);

    if p_observed_environment_id is not null then
        select e.unit_id
        into environment_unit_id
        from public.environments e
        where e.id = p_observed_environment_id
          and e.active = true;

        if environment_unit_id is null then
            raise exception 'Ambiente observado inexistente ou inativo.';
        end if;

        if p_observed_unit_id is not null
           and p_observed_unit_id <> environment_unit_id then
            raise exception 'O ambiente observado nao pertence a unidade informada.';
        end if;

        observed_unit_id := environment_unit_id;
    end if;

    extracted_code := normalized_value;

    if position('/ativo/' in lower(normalized_value)) > 0 then
        extracted_code :=
            split_part(
                substring(
                    normalized_value
                    from position('/ativo/' in lower(normalized_value)) + 7
                ),
                '?',
                1
            );

        extracted_code := split_part(extracted_code, '#', 1);
        extracted_code := split_part(extracted_code, '/', 1);
    end if;

    extracted_code := upper(btrim(extracted_code));

    select *
    into asset_record
    from public.assets a
    where upper(a.asset_code) = extracted_code
    limit 1;

    if not found then
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
            observed_unit_id,
            p_observed_environment_id,
            nullif(btrim(coalesce(p_notes, '')), ''),
            auth.uid()
        );

        return jsonb_build_object(
            'result', 'unknown_code',
            'asset_code', extracted_code,
            'known_asset', false
        );
    end if;

    select *
    into item_record
    from public.audit_items ai
    where ai.audit_id = p_audit_id
      and ai.asset_id = asset_record.id
    for update;

    if not found then
        scan_result := 'extra';

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
            observed_unit_id,
            p_observed_environment_id,
            'extra',
            now(),
            auth.uid(),
            nullif(btrim(coalesce(p_notes, '')), '')
        )
        returning *
        into item_record;
    else
        if item_record.expected then
            if item_record.expected_unit_id
                   is not distinct from observed_unit_id
               and item_record.expected_environment_id
                   is not distinct from p_observed_environment_id then
                scan_result := 'found';
            else
                scan_result := 'divergent';
            end if;
        else
            scan_result := 'extra';
        end if;

        update public.audit_items
        set
            observed_unit_id = observed_unit_id,
            observed_environment_id = p_observed_environment_id,
            result = scan_result,
            last_scanned_at = now(),
            last_scanned_by = auth.uid(),
            notes = coalesce(
                nullif(btrim(coalesce(p_notes, '')), ''),
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
        observed_unit_id,
        p_observed_environment_id,
        nullif(btrim(coalesce(p_notes, '')), ''),
        auth.uid(),
        jsonb_build_object(
            'asset_code', asset_record.asset_code,
            'expected', item_record.expected
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
            'asset_id', asset_record.id,
            'asset_code', asset_record.asset_code,
            'result', scan_result,
            'observed_unit_id', observed_unit_id,
            'observed_environment_id', p_observed_environment_id
        ),
        jsonb_build_object(
            'scan_method', p_scan_method
        )
    );

    return jsonb_build_object(
        'result', scan_result,
        'asset_id', asset_record.id,
        'asset_code', asset_record.asset_code,
        'known_asset', true,
        'expected', item_record.expected
    );
end;
$$;

revoke all
on function public.register_audit_scan(uuid, text, uuid, uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.register_audit_scan(uuid, text, uuid, uuid, text, text)
to authenticated;

-- ------------------------------------------------------------
-- 9. OBSERVACAO MANUAL DO ITEM
-- ------------------------------------------------------------

create or replace function public.update_audit_item_note(
    p_audit_item_id uuid,
    p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    audit_status text;
begin
    if not public.has_permission('audits.execute') then
        raise exception 'Sem permissao para atualizar auditoria.';
    end if;

    select ac.status
    into audit_status
    from public.audit_items ai
    join public.audit_cycles ac
      on ac.id = ai.audit_id
    where ai.id = p_audit_item_id;

    if audit_status is null then
        raise exception 'Item de auditoria nao encontrado.';
    end if;

    if audit_status <> 'in_progress' then
        raise exception 'A auditoria nao esta em andamento.';
    end if;

    update public.audit_items
    set notes = nullif(btrim(coalesce(p_notes, '')), '')
    where id = p_audit_item_id;
end;
$$;

revoke all
on function public.update_audit_item_note(uuid, text)
from public, anon, authenticated;

grant execute
on function public.update_audit_item_note(uuid, text)
to authenticated;

-- ------------------------------------------------------------
-- 10. FECHAR AUDITORIA
-- Pending esperado vira missing.
-- ------------------------------------------------------------

create or replace function public.close_physical_audit(
    p_audit_id uuid,
    p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    audit_record public.audit_cycles%rowtype;
    found_count integer;
    missing_count integer;
    divergent_count integer;
    extra_count integer;
    unknown_count integer;
begin
    if not public.has_permission('audits.close') then
        raise exception 'Sem permissao para fechar auditorias.';
    end if;

    select *
    into audit_record
    from public.audit_cycles
    where id = p_audit_id
    for update;

    if not found then
        raise exception 'Auditoria nao encontrada.';
    end if;

    if audit_record.status <> 'in_progress' then
        raise exception 'A auditoria nao esta em andamento.';
    end if;

    update public.audit_items
    set result = 'missing'
    where audit_id = p_audit_id
      and expected = true
      and result = 'pending';

    update public.audit_cycles
    set
        status = 'closed',
        closed_at = now(),
        closed_by = auth.uid(),
        notes = coalesce(
            nullif(btrim(coalesce(p_notes, '')), ''),
            notes
        )
    where id = p_audit_id;

    select count(*) filter (where result = 'found'),
           count(*) filter (where result = 'missing'),
           count(*) filter (where result = 'divergent'),
           count(*) filter (where result = 'extra')
    into
        found_count,
        missing_count,
        divergent_count,
        extra_count
    from public.audit_items
    where audit_id = p_audit_id;

    select count(*)
    into unknown_count
    from public.audit_scan_events
    where audit_id = p_audit_id
      and result = 'unknown_code';

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
        'audit.close',
        'audit_cycles',
        p_audit_id,
        jsonb_build_object(
            'status', 'in_progress'
        ),
        jsonb_build_object(
            'status', 'closed',
            'found', found_count,
            'missing', missing_count,
            'divergent', divergent_count,
            'extra', extra_count,
            'unknown', unknown_count
        ),
        jsonb_build_object(
            'audit_code', audit_record.audit_code
        )
    );

    return jsonb_build_object(
        'audit_id', p_audit_id,
        'audit_code', audit_record.audit_code,
        'status', 'closed',
        'found', found_count,
        'missing', missing_count,
        'divergent', divergent_count,
        'extra', extra_count,
        'unknown', unknown_count
    );
end;
$$;

revoke all
on function public.close_physical_audit(uuid, text)
from public, anon, authenticated;

grant execute
on function public.close_physical_audit(uuid, text)
to authenticated;

-- ------------------------------------------------------------
-- 11. CANCELAR AUDITORIA
-- ------------------------------------------------------------

create or replace function public.cancel_physical_audit(
    p_audit_id uuid,
    p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    clean_reason text;
    current_status text;
begin
    if not public.has_permission('audits.close') then
        raise exception 'Sem permissao para cancelar auditorias.';
    end if;

    clean_reason := btrim(coalesce(p_reason, ''));

    if clean_reason = '' then
        raise exception 'A justificativa do cancelamento e obrigatoria.';
    end if;

    select status
    into current_status
    from public.audit_cycles
    where id = p_audit_id
    for update;

    if current_status is null then
        raise exception 'Auditoria nao encontrada.';
    end if;

    if current_status <> 'in_progress' then
        raise exception 'Somente auditorias em andamento podem ser canceladas.';
    end if;

    update public.audit_cycles
    set
        status = 'cancelled',
        closed_at = now(),
        closed_by = auth.uid(),
        notes = concat_ws(
            E'\n',
            nullif(notes, ''),
            'Cancelamento: ' || clean_reason
        )
    where id = p_audit_id;

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
        'audit.cancel',
        'audit_cycles',
        p_audit_id,
        jsonb_build_object('status','in_progress'),
        jsonb_build_object('status','cancelled'),
        jsonb_build_object('reason',clean_reason)
    );
end;
$$;

revoke all
on function public.cancel_physical_audit(uuid, text)
from public, anon, authenticated;

grant execute
on function public.cancel_physical_audit(uuid, text)
to authenticated;

-- ------------------------------------------------------------
-- 12. RLS
-- ------------------------------------------------------------

alter table public.audit_cycles
    enable row level security;

alter table public.audit_items
    enable row level security;

alter table public.audit_scan_events
    enable row level security;

drop policy if exists audit_cycles_select
    on public.audit_cycles;

create policy audit_cycles_select
on public.audit_cycles
for select
to authenticated
using (
    public.has_permission('audits.view')
);

drop policy if exists audit_items_select
    on public.audit_items;

create policy audit_items_select
on public.audit_items
for select
to authenticated
using (
    public.has_permission('audits.view')
);

drop policy if exists audit_scan_events_select
    on public.audit_scan_events;

create policy audit_scan_events_select
on public.audit_scan_events
for select
to authenticated
using (
    public.has_permission('audits.view')
);

-- ------------------------------------------------------------
-- 13. GRANTS
-- Escritas operacionais ficam nas RPCs.
-- ------------------------------------------------------------

revoke all
on table
    public.audit_cycles,
    public.audit_items,
    public.audit_scan_events
from anon;

revoke all
on table
    public.audit_cycles,
    public.audit_items,
    public.audit_scan_events
from authenticated;

grant select
on table
    public.audit_cycles,
    public.audit_items,
    public.audit_scan_events
to authenticated;

grant usage, select
on sequence public.audit_cycle_code_seq
to authenticated;

revoke delete
on table
    public.audit_cycles,
    public.audit_items,
    public.audit_scan_events
from authenticated;

commit;
