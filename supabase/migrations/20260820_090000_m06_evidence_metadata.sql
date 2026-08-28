-- ============================================================
-- INVENTARIO TI
-- M06 RECOVERY - EVIDENCE METADATA
-- Physical files remain in Google Drive via Edge Functions.
-- ============================================================

begin;

create table if not exists public.evidence_categories (
  code text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.evidence_categories (
  code,
  name,
  description,
  active
)
values
  ('registration', 'Cadastro',     'Evidência de cadastro do item.', true),
  ('audit',        'Auditoria',    'Evidência de auditoria física.', true),
  ('movement',     'Movimentação', 'Evidência de movimentação.', true),
  ('maintenance',  'Manutenção',   'Evidência de manutenção.', true),
  ('disposal',     'Descarte',     'Evidência de baixa ou descarte.', true),
  ('stock',        'Estoque',      'Evidência vinculada ao estoque.', true),
  ('other',        'Outros',       'Outras evidências.', true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;

create table if not exists public.evidence_files (
  id uuid primary key default gen_random_uuid(),

  category_code text not null
    references public.evidence_categories(code)
    on delete restrict,

  asset_id uuid
    references public.assets(id)
    on delete restrict,

  audit_id uuid
    references public.audit_cycles(id)
    on delete restrict,

  audit_item_id uuid
    references public.audit_items(id)
    on delete restrict,

  stock_unit_id uuid
    references public.stock_units(id)
    on delete restrict,

  original_name text not null,
  stored_name text not null,

  mime_type text not null
    check (
      mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'application/pdf'
      )
    ),

  byte_size bigint not null
    check (
      byte_size > 0
      and byte_size <= 5242880
    ),

  sha256 text not null,
  drive_file_id text not null unique,
  drive_folder_id text not null,

  capture_method text not null default 'file'
    check (
      capture_method in (
        'camera',
        'gallery',
        'file',
        'system'
      )
    ),

  caption text,
  captured_at timestamptz,

  uploaded_by uuid not null
    references auth.users(id)
    on delete restrict,

  status text not null default 'active'
    check (
      status in (
        'active',
        'revoked'
      )
    ),

  created_at timestamptz not null default now(),

  revoked_at timestamptz,

  revoked_by uuid
    references auth.users(id)
    on delete set null,

  revoke_reason text,

  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),

  constraint evidence_files_context_ck
    check (
      asset_id is not null
      or audit_id is not null
      or audit_item_id is not null
      or stock_unit_id is not null
    ),

  constraint evidence_files_revocation_ck
    check (
      status <> 'revoked'
      or (
        revoked_at is not null
        and revoked_by is not null
        and nullif(btrim(revoke_reason), '') is not null
      )
    )
);

create index if not exists evidence_files_asset_time_idx
  on public.evidence_files(asset_id, created_at desc)
  where asset_id is not null;

create index if not exists evidence_files_audit_time_idx
  on public.evidence_files(audit_id, created_at desc)
  where audit_id is not null;

create index if not exists evidence_files_audit_item_time_idx
  on public.evidence_files(audit_item_id, created_at desc)
  where audit_item_id is not null;

create index if not exists evidence_files_stock_time_idx
  on public.evidence_files(stock_unit_id, created_at desc)
  where stock_unit_id is not null;

create index if not exists evidence_files_status_time_idx
  on public.evidence_files(status, created_at desc);

drop trigger if exists evidence_categories_set_updated_at
  on public.evidence_categories;

create trigger evidence_categories_set_updated_at
before update on public.evidence_categories
for each row
execute function public.set_updated_at();

create or replace function public.m06_audit_evidence_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_actor := new.uploaded_by;
    v_action := 'evidence.upload';
  else
    v_actor := coalesce(
      new.revoked_by,
      auth.uid(),
      old.uploaded_by
    );

    if old.status is distinct from new.status
       and new.status = 'revoked' then
      v_action := 'evidence.revoke';
    else
      v_action := 'evidence.update';
    end if;
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
    v_actor,
    v_action,
    'evidence_files',
    new.id,
    case
      when tg_op = 'INSERT' then null
      else to_jsonb(old)
    end,
    to_jsonb(new),
    jsonb_build_object(
      'module', 'evidence',
      'source', 'database_trigger'
    )
  );

  return new;
end;
$$;

revoke all
on function public.m06_audit_evidence_change()
from public, anon, authenticated;

drop trigger if exists trg_m06_audit_evidence_change
  on public.evidence_files;

create trigger trg_m06_audit_evidence_change
after insert or update on public.evidence_files
for each row
execute function public.m06_audit_evidence_change();

alter table public.evidence_categories
  enable row level security;

alter table public.evidence_files
  enable row level security;

drop policy if exists evidence_categories_select
  on public.evidence_categories;

create policy evidence_categories_select
on public.evidence_categories
for select
to authenticated
using (true);

drop policy if exists evidence_files_select
  on public.evidence_files;

create policy evidence_files_select
on public.evidence_files
for select
to authenticated
using (
  uploaded_by = (select auth.uid())
  or public.has_permission('settings.manage')
  or public.has_permission('logs.view')
  or (
    case
      when audit_id is not null
        or audit_item_id is not null
        then public.has_permission('audits.view')

      when stock_unit_id is not null
        then public.has_permission('stock.view')

      when asset_id is not null
        then public.has_permission('assets.view')

      else false
    end
  )
);

revoke all
on table
  public.evidence_categories,
  public.evidence_files
from anon;

revoke all
on table
  public.evidence_categories,
  public.evidence_files
from authenticated;

grant select
on table
  public.evidence_categories,
  public.evidence_files
to authenticated;

commit;
