begin;

create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role_id uuid not null references public.roles(id),
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.environments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  code text not null,
  name text not null,
  environment_type text not null default 'other',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit_id, code)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_id_idx on public.profiles(role_id);
create index if not exists environments_unit_id_idx on public.environments(unit_id);
create index if not exists role_permissions_role_id_idx on public.role_permissions(role_id);
create index if not exists role_permissions_permission_id_idx on public.role_permissions(permission_id);
create index if not exists permissions_code_idx on public.permissions(code);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at before update on public.roles
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at before update on public.units
for each row execute function public.set_updated_at();

drop trigger if exists environments_set_updated_at on public.environments;
create trigger environments_set_updated_at before update on public.environments
for each row execute function public.set_updated_at();

insert into public.roles (code, name, description)
values
  ('admin', 'Administrador', 'Acesso administrativo completo.'),
  ('manager', 'Gestor de TI', 'Gestão operacional ampla.'),
  ('technician', 'Técnico de TI', 'Operação técnica do parque.'),
  ('auditor', 'Auditor', 'Auditorias e rastreabilidade.'),
  ('viewer', 'Consulta', 'Acesso de leitura.')
on conflict (code) do update
set name = excluded.name, description = excluded.description;

insert into public.permissions (code, module, action, description)
values
  ('dashboard.view', 'dashboard', 'view', 'Visualizar visão geral.'),
  ('assets.view', 'assets', 'view', 'Visualizar patrimônio.'),
  ('assets.create', 'assets', 'create', 'Cadastrar ativos.'),
  ('assets.update', 'assets', 'update', 'Alterar ativos.'),
  ('assets.move', 'assets', 'move', 'Movimentar ativos.'),
  ('assets.retire', 'assets', 'retire', 'Baixar ou descartar ativos.'),
  ('stock.view', 'stock', 'view', 'Visualizar estoque.'),
  ('stock.move', 'stock', 'move', 'Movimentar estoque.'),
  ('stock.adjust', 'stock', 'adjust', 'Ajustar estoque.'),
  ('audits.view', 'audits', 'view', 'Visualizar auditorias.'),
  ('audits.create', 'audits', 'create', 'Criar auditorias.'),
  ('audits.execute', 'audits', 'execute', 'Executar auditorias.'),
  ('audits.close', 'audits', 'close', 'Encerrar auditorias.'),
  ('alerts.view', 'alerts', 'view', 'Visualizar alertas.'),
  ('alerts.manage', 'alerts', 'manage', 'Tratar alertas.'),
  ('locations.view', 'locations', 'view', 'Visualizar unidades e ambientes.'),
  ('locations.manage', 'locations', 'manage', 'Gerenciar unidades e ambientes.'),
  ('users.view', 'users', 'view', 'Visualizar usuários.'),
  ('users.manage', 'users', 'manage', 'Gerenciar usuários e permissões.'),
  ('settings.view', 'settings', 'view', 'Visualizar configurações.'),
  ('settings.manage', 'settings', 'manage', 'Alterar configurações.'),
  ('logs.view', 'logs', 'view', 'Visualizar logs de auditoria.')
on conflict (code) do update
set module = excluded.module, action = excluded.action, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any(array[
  'dashboard.view','assets.view','assets.create','assets.update','assets.move','assets.retire',
  'stock.view','stock.move','stock.adjust','audits.view','audits.create','audits.execute','audits.close',
  'alerts.view','alerts.manage','locations.view','locations.manage','users.view','settings.view','logs.view'
]::text[])
where r.code = 'manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any(array[
  'dashboard.view','assets.view','assets.create','assets.update','assets.move',
  'stock.view','stock.move','audits.view','audits.execute','alerts.view','alerts.manage','locations.view'
]::text[])
where r.code = 'technician'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any(array[
  'dashboard.view','assets.view','stock.view','audits.view','audits.create','audits.execute','audits.close',
  'alerts.view','locations.view','logs.view'
]::text[])
where r.code = 'auditor'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any(array[
  'dashboard.view','assets.view','stock.view','audits.view','alerts.view','locations.view'
]::text[])
where r.code = 'viewer'
on conflict do nothing;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role_id uuid;
  profile_count bigint;
  display_name text;
begin
  select count(*) into profile_count from public.profiles;

  if profile_count = 0 then
    select id into selected_role_id from public.roles where code = 'admin';
  else
    select id into selected_role_id from public.roles where code = 'viewer';
  end if;

  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, full_name, email, role_id, active)
  values (new.id, display_name, coalesce(new.email, ''), selected_role_id, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

do $$
declare
  user_record record;
  admin_role_id uuid;
  viewer_role_id uuid;
begin
  select id into admin_role_id from public.roles where code = 'admin';
  select id into viewer_role_id from public.roles where code = 'viewer';

  for user_record in
    select id, email, raw_user_meta_data from auth.users order by created_at asc
  loop
    if not exists (select 1 from public.profiles where id = user_record.id) then
      insert into public.profiles (id, full_name, email, role_id, active)
      values (
        user_record.id,
        coalesce(
          nullif(trim(user_record.raw_user_meta_data ->> 'full_name'), ''),
          nullif(trim(user_record.raw_user_meta_data ->> 'name'), ''),
          split_part(coalesce(user_record.email, ''), '@', 1)
        ),
        coalesce(user_record.email, ''),
        case when not exists (select 1 from public.profiles) then admin_role_id else viewer_role_id end,
        true
      );
    end if;
  end loop;
end;
$$;

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    join public.permissions pe on pe.id = rp.permission_id
    where pr.id = (select auth.uid())
      and pr.active = true
      and pe.code = permission_code
  );
$$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.get_my_access_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'email', pr.email,
      'active', pr.active
    ),
    'role', jsonb_build_object('code', r.code, 'name', r.name),
    'permissions', coalesce((
      select jsonb_agg(pe.code order by pe.code)
      from public.role_permissions rp
      join public.permissions pe on pe.id = rp.permission_id
      where rp.role_id = pr.role_id
    ), '[]'::jsonb)
  )
  from public.profiles pr
  join public.roles r on r.id = pr.role_id
  where pr.id = (select auth.uid())
    and pr.active = true;
$$;

revoke all on function public.get_my_access_context() from public, anon;
grant execute on function public.get_my_access_context() to authenticated;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.units enable row level security;
alter table public.environments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles for select to authenticated using (true);

drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions for select to authenticated using (true);

drop policy if exists role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_authenticated_read on public.role_permissions for select to authenticated using (true);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_permission('users.view'));

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
using (public.has_permission('users.manage'))
with check (public.has_permission('users.manage'));

drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated
using (public.has_permission('locations.view'));

drop policy if exists units_insert on public.units;
create policy units_insert on public.units for insert to authenticated
with check (public.has_permission('locations.manage'));

drop policy if exists units_update on public.units;
create policy units_update on public.units for update to authenticated
using (public.has_permission('locations.manage'))
with check (public.has_permission('locations.manage'));

drop policy if exists environments_select on public.environments;
create policy environments_select on public.environments for select to authenticated
using (public.has_permission('locations.view'));

drop policy if exists environments_insert on public.environments;
create policy environments_insert on public.environments for insert to authenticated
with check (public.has_permission('locations.manage'));

drop policy if exists environments_update on public.environments;
create policy environments_update on public.environments for update to authenticated
using (public.has_permission('locations.manage'))
with check (public.has_permission('locations.manage'));

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
using (public.has_permission('logs.view'));

revoke all on table
  public.roles,
  public.permissions,
  public.role_permissions,
  public.profiles,
  public.units,
  public.environments,
  public.audit_logs
from anon;

grant select on table public.roles, public.permissions, public.role_permissions to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, role_id, active) on table public.profiles to authenticated;
grant select, insert, update on table public.units, public.environments to authenticated;
grant select on table public.audit_logs to authenticated;

commit;
