-- ============================================================
-- INVENTARIO TI
-- M10 - CONSOLIDACAO + IDENTIDADE INSTITUCIONAL + RELATORIOS
--
-- EXECUTAR SOMENTE NO:
-- Supabase -> SQL Editor
--
-- Projeto oficial:
-- dqfbzsneaamihfphjfcj
--
-- Idempotente / sem secrets.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. PERMISSAO DE RELATORIOS
-- ------------------------------------------------------------

insert into public.permissions (
  code,
  module,
  action,
  description
)
values (
  'reports.view',
  'reports',
  'view',
  'Visualizar e exportar relatorios operacionais.'
)
on conflict (code) do update
set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
join public.permissions p
  on p.code = 'reports.view'
where r.code in (
  'admin',
  'manager',
  'auditor',
  'viewer'
)
on conflict do nothing;

-- ------------------------------------------------------------
-- 2. IDENTIDADE INSTITUCIONAL
-- ------------------------------------------------------------

update public.system_settings
set
  label = 'Nome exibido da instituição',
  description = 'Nome institucional exibido no Inventário TI e nas etiquetas.'
where key = 'organization.display_name';

insert into public.system_settings (
  key,
  group_code,
  label,
  description,
  value,
  value_type,
  sensitive
)
values (
  'branding.logo_path',
  'organization',
  'Logomarca institucional',
  'Caminho público da logomarca PNG usada na interface e nas etiquetas.',
  to_jsonb(''::text),
  'string',
  false
)
on conflict (key) do update
set
  group_code = excluded.group_code,
  label = excluded.label,
  description = excluded.description,
  value_type = excluded.value_type,
  sensitive = excluded.sensitive;

-- ------------------------------------------------------------
-- 3. STORAGE PUBLICO APENAS PARA BRANDING
-- A logo é deliberadamente pública porque aparece antes do login
-- e nas etiquetas. Escrita continua protegida por settings.manage.
-- ------------------------------------------------------------

insert into storage.buckets (
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

create policy m10_branding_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'institution-branding'
  and name = 'institution/logo.png'
  and public.has_permission('settings.manage')
);

drop policy if exists m10_branding_update
  on storage.objects;

create policy m10_branding_update
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

drop policy if exists m10_branding_delete
  on storage.objects;

create policy m10_branding_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'institution-branding'
  and name = 'institution/logo.png'
  and public.has_permission('settings.manage')
);

-- ------------------------------------------------------------
-- 4. BRANDING PUBLICO MINIMO
-- Nao expõe secrets nem configuracoes administrativas.
-- ------------------------------------------------------------

create or replace function public.get_public_branding()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'product_name',
    'Inventário TI',
    'organization_name',
    coalesce(
      (
        select trim(both '"' from value::text)
        from public.system_settings
        where key = 'organization.display_name'
      ),
      ''
    ),
    'support_email',
    coalesce(
      (
        select trim(both '"' from value::text)
        from public.system_settings
        where key = 'organization.support_email'
      ),
      ''
    ),
    'logo_path',
    coalesce(
      (
        select trim(both '"' from value::text)
        from public.system_settings
        where key = 'branding.logo_path'
      ),
      ''
    ),
    'updated_at',
    coalesce(
      (
        select max(updated_at)
        from public.system_settings
        where key in (
          'organization.display_name',
          'organization.support_email',
          'branding.logo_path'
        )
      ),
      now()
    )
  );
$$;

revoke all
on function public.get_public_branding()
from public;

grant execute
on function public.get_public_branding()
to anon, authenticated;

-- ------------------------------------------------------------
-- 5. DASHBOARD REAL CONSOLIDADO
-- ------------------------------------------------------------

create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('dashboard.view') then
    raise exception 'Sem permissao para visualizar dashboard.';
  end if;

  return jsonb_build_object(
    'assets',
    jsonb_build_object(
      'total', (
        select count(*)
        from public.assets
      ),
      'active', (
        select count(*)
        from public.assets
        where status = 'active'
      ),
      'stock', (
        select count(*)
        from public.assets
        where status = 'stock'
      ),
      'maintenance', (
        select count(*)
        from public.assets
        where status = 'maintenance'
      ),
      'retired', (
        select count(*)
        from public.assets
        where status = 'retired'
      ),
      'disposed', (
        select count(*)
        from public.assets
        where status = 'disposed'
      ),
      'without_location', (
        select count(*)
        from public.assets
        where current_unit_id is null
      )
    ),
    'stock',
    jsonb_build_object(
      'total', (
        select count(*)
        from public.stock_units
      ),
      'in_stock', (
        select count(*)
        from public.stock_units
        where status = 'in_stock'
      ),
      'installed', (
        select count(*)
        from public.stock_units
        where status = 'installed'
      ),
      'maintenance', (
        select count(*)
        from public.stock_units
        where status = 'maintenance'
      ),
      'disposed', (
        select count(*)
        from public.stock_units
        where status = 'disposed'
      )
    ),
    'audits',
    jsonb_build_object(
      'in_progress', (
        select count(*)
        from public.audit_cycles
        where status = 'in_progress'
      ),
      'closed', (
        select count(*)
        from public.audit_cycles
        where status = 'closed'
      ),
      'pending_items', (
        select count(*)
        from public.audit_items
        where result = 'pending'
      ),
      'missing_items', (
        select count(*)
        from public.audit_items
        where result = 'missing'
      ),
      'divergent_items', (
        select count(*)
        from public.audit_items
        where result = 'divergent'
      )
    ),
    'maintenance',
    jsonb_build_object(
      'active', (
        select count(*)
        from public.maintenance_orders
        where status in (
          'open',
          'in_progress',
          'waiting_parts',
          'external'
        )
      ),
      'critical', (
        select count(*)
        from public.maintenance_orders
        where status in (
          'open',
          'in_progress',
          'waiting_parts',
          'external'
        )
        and priority = 'critical'
      ),
      'completed_30d', (
        select count(*)
        from public.maintenance_orders
        where status = 'completed'
          and completed_at >= now() - interval '30 days'
      )
    ),
    'alerts',
    jsonb_build_object(
      'open', (
        select count(*)
        from public.system_alerts
        where status = 'open'
      ),
      'acknowledged', (
        select count(*)
        from public.system_alerts
        where status = 'acknowledged'
      ),
      'critical', (
        select count(*)
        from public.system_alerts
        where status <> 'resolved'
          and severity = 'critical'
      )
    ),
    'agents',
    jsonb_build_object(
      'active', (
        select count(*)
        from public.agent_devices
        where status = 'active'
      ),
      'online', (
        select count(*)
        from public.agent_devices
        where status = 'active'
          and last_seen_at >= now() - interval '30 minutes'
      ),
      'offline', (
        select count(*)
        from public.agent_devices
        where status = 'active'
          and (
            last_seen_at is null
            or last_seen_at < now() - interval '30 minutes'
          )
      ),
      'open_divergences', (
        select count(*)
        from public.agent_divergences
        where status = 'open'
      )
    ),
    'recent_alerts',
    coalesce(
      (
        select jsonb_agg(to_jsonb(x) order by x.detected_at desc)
        from (
          select
            sa.id,
            sa.title,
            sa.category,
            sa.severity,
            sa.status,
            sa.detected_at,
            a.asset_code
          from public.system_alerts sa
          left join public.assets a
            on a.id = sa.asset_id
          order by sa.detected_at desc
          limit 6
        ) x
      ),
      '[]'::jsonb
    ),
    'recent_maintenance',
    coalesce(
      (
        select jsonb_agg(to_jsonb(x) order by x.opened_at desc)
        from (
          select
            mo.id,
            mo.maintenance_code,
            mo.status,
            mo.priority,
            mo.opened_at,
            a.asset_code
          from public.maintenance_orders mo
          join public.assets a
            on a.id = mo.asset_id
          order by mo.opened_at desc
          limit 6
        ) x
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all
on function public.get_dashboard_summary()
from public, anon, authenticated;

grant execute
on function public.get_dashboard_summary()
to authenticated;

-- ------------------------------------------------------------
-- 6. RELATORIOS OPERACIONAIS
-- ------------------------------------------------------------

create or replace function public.get_operational_report(
  p_report text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.has_permission('reports.view') then
    raise exception 'Sem permissao para visualizar relatorios.';
  end if;

  if p_report = 'assets' then
    select coalesce(
      jsonb_agg(to_jsonb(x) order by x.asset_code),
      '[]'::jsonb
    )
    into result
    from (
      select
        a.asset_code,
        a.status,
        at.name as asset_type,
        a.manufacturer,
        a.model,
        a.serial_number,
        a.hostname,
        a.os_name,
        u.name as unit_name,
        e.name as environment_name,
        a.acquired_at,
        a.created_at,
        a.updated_at
      from public.assets a
      join public.asset_types at
        on at.id = a.asset_type_id
      left join public.units u
        on u.id = a.current_unit_id
      left join public.environments e
        on e.id = a.current_environment_id
      order by a.asset_code
      limit 5000
    ) x;

  elsif p_report = 'stock' then
    select coalesce(
      jsonb_agg(to_jsonb(x) order by x.stock_code),
      '[]'::jsonb
    )
    into result
    from (
      select
        su.stock_code,
        sp.name as product_name,
        sp.category,
        su.status,
        su.condition,
        su.manufacturer,
        su.model,
        su.serial_number,
        su.cost_amount,
        u.name as unit_name,
        e.name as environment_name,
        a.asset_code as installed_asset_code,
        su.warranty_until,
        su.created_at,
        su.updated_at
      from public.stock_units su
      join public.stock_products sp
        on sp.id = su.product_id
      left join public.units u
        on u.id = su.current_unit_id
      left join public.environments e
        on e.id = su.current_environment_id
      left join public.assets a
        on a.id = su.installed_asset_id
      order by su.stock_code
      limit 5000
    ) x;

  elsif p_report = 'audits' then
    select coalesce(
      jsonb_agg(to_jsonb(x) order by x.started_at desc),
      '[]'::jsonb
    )
    into result
    from (
      select
        ac.audit_code,
        ac.title,
        ac.status,
        u.name as unit_name,
        e.name as environment_name,
        ac.started_at,
        ac.closed_at,
        (
          select count(*)
          from public.audit_items ai
          where ai.audit_id = ac.id
        ) as item_count,
        (
          select count(*)
          from public.audit_items ai
          where ai.audit_id = ac.id
            and ai.result = 'found'
        ) as found_count,
        (
          select count(*)
          from public.audit_items ai
          where ai.audit_id = ac.id
            and ai.result = 'missing'
        ) as missing_count,
        (
          select count(*)
          from public.audit_items ai
          where ai.audit_id = ac.id
            and ai.result = 'divergent'
        ) as divergent_count
      from public.audit_cycles ac
      join public.units u
        on u.id = ac.unit_id
      left join public.environments e
        on e.id = ac.environment_id
      order by ac.started_at desc
      limit 5000
    ) x;

  elsif p_report = 'maintenance' then
    select coalesce(
      jsonb_agg(to_jsonb(x) order by x.opened_at desc),
      '[]'::jsonb
    )
    into result
    from (
      select
        mo.maintenance_code,
        a.asset_code,
        mo.maintenance_type,
        mo.priority,
        mo.status,
        mo.symptom,
        mo.provider_name,
        mo.total_cost,
        mo.opened_at,
        mo.completed_at,
        mo.cancelled_at
      from public.maintenance_orders mo
      join public.assets a
        on a.id = mo.asset_id
      order by mo.opened_at desc
      limit 5000
    ) x;

  elsif p_report = 'alerts' then
    select coalesce(
      jsonb_agg(to_jsonb(x) order by x.detected_at desc),
      '[]'::jsonb
    )
    into result
    from (
      select
        a.asset_code,
        sa.category,
        sa.severity,
        sa.status,
        sa.title,
        sa.description,
        sa.detected_at,
        sa.acknowledged_at,
        sa.resolved_at
      from public.system_alerts sa
      left join public.assets a
        on a.id = sa.asset_id
      order by sa.detected_at desc
      limit 5000
    ) x;

  elsif p_report = 'agents' then
    select coalesce(
      jsonb_agg(to_jsonb(x) order by x.asset_code),
      '[]'::jsonb
    )
    into result
    from (
      select
        a.asset_code,
        ad.hostname,
        ad.status,
        ad.agent_version,
        ad.protocol_version,
        ad.last_seen_at,
        ad.last_inventory_at,
        case
          when ad.status = 'active'
            and ad.last_seen_at >= now() - interval '30 minutes'
            then 'online'
          when ad.status = 'active'
            then 'offline'
          else 'revoked'
        end as connectivity,
        (
          select count(*)
          from public.agent_divergences d
          where d.agent_id = ad.id
            and d.status = 'open'
        ) as open_divergences
      from public.agent_devices ad
      join public.assets a
        on a.id = ad.asset_id
      order by a.asset_code
      limit 5000
    ) x;

  else
    raise exception 'Relatorio invalido.';
  end if;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all
on function public.get_operational_report(text)
from public, anon, authenticated;

grant execute
on function public.get_operational_report(text)
to authenticated;

commit;
