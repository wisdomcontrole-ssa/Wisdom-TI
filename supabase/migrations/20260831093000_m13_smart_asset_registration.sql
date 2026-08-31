-- ============================================================
-- INVENTARIO TI
-- M13 - CADASTRO INTELIGENTE, OCR, DOCUMENTOS E CUSTODIA
-- ============================================================

begin;

-- 1. Instituicoes externas
create table if not exists public.external_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acronym text,
  city text,
  state text,
  country text not null default 'Brasil',
  notes text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists external_organizations_name_m13_uidx
  on public.external_organizations(lower(btrim(name)));

create index if not exists external_organizations_active_m13_idx
  on public.external_organizations(active, name);

-- 2. Evolucao do ativo
alter table public.assets add column if not exists product_number text;
alter table public.assets add column if not exists service_tag text;
alter table public.assets add column if not exists electrical_rating text;
alter table public.assets add column if not exists warranty_expires_at date;
alter table public.assets add column if not exists ownership_type text not null default 'own';
alter table public.assets add column if not exists owner_organization_id uuid
  references public.external_organizations(id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_ownership_type_m13_ck'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_ownership_type_m13_ck
      check (
        ownership_type in (
          'own','ceded','loaned','commodatum','leased','third_party','other'
        )
      );
  end if;
end;
$$;

create index if not exists assets_serial_m13_idx
  on public.assets(upper(serial_number))
  where serial_number is not null;
create index if not exists assets_service_tag_m13_idx
  on public.assets(upper(service_tag))
  where service_tag is not null;
create index if not exists assets_product_number_m13_idx
  on public.assets(upper(product_number))
  where product_number is not null;

-- 3. Identificadores externos
create table if not exists public.asset_external_identifiers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  organization_id uuid not null references public.external_organizations(id) on delete restrict,
  identifier_type text not null
    check (
      identifier_type in ('patrimony','tombamento','internal_serial','contract','other')
    ),
  identifier_value text not null,
  notes text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  retired_by uuid references auth.users(id) on delete set null,
  retired_at timestamptz,
  retire_reason text
);

create unique index if not exists asset_external_identifiers_active_m13_uidx
  on public.asset_external_identifiers(
    organization_id,
    upper(btrim(identifier_value))
  )
  where active = true;

create index if not exists asset_external_identifiers_asset_m13_idx
  on public.asset_external_identifiers(asset_id, active, created_at desc);
create index if not exists asset_external_identifiers_value_m13_idx
  on public.asset_external_identifiers(upper(identifier_value))
  where active = true;

-- 4. Documentos de aquisicao
create table if not exists public.purchase_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null default 'invoice'
    check (document_type in ('invoice','receipt','term','other')),
  number text not null,
  series text,
  access_key text,
  issuer_name text,
  issuer_tax_id text,
  issue_date date,
  evidence_id uuid references public.evidence_files(id) on delete set null,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists purchase_documents_access_key_m13_uidx
  on public.purchase_documents(access_key)
  where access_key is not null and btrim(access_key) <> '';

create index if not exists purchase_documents_number_m13_idx
  on public.purchase_documents(upper(number), upper(coalesce(series, '')));

create table if not exists public.asset_purchase_documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  purchase_document_id uuid not null references public.purchase_documents(id) on delete restrict,
  linked_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  unlinked_by uuid references auth.users(id) on delete set null,
  unlinked_at timestamptz,
  unlink_reason text
);

create unique index if not exists asset_purchase_documents_active_m13_uidx
  on public.asset_purchase_documents(asset_id, purchase_document_id)
  where unlinked_at is null;

create index if not exists asset_purchase_documents_asset_m13_idx
  on public.asset_purchase_documents(asset_id, linked_at desc);

-- 5. Historico de OCR/etiquetas
create table if not exists public.asset_label_reads (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  evidence_id uuid references public.evidence_files(id) on delete set null,
  engine text not null,
  engine_version text,
  raw_text text not null,
  barcode_values jsonb not null default '[]'::jsonb,
  detected_data jsonb not null default '{}'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists asset_label_reads_asset_m13_idx
  on public.asset_label_reads(asset_id, created_at desc);

-- 6. RLS - leitura por patrimonio; escrita somente via RPC
alter table public.external_organizations enable row level security;
alter table public.asset_external_identifiers enable row level security;
alter table public.purchase_documents enable row level security;
alter table public.asset_purchase_documents enable row level security;
alter table public.asset_label_reads enable row level security;

drop policy if exists external_organizations_select_m13 on public.external_organizations;
create policy external_organizations_select_m13
on public.external_organizations for select to authenticated
using (public.has_permission('assets.view'));

drop policy if exists asset_external_identifiers_select_m13 on public.asset_external_identifiers;
create policy asset_external_identifiers_select_m13
on public.asset_external_identifiers for select to authenticated
using (public.has_permission('assets.view'));

drop policy if exists purchase_documents_select_m13 on public.purchase_documents;
create policy purchase_documents_select_m13
on public.purchase_documents for select to authenticated
using (public.has_permission('assets.view'));

drop policy if exists asset_purchase_documents_select_m13 on public.asset_purchase_documents;
create policy asset_purchase_documents_select_m13
on public.asset_purchase_documents for select to authenticated
using (public.has_permission('assets.view'));

drop policy if exists asset_label_reads_select_m13 on public.asset_label_reads;
create policy asset_label_reads_select_m13
on public.asset_label_reads for select to authenticated
using (public.has_permission('assets.view'));

revoke all on table
  public.external_organizations,
  public.asset_external_identifiers,
  public.purchase_documents,
  public.asset_purchase_documents,
  public.asset_label_reads
from anon, authenticated;

grant select on table
  public.external_organizations,
  public.asset_external_identifiers,
  public.purchase_documents,
  public.asset_purchase_documents,
  public.asset_label_reads
to authenticated;

-- 7. Criar/reutilizar instituicao
create or replace function public.ensure_external_organization(
  p_name text,
  p_acronym text default null,
  p_city text default null,
  p_state text default null,
  p_country text default 'Brasil',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_id uuid;
begin
  if v_user is null then raise exception 'Sessao invalida.'; end if;
  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para administrar instituicoes externas.';
  end if;
  if v_name is null then raise exception 'Nome da instituicao obrigatorio.'; end if;

  select id into v_id
  from public.external_organizations
  where lower(btrim(name)) = lower(v_name)
  limit 1;

  if v_id is not null then
    update public.external_organizations
    set
      acronym = coalesce(nullif(btrim(p_acronym), ''), acronym),
      city = coalesce(nullif(btrim(p_city), ''), city),
      state = coalesce(nullif(btrim(p_state), ''), state),
      country = coalesce(nullif(btrim(p_country), ''), country),
      notes = coalesce(nullif(btrim(p_notes), ''), notes),
      active = true,
      updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  insert into public.external_organizations(
    name, acronym, city, state, country, notes, created_by
  ) values (
    v_name,
    nullif(btrim(p_acronym), ''),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_state), ''),
    coalesce(nullif(btrim(p_country), ''), 'Brasil'),
    nullif(btrim(p_notes), ''),
    v_user
  )
  returning id into v_id;

  insert into public.audit_logs(
    actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    v_user,
    'asset.external_organization.create',
    'external_organizations',
    v_id,
    null,
    jsonb_build_object('name', v_name, 'acronym', nullif(btrim(p_acronym), '')),
    '{}'::jsonb
  );

  return v_id;
end;
$$;

revoke all on function public.ensure_external_organization(text,text,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.ensure_external_organization(text,text,text,text,text,text)
to authenticated;

-- 8. Campos inteligentes centrais
create or replace function public.set_asset_smart_core(
  p_asset_id uuid,
  p_product_number text,
  p_service_tag text,
  p_electrical_rating text,
  p_acquired_at date,
  p_warranty_expires_at date,
  p_ownership_type text,
  p_owner_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.assets%rowtype;
  v_new public.assets%rowtype;
begin
  if v_user is null then raise exception 'Sessao invalida.'; end if;
  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para atualizar patrimonio.';
  end if;
  if p_ownership_type not in (
    'own','ceded','loaned','commodatum','leased','third_party','other'
  ) then
    raise exception 'Tipo de posse invalido.';
  end if;

  select * into v_old
  from public.assets
  where id = p_asset_id
  for update;

  if not found then raise exception 'Ativo nao encontrado.'; end if;

  if p_ownership_type <> 'own' and p_owner_organization_id is null then
    raise exception 'Instituicao responsavel obrigatoria para ativo nao proprio.';
  end if;

  if p_owner_organization_id is not null
     and not exists (
       select 1 from public.external_organizations
       where id = p_owner_organization_id and active = true
     ) then
    raise exception 'Instituicao externa invalida.';
  end if;

  update public.assets
  set
    product_number = nullif(btrim(p_product_number), ''),
    service_tag = nullif(btrim(p_service_tag), ''),
    electrical_rating = nullif(btrim(p_electrical_rating), ''),
    acquired_at = p_acquired_at,
    warranty_expires_at = p_warranty_expires_at,
    ownership_type = p_ownership_type,
    owner_organization_id = case
      when p_ownership_type = 'own' then null
      else p_owner_organization_id
    end,
    updated_at = now()
  where id = p_asset_id
  returning * into v_new;

  insert into public.audit_logs(
    actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    v_user,
    'asset.smart_core.update',
    'assets',
    p_asset_id,
    jsonb_build_object(
      'product_number', v_old.product_number,
      'service_tag', v_old.service_tag,
      'electrical_rating', v_old.electrical_rating,
      'acquired_at', v_old.acquired_at,
      'warranty_expires_at', v_old.warranty_expires_at,
      'ownership_type', v_old.ownership_type,
      'owner_organization_id', v_old.owner_organization_id
    ),
    jsonb_build_object(
      'product_number', v_new.product_number,
      'service_tag', v_new.service_tag,
      'electrical_rating', v_new.electrical_rating,
      'acquired_at', v_new.acquired_at,
      'warranty_expires_at', v_new.warranty_expires_at,
      'ownership_type', v_new.ownership_type,
      'owner_organization_id', v_new.owner_organization_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'asset_id', v_new.id,
    'product_number', v_new.product_number,
    'service_tag', v_new.service_tag,
    'electrical_rating', v_new.electrical_rating,
    'acquired_at', v_new.acquired_at,
    'warranty_expires_at', v_new.warranty_expires_at,
    'ownership_type', v_new.ownership_type,
    'owner_organization_id', v_new.owner_organization_id
  );
end;
$$;

revoke all on function public.set_asset_smart_core(uuid,text,text,text,date,date,text,uuid)
from public, anon, authenticated;
grant execute on function public.set_asset_smart_core(uuid,text,text,text,date,date,text,uuid)
to authenticated;

-- 9. Identificadores externos
create or replace function public.add_asset_external_identifier(
  p_asset_id uuid,
  p_organization_id uuid,
  p_identifier_type text,
  p_identifier_value text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_value text := nullif(btrim(coalesce(p_identifier_value, '')), '');
  v_id uuid;
begin
  if v_user is null then raise exception 'Sessao invalida.'; end if;
  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para atualizar patrimonio.';
  end if;
  if p_identifier_type not in (
    'patrimony','tombamento','internal_serial','contract','other'
  ) then
    raise exception 'Tipo de identificador invalido.';
  end if;
  if v_value is null then raise exception 'Identificador externo obrigatorio.'; end if;
  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Ativo nao encontrado.';
  end if;
  if not exists (
    select 1 from public.external_organizations
    where id = p_organization_id and active = true
  ) then
    raise exception 'Instituicao externa invalida.';
  end if;

  select id into v_id
  from public.asset_external_identifiers
  where organization_id = p_organization_id
    and upper(btrim(identifier_value)) = upper(v_value)
    and active = true
  limit 1;

  if v_id is not null then
    if exists (
      select 1 from public.asset_external_identifiers
      where id = v_id and asset_id <> p_asset_id
    ) then
      raise exception 'Este identificador externo ja pertence a outro ativo.';
    end if;
    return v_id;
  end if;

  insert into public.asset_external_identifiers(
    asset_id, organization_id, identifier_type, identifier_value, notes, created_by
  ) values (
    p_asset_id, p_organization_id, p_identifier_type, v_value,
    nullif(btrim(p_notes), ''), v_user
  )
  returning id into v_id;

  insert into public.audit_logs(
    actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    v_user,
    'asset.external_identifier.add',
    'asset_external_identifiers',
    v_id,
    null,
    jsonb_build_object(
      'asset_id', p_asset_id,
      'organization_id', p_organization_id,
      'identifier_type', p_identifier_type,
      'identifier_value', v_value
    ),
    '{}'::jsonb
  );

  return v_id;
end;
$$;

revoke all on function public.add_asset_external_identifier(uuid,uuid,text,text,text)
from public, anon, authenticated;
grant execute on function public.add_asset_external_identifier(uuid,uuid,text,text,text)
to authenticated;

create or replace function public.retire_asset_external_identifier(
  p_identifier_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.asset_external_identifiers%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_user is null then raise exception 'Sessao invalida.'; end if;
  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para atualizar patrimonio.';
  end if;
  if v_reason is null then raise exception 'Justificativa obrigatoria.'; end if;

  select * into v_old
  from public.asset_external_identifiers
  where id = p_identifier_id and active = true
  for update;

  if not found then raise exception 'Identificador ativo nao encontrado.'; end if;

  update public.asset_external_identifiers
  set
    active = false,
    retired_by = v_user,
    retired_at = now(),
    retire_reason = v_reason
  where id = p_identifier_id;

  insert into public.audit_logs(
    actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    v_user,
    'asset.external_identifier.retire',
    'asset_external_identifiers',
    p_identifier_id,
    to_jsonb(v_old),
    jsonb_build_object('active', false, 'retire_reason', v_reason),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.retire_asset_external_identifier(uuid,text)
from public, anon, authenticated;
grant execute on function public.retire_asset_external_identifier(uuid,text)
to authenticated;

-- 10. Nota/documento compartilhavel
create or replace function public.add_purchase_document_to_asset(
  p_asset_id uuid,
  p_document_type text,
  p_number text,
  p_series text,
  p_access_key text,
  p_issuer_name text,
  p_issuer_tax_id text,
  p_issue_date date,
  p_evidence_id uuid,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_number text := nullif(btrim(coalesce(p_number, '')), '');
  v_doc_id uuid;
  v_link_id uuid;
begin
  if v_user is null then raise exception 'Sessao invalida.'; end if;
  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para atualizar patrimonio.';
  end if;
  if p_document_type not in ('invoice','receipt','term','other') then
    raise exception 'Tipo de documento invalido.';
  end if;
  if v_number is null then raise exception 'Numero do documento obrigatorio.'; end if;
  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Ativo nao encontrado.';
  end if;

  if p_evidence_id is not null
     and not exists (
       select 1 from public.evidence_files
       where id = p_evidence_id and status <> 'revoked'
     ) then
    raise exception 'Evidencia do documento invalida.';
  end if;

  if nullif(btrim(p_access_key), '') is not null then
    select id into v_doc_id
    from public.purchase_documents
    where access_key = btrim(p_access_key)
    limit 1;
  end if;

  if v_doc_id is null then
    select id into v_doc_id
    from public.purchase_documents
    where upper(number) = upper(v_number)
      and upper(coalesce(series, '')) =
          upper(coalesce(nullif(btrim(p_series), ''), ''))
      and upper(coalesce(issuer_tax_id, '')) =
          upper(coalesce(nullif(btrim(p_issuer_tax_id), ''), ''))
    order by created_at
    limit 1;
  end if;

  if v_doc_id is null then
    insert into public.purchase_documents(
      document_type, number, series, access_key, issuer_name,
      issuer_tax_id, issue_date, evidence_id, notes, created_by
    ) values (
      p_document_type,
      v_number,
      nullif(btrim(p_series), ''),
      nullif(btrim(p_access_key), ''),
      nullif(btrim(p_issuer_name), ''),
      nullif(btrim(p_issuer_tax_id), ''),
      p_issue_date,
      p_evidence_id,
      nullif(btrim(p_notes), ''),
      v_user
    )
    returning id into v_doc_id;
  else
    update public.purchase_documents
    set
      document_type = p_document_type,
      series = coalesce(nullif(btrim(p_series), ''), series),
      access_key = coalesce(nullif(btrim(p_access_key), ''), access_key),
      issuer_name = coalesce(nullif(btrim(p_issuer_name), ''), issuer_name),
      issuer_tax_id = coalesce(nullif(btrim(p_issuer_tax_id), ''), issuer_tax_id),
      issue_date = coalesce(p_issue_date, issue_date),
      evidence_id = coalesce(p_evidence_id, evidence_id),
      notes = coalesce(nullif(btrim(p_notes), ''), notes),
      updated_at = now()
    where id = v_doc_id;
  end if;

  select id into v_link_id
  from public.asset_purchase_documents
  where asset_id = p_asset_id
    and purchase_document_id = v_doc_id
    and unlinked_at is null
  limit 1;

  if v_link_id is null then
    insert into public.asset_purchase_documents(
      asset_id, purchase_document_id, linked_by
    ) values (
      p_asset_id, v_doc_id, v_user
    )
    returning id into v_link_id;
  end if;

  insert into public.audit_logs(
    actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    v_user,
    'asset.purchase_document.link',
    'purchase_documents',
    v_doc_id,
    null,
    jsonb_build_object(
      'asset_id', p_asset_id,
      'document_type', p_document_type,
      'number', v_number,
      'series', nullif(btrim(p_series), ''),
      'evidence_id', p_evidence_id
    ),
    jsonb_build_object('link_id', v_link_id)
  );

  return v_doc_id;
end;
$$;

revoke all on function public.add_purchase_document_to_asset(
  uuid,text,text,text,text,text,text,date,uuid,text
)
from public, anon, authenticated;
grant execute on function public.add_purchase_document_to_asset(
  uuid,text,text,text,text,text,text,date,uuid,text
)
to authenticated;

-- 11. Registrar OCR
create or replace function public.record_asset_label_read(
  p_asset_id uuid,
  p_evidence_id uuid,
  p_engine text,
  p_engine_version text,
  p_raw_text text,
  p_barcode_values jsonb,
  p_detected_data jsonb,
  p_confidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'Sessao invalida.'; end if;
  if not (
    public.has_permission('assets.create') or public.has_permission('assets.update')
  ) then
    raise exception 'Sem permissao para registrar leitura de etiqueta.';
  end if;
  if not exists (select 1 from public.assets where id = p_asset_id) then
    raise exception 'Ativo nao encontrado.';
  end if;

  insert into public.asset_label_reads(
    asset_id, evidence_id, engine, engine_version, raw_text,
    barcode_values, detected_data, confidence, created_by
  ) values (
    p_asset_id,
    p_evidence_id,
    coalesce(nullif(btrim(p_engine), ''), 'unknown'),
    nullif(btrim(p_engine_version), ''),
    coalesce(p_raw_text, ''),
    coalesce(p_barcode_values, '[]'::jsonb),
    coalesce(p_detected_data, '{}'::jsonb),
    coalesce(p_confidence, '{}'::jsonb),
    v_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_asset_label_read(
  uuid,uuid,text,text,text,jsonb,jsonb,jsonb
)
from public, anon, authenticated;
grant execute on function public.record_asset_label_read(
  uuid,uuid,text,text,text,jsonb,jsonb,jsonb
)
to authenticated;

-- 12. Busca ampla
create or replace function public.search_assets_smart(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_like text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sessao invalida.'; end if;
  if not public.has_permission('assets.view') then
    raise exception 'Sem permissao para visualizar patrimonio.';
  end if;
  if v_query = '' then return '[]'::jsonb; end if;

  v_like := '%' || v_query || '%';

  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb)
  into v_result
  from (
    select
      a.id,
      a.asset_code,
      a.manufacturer,
      a.model,
      a.serial_number,
      a.service_tag,
      a.product_number,
      a.ownership_type,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'value', ei.identifier_value,
              'type', ei.identifier_type,
              'organization', eo.name
            )
            order by ei.created_at desc
          )
          from public.asset_external_identifiers ei
          join public.external_organizations eo on eo.id = ei.organization_id
          where ei.asset_id = a.id and ei.active = true
        ),
        '[]'::jsonb
      ) as external_identifiers,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'number', pd.number,
              'series', pd.series,
              'access_key', pd.access_key,
              'issuer_name', pd.issuer_name
            )
            order by pd.issue_date desc nulls last, pd.created_at desc
          )
          from public.asset_purchase_documents apd
          join public.purchase_documents pd on pd.id = apd.purchase_document_id
          where apd.asset_id = a.id and apd.unlinked_at is null
        ),
        '[]'::jsonb
      ) as purchase_documents
    from public.assets a
    where
      lower(a.asset_code) like v_like
      or lower(coalesce(a.manufacturer, '')) like v_like
      or lower(coalesce(a.model, '')) like v_like
      or lower(coalesce(a.serial_number, '')) like v_like
      or lower(coalesce(a.service_tag, '')) like v_like
      or lower(coalesce(a.product_number, '')) like v_like
      or exists (
        select 1
        from public.asset_external_identifiers ei
        join public.external_organizations eo on eo.id = ei.organization_id
        where ei.asset_id = a.id and ei.active = true
          and (
            lower(ei.identifier_value) like v_like
            or lower(eo.name) like v_like
            or lower(coalesce(eo.acronym, '')) like v_like
          )
      )
      or exists (
        select 1
        from public.asset_purchase_documents apd
        join public.purchase_documents pd on pd.id = apd.purchase_document_id
        where apd.asset_id = a.id and apd.unlinked_at is null
          and (
            lower(pd.number) like v_like
            or lower(coalesce(pd.series, '')) like v_like
            or lower(coalesce(pd.access_key, '')) like v_like
            or lower(coalesce(pd.issuer_name, '')) like v_like
            or lower(coalesce(pd.issuer_tax_id, '')) like v_like
          )
      )
    order by a.created_at desc
    limit 100
  ) q;

  return v_result;
end;
$$;

revoke all on function public.search_assets_smart(text)
from public, anon, authenticated;
grant execute on function public.search_assets_smart(text)
to authenticated;

-- 13. Resolver universal - M12 + M13
create or replace function public.resolve_inventory_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text;
  v_asset public.assets%rowtype;
  v_stock public.stock_units%rowtype;
  v_product public.stock_products%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessao invalida.'; end if;
  if not (
    public.has_permission('assets.view') or public.has_permission('stock.view')
  ) then
    raise exception 'Sem permissao para identificar itens.';
  end if;

  v_value := upper(btrim(coalesce(p_code, '')));
  if v_value = '' then raise exception 'Codigo nao informado.'; end if;

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

  select * into v_asset
  from public.assets a
  where upper(a.asset_code) = v_value
     or upper(coalesce(a.serial_number, '')) = v_value
     or upper(coalesce(a.service_tag, '')) = v_value
     or upper(coalesce(a.product_number, '')) = v_value
  order by case
    when upper(a.asset_code) = v_value then 0
    when upper(coalesce(a.service_tag, '')) = v_value then 1
    when upper(coalesce(a.serial_number, '')) = v_value then 2
    else 3
  end
  limit 1;

  if not found then
    select a.* into v_asset
    from public.asset_external_identifiers ei
    join public.assets a on a.id = ei.asset_id
    where ei.active = true
      and upper(btrim(ei.identifier_value)) = v_value
    limit 1;
  end if;

  if found then
    return jsonb_build_object(
      'kind', 'asset',
      'id', v_asset.id,
      'code', v_asset.asset_code,
      'short_code', null,
      'status', v_asset.status,
      'display_name', concat_ws(
        ' ', nullif(v_asset.manufacturer, ''), nullif(v_asset.model, '')
      ),
      'registration_state', v_asset.registration_state,
      'service_tag', v_asset.service_tag,
      'serial_number', v_asset.serial_number
    );
  end if;

  select su.* into v_stock
  from public.stock_units su
  where upper(su.short_code) = v_value
     or upper(su.stock_code) = v_value
  order by case when upper(su.short_code) = v_value then 0 else 1 end
  limit 1;

  if found then
    select * into v_product
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

revoke all on function public.resolve_inventory_code(text)
from public, anon, authenticated;
grant execute on function public.resolve_inventory_code(text)
to authenticated;

commit;
