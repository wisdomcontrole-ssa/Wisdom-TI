-- =====================================================================
-- INVENTARIO TI - M14
-- Identificacao externa opcional + correcao RLS da logomarca
-- Executar este MESMO SQL nos 2 projetos Supabase.
-- Idempotente. Sem secrets.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Identificacao externa/anterior pode existir sem instituicao.
--    Necessario para doacoes, usados e equipamentos com numeracao antiga.
-- ---------------------------------------------------------------------

alter table public.asset_external_identifiers
  alter column organization_id drop not null;

drop index if exists public.asset_external_identifiers_active_m13_uidx;

create unique index if not exists asset_external_identifiers_org_m14_uidx
  on public.asset_external_identifiers(
    organization_id,
    upper(btrim(identifier_value))
  )
  where active = true
    and organization_id is not null;

create unique index if not exists asset_external_identifiers_no_org_m14_uidx
  on public.asset_external_identifiers(
    upper(btrim(identifier_value))
  )
  where active = true
    and organization_id is null;

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
  v_value text := nullif(
    btrim(coalesce(p_identifier_value, '')),
    ''
  );
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission('assets.update') then
    raise exception 'Sem permissao para atualizar patrimonio.';
  end if;

  if p_identifier_type not in (
    'patrimony',
    'tombamento',
    'internal_serial',
    'contract',
    'other'
  ) then
    raise exception 'Tipo de identificador invalido.';
  end if;

  if v_value is null then
    raise exception 'Identificador externo obrigatorio.';
  end if;

  if not exists (
    select 1
    from public.assets
    where id = p_asset_id
  ) then
    raise exception 'Ativo nao encontrado.';
  end if;

  if p_organization_id is not null
     and not exists (
       select 1
       from public.external_organizations
       where id = p_organization_id
         and active = true
     ) then
    raise exception 'Instituicao externa invalida.';
  end if;

  select id
    into v_id
  from public.asset_external_identifiers
  where organization_id is not distinct from p_organization_id
    and upper(btrim(identifier_value)) = upper(v_value)
    and active = true
  limit 1;

  if v_id is not null then
    if exists (
      select 1
      from public.asset_external_identifiers
      where id = v_id
        and asset_id <> p_asset_id
    ) then
      raise exception
        'Este identificador externo ja pertence a outro ativo.';
    end if;

    return v_id;
  end if;

  insert into public.asset_external_identifiers(
    asset_id,
    organization_id,
    identifier_type,
    identifier_value,
    notes,
    created_by
  )
  values (
    p_asset_id,
    p_organization_id,
    p_identifier_type,
    v_value,
    nullif(btrim(p_notes), ''),
    v_user
  )
  returning id into v_id;

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

revoke all on function public.add_asset_external_identifier(
  uuid,
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function public.add_asset_external_identifier(
  uuid,
  uuid,
  text,
  text,
  text
)
to authenticated;

-- ---------------------------------------------------------------------
-- 2. Branding.
--    O upload usa upsert. Alem de INSERT/UPDATE, o Storage precisa
--    permitir SELECT do objeto para o usuario administrador.
-- ---------------------------------------------------------------------

insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'institution-branding',
  'institution-branding',
  true,
  2097152,
  array['image/png']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists m10_branding_insert
  on storage.objects;
drop policy if exists m10_branding_update
  on storage.objects;
drop policy if exists m10_branding_delete
  on storage.objects;

drop policy if exists m14_branding_select_manage
  on storage.objects;
drop policy if exists m14_branding_insert_manage
  on storage.objects;
drop policy if exists m14_branding_update_manage
  on storage.objects;
drop policy if exists m14_branding_delete_manage
  on storage.objects;

create policy m14_branding_select_manage
on storage.objects
for select
to authenticated
using (
  bucket_id = 'institution-branding'
  and name = 'institution/logo.png'
  and public.has_permission('settings.manage')
);

create policy m14_branding_insert_manage
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'institution-branding'
  and name = 'institution/logo.png'
  and public.has_permission('settings.manage')
);

create policy m14_branding_update_manage
on storage.objects
for update
to authenticated
using (
  bucket_id = 'institution-branding'
  and name = 'institution/logo.png'
  and public.has_permission('settings.manage')
)
with check (
  bucket_id = 'institution-branding'
  and name = 'institution/logo.png'
  and public.has_permission('settings.manage')
);

create policy m14_branding_delete_manage
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'institution-branding'
  and name = 'institution/logo.png'
  and public.has_permission('settings.manage')
);

commit;

select
  (
    select is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_external_identifiers'
      and column_name = 'organization_id'
  ) as organization_id_nullable,
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'm14_branding_select_manage'
  ) as branding_select_policy,
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'm14_branding_insert_manage'
  ) as branding_insert_policy,
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'm14_branding_update_manage'
  ) as branding_update_policy,
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'm14_branding_delete_manage'
  ) as branding_delete_policy;