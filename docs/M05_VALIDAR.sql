-- ============================================================
-- WISDOM TI
-- VALIDACAO DO MARCO 05
-- Execute no SQL Editor APOS o SQL principal do M05.
-- ============================================================

-- 1. Tabelas
select
    table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
      'audit_cycles',
      'audit_items',
      'audit_scan_events'
  )
order by table_name;

-- 2. RLS
select
    c.relname as tabela,
    c.relrowsecurity as rls_ativo
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
      'audit_cycles',
      'audit_items',
      'audit_scan_events'
  )
order by c.relname;

-- 3. Funcoes
select
    routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
      'audit_m05_change',
      'create_physical_audit',
      'register_audit_scan',
      'update_audit_item_note',
      'close_physical_audit',
      'cancel_physical_audit'
  )
order by routine_name;

-- 4. Triggers
select
    event_object_table,
    trigger_name
from information_schema.triggers
where event_object_schema = 'public'
  and trigger_name in (
      'audit_cycles_set_updated_at',
      'audit_items_set_updated_at',
      'audit_cycles_audit',
      'audit_items_audit'
  )
order by event_object_table, trigger_name;

-- 5. Policies
select
    tablename,
    policyname,
    cmd,
    roles
from pg_policies
where schemaname = 'public'
  and tablename in (
      'audit_cycles',
      'audit_items',
      'audit_scan_events'
  )
order by tablename, policyname;

-- 6. Sequencia
select
    sequence_schema,
    sequence_name
from information_schema.sequences
where sequence_schema = 'public'
  and sequence_name = 'audit_cycle_code_seq';

-- 7. Permissoes RBAC necessarias
select
    code,
    module,
    action
from public.permissions
where code in (
    'audits.view',
    'audits.create',
    'audits.execute',
    'audits.close'
)
order by code;

-- 8. Grants do role authenticated nas tabelas M05
select
    table_name,
    privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
      'audit_cycles',
      'audit_items',
      'audit_scan_events'
  )
order by table_name, privilege_type;
