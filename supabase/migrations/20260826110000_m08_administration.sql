-- ============================================================
-- WISDOM TI
-- M08 - ADMINISTRACAO REAL
-- Usuarios, configuracoes seguras e suporte a logs
--
-- EXECUTAR SOMENTE NO:
-- Supabase -> SQL Editor
--
-- Idempotente / nao destrutivo.
-- Nao contem secrets.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. CONFIGURACOES SEGURAS
-- ------------------------------------------------------------

create table if not exists public.system_settings (
  key text primary key,
  group_code text not null,
  label text not null,
  description text,
  value jsonb not null default 'null'::jsonb,
  value_type text not null default 'string'
    check (
      value_type in (
        'string',
        'number',
        'boolean'
      )
    ),
  sensitive boolean not null default false,
  updated_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_settings_group_idx
  on public.system_settings(group_code, key);

insert into public.system_settings (
  key,
  group_code,
  label,
  description,
  value,
  value_type,
  sensitive
)
values
(
  'organization.display_name',
  'organization',
  'Nome exibido da organização',
  'Identificação institucional exibida na administração.',
  to_jsonb('Wisdom'::text),
  'string',
  false
),
(
  'organization.support_email',
  'organization',
  'E-mail interno de suporte',
  'Contato operacional da equipe de TI.',
  to_jsonb(''::text),
  'string',
  false
),
(
  'operations.timezone',
  'operations',
  'Fuso horário operacional',
  'Fuso IANA usado como referência para operação e relatórios.',
  to_jsonb('America/Bahia'::text),
  'string',
  false
),
(
  'auth.invite_redirect_url',
  'auth',
  'URL de retorno dos convites',
  'URL segura para a qual o usuário será direcionado após aceitar um convite. Pode ficar vazia durante desenvolvimento local.',
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
-- 2. RLS DE CONFIGURACOES
-- ------------------------------------------------------------

alter table public.system_settings
  enable row level security;

drop policy if exists system_settings_select
  on public.system_settings;

create policy system_settings_select
on public.system_settings
for select
to authenticated
using (
  public.has_permission('settings.view')
);

-- Escrita direta fica bloqueada.
drop policy if exists system_settings_update
  on public.system_settings;

revoke all
on table public.system_settings
from anon;

revoke insert, update, delete
on table public.system_settings
from authenticated;

grant select
on table public.system_settings
to authenticated;

-- ------------------------------------------------------------
-- 3. RPC SEGURA PARA CONFIGURACOES
-- ------------------------------------------------------------

create or replace function public.update_system_setting(
  p_key text,
  p_value jsonb
)
returns public.system_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  setting_record public.system_settings;
  old_value jsonb;
  expected_type text;
  clean_string text;
begin
  if not public.has_permission('settings.manage') then
    raise exception 'Sem permissao para alterar configuracoes.';
  end if;

  select *
  into setting_record
  from public.system_settings
  where key = p_key
  for update;

  if not found then
    raise exception 'Configuracao nao encontrada.';
  end if;

  if setting_record.sensitive then
    raise exception 'Configuracao sensivel nao pode ser alterada por esta interface.';
  end if;

  expected_type := setting_record.value_type;

  if expected_type = 'string'
     and jsonb_typeof(p_value) <> 'string' then
    raise exception 'Valor deve ser texto.';
  end if;

  if expected_type = 'number'
     and jsonb_typeof(p_value) <> 'number' then
    raise exception 'Valor deve ser numerico.';
  end if;

  if expected_type = 'boolean'
     and jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'Valor deve ser booleano.';
  end if;

  if p_key = 'auth.invite_redirect_url' then
    clean_string := trim(both '"' from p_value::text);

    if clean_string <> ''
       and clean_string !~* '^https://'
       and clean_string !~* '^http://localhost([:/]|$)'
       and clean_string !~* '^http://127\.0\.0\.1([:/]|$)' then
      raise exception 'URL de convite deve usar HTTPS ou localhost.';
    end if;
  end if;

  old_value := setting_record.value;

  update public.system_settings
  set
    value = p_value,
    updated_by = auth.uid(),
    updated_at = now()
  where key = p_key
  returning *
  into setting_record;

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
    'settings.update',
    'system_settings',
    null,
    jsonb_build_object(
      'key', p_key,
      'value', old_value
    ),
    jsonb_build_object(
      'key', p_key,
      'value', p_value
    ),
    jsonb_build_object(
      'module', 'administration',
      'source', 'update_system_setting'
    )
  );

  return setting_record;
end;
$$;

revoke all
on function public.update_system_setting(text, jsonb)
from public, anon, authenticated;

grant execute
on function public.update_system_setting(text, jsonb)
to authenticated;

-- ------------------------------------------------------------
-- 4. ENDURECIMENTO DA GESTAO DE PERFIS
-- ------------------------------------------------------------
-- A partir do M08, alteracoes administrativas de usuarios passam
-- pela Edge Function admin-users. O frontend nao recebe privilegio
-- direto de UPDATE em profiles.

drop policy if exists profiles_update_admin
  on public.profiles;

revoke update
on table public.profiles
from authenticated;

-- Leitura continua sendo controlada pelas politicas existentes.

-- ------------------------------------------------------------
-- 5. INDICES PARA CONSULTA ADMINISTRATIVA DE LOGS
-- ------------------------------------------------------------

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs(action, created_at desc);

create index if not exists audit_logs_entity_type_idx
  on public.audit_logs(entity_type, created_at desc);

commit;
