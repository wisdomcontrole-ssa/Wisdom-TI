-- ============================================================
-- WISDOM TI
-- M07 - VALIDACAO DO BANCO
-- Executar no SUPABASE SQL EDITOR APOS A MIGRACAO
-- ============================================================

select
  to_regclass('public.maintenance_orders') as maintenance_orders,
  to_regclass('public.maintenance_parts') as maintenance_parts,
  to_regclass('public.maintenance_events') as maintenance_events,
  to_regclass('public.asset_lifecycle_events') as asset_lifecycle_events,
  to_regclass('public.asset_disposals') as asset_disposals;

select
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_maintenance_order',
    'update_maintenance_order',
    'add_maintenance_part',
    'remove_maintenance_part',
    'complete_maintenance_order',
    'cancel_maintenance_order',
    'retire_asset',
    'dispose_asset'
  )
order by routine_name;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'maintenance_orders',
    'maintenance_parts',
    'maintenance_events',
    'asset_lifecycle_events',
    'asset_disposals'
  )
order by tablename, policyname;

select
  (
    select count(*)
    from public.maintenance_orders
  ) as maintenance_orders_count,
  (
    select count(*)
    from public.asset_disposals
  ) as asset_disposals_count,
  (
    select count(*)
    from public.asset_lifecycle_events
  ) as lifecycle_events_count;