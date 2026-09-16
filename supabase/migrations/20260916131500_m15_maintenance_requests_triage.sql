-- =====================================================================
-- WISDOM TI - M15
-- CENTRAL DE CHAMADOS, TRIAGEM E RECEBIMENTO TECNICO
-- Executar este MESMO SQL nos 2 projetos Supabase.
-- Idempotente. Sem secrets.
-- =====================================================================

begin;

insert into public.permissions(
  code,
  module,
  action,
  description
)
values
(
  'maintenance.requests.view',
  'maintenance',
  'requests.view',
  'Visualizar chamados de suporte e manutencao.'
),
(
  'maintenance.requests.manage',
  'maintenance',
  'requests.manage',
  'Receber, vincular e converter chamados de suporte.'
)
on conflict (code) do update
set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions(
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
join public.permissions p
  on p.code in (
    'maintenance.requests.view',
    'maintenance.requests.manage'
  )
where r.code in (
  'admin',
  'manager',
  'technician'
)
on conflict do nothing;

create table if not exists public.maintenance_triage_catalog (
  id uuid primary key default gen_random_uuid(),
  flow_code text not null,
  version integer not null check (version > 0),
  definition jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  unique(flow_code, version)
);

create unique index if not exists maintenance_triage_catalog_one_active_uidx
  on public.maintenance_triage_catalog(flow_code)
  where active = true;

update public.maintenance_triage_catalog
set active = false
where flow_code = 'workstation_support'
  and version <> 1
  and active = true;

insert into public.maintenance_triage_catalog(
  flow_code,
  version,
  definition,
  active
)
values (
  'workstation_support',
  1,
  $flow${"version":1,"equipment":[{"id":"desktop","label":"Gabinete / computador"},{"id":"notebook","label":"Notebook"},{"id":"monitor","label":"Monitor"},{"id":"mouse","label":"Mouse"},{"id":"keyboard","label":"Teclado"},{"id":"charger","label":"Fonte / carregador"},{"id":"printer","label":"Impressora"},{"id":"ups","label":"Nobreak / estabilizador"},{"id":"network","label":"Equipamento de rede"},{"id":"other","label":"Outro item"}],"topics":[{"id":"no_power","label":"Não liga","description":"Nenhum sinal de energia ou funcionamento.","questions":[{"id":"power_sign","label":"Ao apertar o botão de ligar, o que acontece?","options":[{"id":"none","label":"Nada acontece","phrase":"não apresenta sinal de energia"},{"id":"brief","label":"Liga por poucos segundos e desliga","phrase":"liga por poucos segundos e desliga"},{"id":"lights","label":"Há luzes ou ventoinha, mas não inicia","phrase":"apresenta energia, mas não inicia corretamente"}]},{"id":"frequency","label":"Isso acontece com que frequência?","options":[{"id":"always","label":"Sempre","phrase":"a falha ocorre em todas as tentativas"},{"id":"sometimes","label":"Às vezes","phrase":"a falha é intermitente"},{"id":"after_move","label":"Depois que foi movimentado","phrase":"o problema começou após movimentação do equipamento"}]}],"checks":[{"id":"outlet","label":"Confirmei que a tomada ou filtro de linha tem energia."},{"id":"power_cable","label":"Retirei e reconectei o cabo de energia/fonte, quando aplicável."},{"id":"power_strip","label":"Conferi se filtro de linha, nobreak ou estabilizador está ligado."}]},{"id":"no_video","label":"Liga, mas não aparece imagem","description":"Há sinais de energia, porém a tela fica sem imagem.","questions":[{"id":"screen","label":"O que aparece no monitor?","options":[{"id":"no_signal","label":"Sem sinal / No signal","phrase":"o monitor informa ausência de sinal"},{"id":"black","label":"Tela preta, sem mensagem","phrase":"o monitor permanece com tela preta"},{"id":"then_black","label":"Mostra algo e depois apaga","phrase":"há imagem inicialmente e depois a tela apaga"}]},{"id":"pc_on","label":"O computador parece estar ligado?","options":[{"id":"yes","label":"Sim, há luzes ou ventoinha","phrase":"o computador aparenta estar energizado"},{"id":"unknown","label":"Não tenho certeza","phrase":"não foi possível confirmar se o computador está ligado"}]}],"checks":[{"id":"monitor_power","label":"Confirmei que o monitor está ligado e com luz de energia."},{"id":"video_cable","label":"Retirei e reconectei o cabo de vídeo nas duas extremidades."},{"id":"input","label":"Conferi se a entrada/fonte correta está selecionada no monitor."}]},{"id":"boot_restart","label":"Não inicia ou reinicia","description":"Liga, mas não conclui a inicialização ou reinicia sozinho.","questions":[{"id":"boot_stage","label":"Até onde o equipamento chega?","options":[{"id":"brand","label":"Só aparece a marca do fabricante","phrase":"a inicialização para na tela do fabricante"},{"id":"windows","label":"Chega ao Windows e reinicia","phrase":"chega ao Windows e reinicia"},{"id":"login","label":"Chega ao login e trava","phrase":"chega à tela de login e trava"},{"id":"random","label":"Reinicia em momentos diferentes","phrase":"reinicia em momentos diferentes da inicialização"}]}],"checks":[{"id":"restart_once","label":"Desliguei normalmente quando possível, aguardei alguns segundos e tentei ligar novamente."},{"id":"remove_usb","label":"Retirei pendrives e acessórios USB não essenciais antes de testar novamente."}]},{"id":"blue_screen","label":"Tela azul / erro crítico","description":"Aparece tela azul, código de erro ou reinicialização inesperada.","questions":[{"id":"blue_frequency","label":"A tela azul já aconteceu mais de uma vez?","options":[{"id":"once","label":"Aconteceu uma vez","phrase":"houve um episódio de tela azul"},{"id":"many","label":"Acontece repetidamente","phrase":"a tela azul é recorrente"},{"id":"startup","label":"Acontece na inicialização","phrase":"a tela azul ocorre durante a inicialização"}]},{"id":"recent_change","label":"Houve alguma mudança recente?","options":[{"id":"software","label":"Programa ou atualização","phrase":"houve instalação ou atualização recente de software"},{"id":"hardware","label":"Peça ou periférico novo","phrase":"houve alteração recente de hardware ou periférico"},{"id":"none","label":"Não que eu saiba","phrase":"não foi identificada mudança recente"}]}],"checks":[{"id":"photo_code","label":"Anotei ou fotografei o código/mensagem da tela azul, quando apareceu."},{"id":"recent_usb","label":"Desconectei periféricos USB adicionados recentemente e testei novamente."}]},{"id":"slow","label":"Muito lento / travando","description":"O equipamento funciona, mas fica lento ou para de responder.","questions":[{"id":"slow_when","label":"Quando a lentidão aparece?","options":[{"id":"startup","label":"Desde que liga","phrase":"fica lento desde a inicialização"},{"id":"program","label":"Ao abrir programas","phrase":"a lentidão aumenta ao abrir programas"},{"id":"time","label":"Depois de algum tempo","phrase":"a lentidão aparece após algum tempo de uso"},{"id":"random","label":"Sem padrão","phrase":"a lentidão não apresenta padrão claro"}]}],"checks":[{"id":"restart","label":"Salvei o trabalho e reiniciei o computador uma vez."},{"id":"close_apps","label":"Fechei programas que não estavam sendo usados e confirmei se a lentidão continuou."}]},{"id":"network","label":"Internet / rede","description":"Sem internet, Wi-Fi, cabo de rede ou acesso aos sistemas.","questions":[{"id":"connection","label":"Como o equipamento se conecta?","options":[{"id":"wifi","label":"Wi-Fi","phrase":"a conexão utilizada é Wi-Fi"},{"id":"cable","label":"Cabo de rede","phrase":"a conexão utilizada é por cabo"},{"id":"both","label":"Já testei os dois","phrase":"Wi-Fi e cabo foram testados"}]},{"id":"others","label":"Outros equipamentos no mesmo local estão com internet?","options":[{"id":"yes","label":"Sim","phrase":"outros equipamentos no local continuam conectados"},{"id":"no","label":"Não","phrase":"outros equipamentos no local também estão sem conexão"},{"id":"unknown","label":"Não sei","phrase":"não foi possível comparar com outros equipamentos"}]}],"checks":[{"id":"airplane","label":"Confirmei que Wi-Fi está ligado e modo avião está desligado, quando aplicável."},{"id":"cable","label":"Conferi o cabo de rede, quando o equipamento usa cabo."},{"id":"restart_pc","label":"Reiniciei apenas o computador e verifiquei novamente a conexão."}]},{"id":"peripheral","label":"Mouse, teclado ou periférico","description":"Um acessório não funciona ou funciona de forma intermitente.","questions":[{"id":"which","label":"Qual item apresenta o problema?","options":[{"id":"mouse","label":"Mouse","phrase":"o problema está no mouse"},{"id":"keyboard","label":"Teclado","phrase":"o problema está no teclado"},{"id":"usb","label":"Dispositivo USB","phrase":"o problema está em um dispositivo USB"},{"id":"other","label":"Outro periférico","phrase":"o problema está em outro periférico"}]},{"id":"behavior","label":"Como ele falha?","options":[{"id":"never","label":"Não funciona","phrase":"o periférico não funciona"},{"id":"intermittent","label":"Funciona e para","phrase":"o periférico funciona de forma intermitente"},{"id":"wrong","label":"Funciona de forma incorreta","phrase":"o periférico responde de forma incorreta"}]}],"checks":[{"id":"reconnect","label":"Desconectei e conectei novamente o periférico."},{"id":"other_port","label":"Testei outra porta compatível, quando disponível."}]},{"id":"thermal","label":"Esquenta, faz barulho ou desliga","description":"Aquecimento, ruído ou desligamento durante o uso.","questions":[{"id":"signal","label":"Qual sinal você percebe?","options":[{"id":"hot","label":"Muito quente","phrase":"há aquecimento excessivo percebido"},{"id":"fan","label":"Ventoinha muito forte","phrase":"a ventoinha trabalha de forma intensa"},{"id":"noise","label":"Ruído mecânico","phrase":"há ruído mecânico anormal"},{"id":"shutdown","label":"Desliga sozinho","phrase":"o equipamento desliga durante o uso"}]}],"checks":[{"id":"airflow","label":"Confirmei que entradas e saídas de ar não estão bloqueadas por objetos."},{"id":"burn","label":"Se houve cheiro de queimado ou fumaça, desliguei e não tentei ligar novamente."}]},{"id":"software","label":"Programa / Windows","description":"Erro em aplicativo, sistema operacional, acesso ou atualização.","questions":[{"id":"scope","label":"Onde o problema acontece?","options":[{"id":"app","label":"Em um programa específico","phrase":"o problema está concentrado em um programa"},{"id":"windows","label":"No Windows em geral","phrase":"o problema afeta o Windows de forma geral"},{"id":"login","label":"No acesso / login","phrase":"o problema ocorre no acesso ou autenticação"},{"id":"update","label":"Depois de uma atualização","phrase":"o problema começou após uma atualização"}]}],"checks":[{"id":"restart","label":"Fechei e abri novamente o programa ou reiniciei o computador."},{"id":"error","label":"Anotei ou fotografei a mensagem de erro, quando apareceu."}]},{"id":"physical","label":"Queda, líquido ou dano físico","description":"Houve impacto, líquido, cheiro de queimado ou dano visível.","questions":[{"id":"kind","label":"O que aconteceu?","options":[{"id":"fall","label":"Queda / impacto","phrase":"houve queda ou impacto"},{"id":"liquid","label":"Contato com líquido","phrase":"houve contato com líquido"},{"id":"burn","label":"Cheiro de queimado / fumaça","phrase":"foi percebido cheiro de queimado ou fumaça"},{"id":"broken","label":"Peça ou carcaça quebrada","phrase":"há dano físico visível"}]}],"checks":[{"id":"power_off","label":"Desliguei o equipamento e desconectei da energia, quando foi seguro fazer isso."},{"id":"no_restart","label":"Não tentei ligar novamente após líquido, fumaça ou cheiro de queimado."}]},{"id":"unknown","label":"Não sei identificar","description":"Algo está errado, mas não consigo classificar o problema.","questions":[{"id":"effect","label":"Qual é o principal efeito percebido?","options":[{"id":"cannot_use","label":"Não consigo usar o equipamento","phrase":"o equipamento está impedindo o uso"},{"id":"sometimes","label":"Funciona, mas falha às vezes","phrase":"a falha é intermitente"},{"id":"different","label":"Está funcionando de forma diferente","phrase":"o comportamento do equipamento mudou"}]}],"checks":[{"id":"restart","label":"Reiniciei o equipamento uma vez, quando foi seguro fazer isso."},{"id":"observe","label":"Observei quando o problema acontece para conseguir descrevê-lo ao técnico."}]}]}$flow$::jsonb,
  true
)
on conflict (flow_code, version)
do update set
  definition = excluded.definition,
  active = true;

create sequence if not exists public.maintenance_request_code_seq;

create or replace function public.next_maintenance_request_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return
    'CHM-' ||
    to_char(current_date, 'YYYY') ||
    '-' ||
    lpad(
      nextval(
        'public.maintenance_request_code_seq'
      )::text,
      6,
      '0'
    );
end;
$$;

revoke all
on function public.next_maintenance_request_code()
from public, anon, authenticated;

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),

  request_code text not null unique
    default public.next_maintenance_request_code(),

  status text not null default 'submitted'
    check (
      status in (
        'submitted',
        'received',
        'waiting_asset',
        'converted',
        'resolved',
        'cancelled'
      )
    ),

  requester_name text not null,
  requester_contact text not null,

  origin_organization text null,
  origin_unit text null,
  origin_environment text null,

  equipment_items jsonb not null
    default '[]'::jsonb,
  received_items jsonb not null
    default '[]'::jsonb,

  identifier_kind text not null
    default 'unknown'
    check (
      identifier_kind in (
        'wisdom',
        'patrimony',
        'serial',
        'other',
        'unknown'
      )
    ),

  known_identifier text null,
  manufacturer text null,
  model text null,
  serial_number text null,

  problem_category text not null,
  answers jsonb not null default '{}'::jsonb,
  self_service_checks jsonb not null
    default '[]'::jsonb,
  self_service_completed boolean not null
    default false,

  summary_text text not null,
  requester_notes text null,

  triage_flow_version integer not null,
  triage_snapshot jsonb not null,

  asset_id uuid null
    references public.assets(id)
    on delete set null,

  maintenance_id uuid null unique
    references public.maintenance_orders(id)
    on delete set null,

  submitted_at timestamptz not null default now(),

  received_at timestamptz null,
  received_by uuid null
    references auth.users(id)
    on delete set null,

  converted_at timestamptz null,
  converted_by uuid null
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint maintenance_requests_equipment_array_ck
    check (
      jsonb_typeof(equipment_items) = 'array'
    ),

  constraint maintenance_requests_received_array_ck
    check (
      jsonb_typeof(received_items) = 'array'
    ),

  constraint maintenance_requests_answers_object_ck
    check (
      jsonb_typeof(answers) = 'object'
    ),

  constraint maintenance_requests_checks_array_ck
    check (
      jsonb_typeof(self_service_checks) = 'array'
    )
);

create index if not exists maintenance_requests_status_idx
  on public.maintenance_requests(
    status,
    submitted_at desc
  );

create index if not exists maintenance_requests_asset_idx
  on public.maintenance_requests(
    asset_id,
    submitted_at desc
  )
  where asset_id is not null;

create index if not exists maintenance_requests_identifier_idx
  on public.maintenance_requests(
    upper(known_identifier)
  )
  where known_identifier is not null;

create table if not exists public.maintenance_request_events (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null
    references public.maintenance_requests(id)
    on delete restrict,

  event_type text not null
    check (
      event_type in (
        'submitted',
        'received',
        'asset_linked',
        'maintenance_created',
        'updated',
        'resolved',
        'cancelled'
      )
    ),

  previous_data jsonb null,
  new_data jsonb null,
  notes text null,

  actor_user_id uuid null
    references auth.users(id)
    on delete set null,

  occurred_at timestamptz not null default now()
);

create index if not exists maintenance_request_events_request_idx
  on public.maintenance_request_events(
    request_id,
    occurred_at desc
  );

create or replace function public.m15_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_m15_maintenance_requests_updated_at
  on public.maintenance_requests;

create trigger trg_m15_maintenance_requests_updated_at
before update on public.maintenance_requests
for each row
execute function public.m15_touch_updated_at();

alter table public.maintenance_triage_catalog
  enable row level security;

alter table public.maintenance_requests
  enable row level security;

alter table public.maintenance_request_events
  enable row level security;

drop policy if exists m15_triage_staff_select
  on public.maintenance_triage_catalog;

create policy m15_triage_staff_select
on public.maintenance_triage_catalog
for select
to authenticated
using (
  public.has_permission(
    'maintenance.requests.view'
  )
);

drop policy if exists m15_requests_staff_select
  on public.maintenance_requests;

create policy m15_requests_staff_select
on public.maintenance_requests
for select
to authenticated
using (
  public.has_permission(
    'maintenance.requests.view'
  )
);

drop policy if exists m15_events_staff_select
  on public.maintenance_request_events;

create policy m15_events_staff_select
on public.maintenance_request_events
for select
to authenticated
using (
  public.has_permission(
    'maintenance.requests.view'
  )
);

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

  v_contact text :=
    nullif(
      btrim(
        coalesce(
          p_payload ->> 'requester_contact',
          ''
        )
      ),
      ''
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

  if v_contact is null
     or length(v_contact) < 5
     or length(v_contact) > 160 then
    raise exception
      'Informe um contato valido.';
  end if;

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
    'wisdom',
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
  where flow_code = 'workstation_support'
    and version = v_flow_version
    and active = true
  limit 1;

  if v_triage is null then
    raise exception
      'Versao da triagem nao esta ativa. Atualize a pagina.';
  end if;

  if exists (
    select 1
    from public.maintenance_requests mr
    where lower(mr.requester_contact) =
          lower(v_contact)
      and mr.created_at >
          now() - interval '90 seconds'
      and mr.status <> 'cancelled'
  ) then
    raise exception
      'Ja recebemos um chamado recente deste contato. Aguarde um pouco antes de enviar outro.';
  end if;

  if v_identifier is not null then
    select a.id
      into v_asset_id
    from public.assets a
    where
      upper(btrim(a.asset_code)) =
        upper(v_identifier)
      or upper(
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
    order by
      case
        when upper(
          btrim(a.asset_code)
        ) = upper(v_identifier)
          then 0
        else 1
      end,
      a.created_at
    limit 1;

    if v_asset_id is null then
      select ei.asset_id
        into v_asset_id
      from public.asset_external_identifiers ei
      where ei.active = true
        and upper(
          btrim(
            ei.identifier_value
          )
        ) = upper(v_identifier)
      order by ei.created_at
      limit 1;
    end if;
  end if;

  insert into public.maintenance_requests(
    requester_name,
    requester_contact,
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

create or replace function public.receive_maintenance_request(
  p_request_id uuid,
  p_received_items jsonb
)
returns public.maintenance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.maintenance_requests%rowtype;
  v_new public.maintenance_requests%rowtype;
  v_items jsonb :=
    coalesce(
      p_received_items,
      '[]'::jsonb
    );
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission(
    'maintenance.requests.manage'
  ) then
    raise exception
      'Sem permissao para receber chamados.';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception
      'Itens recebidos invalidos.';
  end if;

  select *
    into v_old
  from public.maintenance_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Chamado nao encontrado.';
  end if;

  if v_old.received_at is not null then
    return v_old;
  end if;

  if v_old.status in (
    'converted',
    'resolved',
    'cancelled'
  ) then
    raise exception
      'Este chamado nao aceita recebimento.';
  end if;

  update public.maintenance_requests
  set
    status = case
      when asset_id is null
        then 'waiting_asset'
      else 'received'
    end,
    received_items = v_items,
    received_at = now(),
    received_by = v_user
  where id = p_request_id
  returning *
    into v_new;

  insert into public.maintenance_request_events(
    request_id,
    event_type,
    previous_data,
    new_data,
    notes,
    actor_user_id
  )
  values (
    p_request_id,
    'received',
    to_jsonb(v_old),
    to_jsonb(v_new),
    'Equipamento recebido pela TI.',
    v_user
  );

  return v_new;
end;
$$;

revoke all
on function public.receive_maintenance_request(
  uuid,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.receive_maintenance_request(
  uuid,
  jsonb
)
to authenticated;

create or replace function public.link_maintenance_request_asset(
  p_request_id uuid,
  p_asset_id uuid
)
returns public.maintenance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.maintenance_requests%rowtype;
  v_new public.maintenance_requests%rowtype;
  v_asset public.assets%rowtype;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission(
    'maintenance.requests.manage'
  ) then
    raise exception
      'Sem permissao para vincular patrimonio.';
  end if;

  select *
    into v_old
  from public.maintenance_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Chamado nao encontrado.';
  end if;

  if v_old.status in (
    'converted',
    'resolved',
    'cancelled'
  ) then
    raise exception
      'Chamado encerrado nao pode mudar de patrimonio.';
  end if;

  select *
    into v_asset
  from public.assets
  where id = p_asset_id;

  if not found then
    raise exception
      'Patrimonio nao encontrado.';
  end if;

  if v_asset.status = 'disposed' then
    raise exception
      'Patrimonio descartado nao pode ser vinculado.';
  end if;

  update public.maintenance_requests
  set
    asset_id = p_asset_id,
    status = case
      when received_at is null
        then status
      else 'received'
    end
  where id = p_request_id
  returning *
    into v_new;

  insert into public.maintenance_request_events(
    request_id,
    event_type,
    previous_data,
    new_data,
    notes,
    actor_user_id
  )
  values (
    p_request_id,
    'asset_linked',
    jsonb_build_object(
      'asset_id',
      v_old.asset_id
    ),
    jsonb_build_object(
      'asset_id',
      p_asset_id,
      'asset_code',
      v_asset.asset_code
    ),
    'Patrimonio vinculado ao chamado.',
    v_user
  );

  return v_new;
end;
$$;

revoke all
on function public.link_maintenance_request_asset(
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.link_maintenance_request_asset(
  uuid,
  uuid
)
to authenticated;

create or replace function public.convert_maintenance_request(
  p_request_id uuid,
  p_priority text default 'normal',
  p_assign_to_me boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_request public.maintenance_requests%rowtype;
  v_result record;
  v_notes text;
begin
  if v_user is null then
    raise exception 'Sessao invalida.';
  end if;

  if not public.has_permission(
    'maintenance.requests.manage'
  ) then
    raise exception
      'Sem permissao para converter chamados.';
  end if;

  if p_priority not in (
    'low',
    'normal',
    'high',
    'critical'
  ) then
    raise exception
      'Prioridade invalida.';
  end if;

  select *
    into v_request
  from public.maintenance_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Chamado nao encontrado.';
  end if;

  if v_request.maintenance_id
     is not null then
    select
      mo.id as maintenance_id,
      mo.maintenance_code
      into v_result
    from public.maintenance_orders mo
    where mo.id =
      v_request.maintenance_id;

    return jsonb_build_object(
      'maintenance_id',
      v_result.maintenance_id,
      'maintenance_code',
      v_result.maintenance_code
    );
  end if;

  if v_request.received_at is null then
    raise exception
      'Registre o recebimento antes de abrir a manutencao.';
  end if;

  if v_request.asset_id is null then
    raise exception
      'Vincule ou cadastre o patrimonio antes de abrir a manutencao.';
  end if;

  v_notes :=
    concat_ws(
      E'\n',
      'Origem: chamado ' ||
        v_request.request_code,
      'Solicitante: ' ||
        v_request.requester_name,
      'Contato: ' ||
        v_request.requester_contact,
      case
        when v_request.origin_unit
             is not null
          then 'Unidade/setor: ' ||
               v_request.origin_unit
        else null
      end,
      case
        when v_request.known_identifier
             is not null
          then 'Identificacao informada: ' ||
               v_request.known_identifier
        else null
      end
    );

  select *
    into v_result
  from public.create_maintenance_order(
    v_request.asset_id,
    'corrective',
    p_priority,
    v_request.summary_text,
    case
      when coalesce(
        p_assign_to_me,
        true
      )
        then v_user
      else null
    end,
    false,
    null,
    v_request.request_code,
    v_notes
  );

  update public.maintenance_requests
  set
    status = 'converted',
    maintenance_id =
      v_result.maintenance_id,
    converted_at = now(),
    converted_by = v_user
  where id = p_request_id;

  insert into public.maintenance_request_events(
    request_id,
    event_type,
    previous_data,
    new_data,
    notes,
    actor_user_id
  )
  values (
    p_request_id,
    'maintenance_created',
    jsonb_build_object(
      'status',
      v_request.status
    ),
    jsonb_build_object(
      'status',
      'converted',
      'maintenance_id',
      v_result.maintenance_id,
      'maintenance_code',
      v_result.maintenance_code
    ),
    'Chamado convertido em ordem de manutencao.',
    v_user
  );

  return jsonb_build_object(
    'maintenance_id',
    v_result.maintenance_id,
    'maintenance_code',
    v_result.maintenance_code
  );
end;
$$;

revoke all
on function public.convert_maintenance_request(
  uuid,
  text,
  boolean
)
from public, anon, authenticated;

grant execute
on function public.convert_maintenance_request(
  uuid,
  text,
  boolean
)
to authenticated;

commit;

select
  to_regclass(
    'public.maintenance_requests'
  ) as maintenance_requests,
  to_regclass(
    'public.maintenance_request_events'
  ) as maintenance_request_events,
  (
    select count(*)
    from public.maintenance_triage_catalog
    where flow_code =
      'workstation_support'
      and active = true
  ) as active_triage_flows,
  (
    select count(*)
    from public.permissions
    where code in (
      'maintenance.requests.view',
      'maintenance.requests.manage'
    )
  ) as maintenance_permissions,
  (
    select count(*)
    from public.maintenance_requests
  ) as request_count;