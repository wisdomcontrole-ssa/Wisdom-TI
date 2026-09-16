-- =====================================================================
-- WISDOM TI
-- OCR Intelligence - Base de apoio para interpretação de etiquetas
-- Versão: 1.1 - correção de aliases duplicados no mesmo INSERT
--
-- EXECUTAR NO SQL EDITOR DE CADA PROJETO SUPABASE.
-- Este script é idempotente: pode ser executado novamente com segurança.
--
-- NÃO altera tabelas atuais de patrimônio.
-- NÃO altera câmera.
-- NÃO altera OCR.
-- NÃO contém chaves, senhas ou tokens.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Catálogo canônico de fabricantes
-- ---------------------------------------------------------------------

create table if not exists public.ti_manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ti_manufacturers is
  'Catálogo canônico de fabricantes reconhecidos pelo motor de inventário OCR.';

-- ---------------------------------------------------------------------
-- 2. Aliases / grafias alternativas de fabricantes
-- ---------------------------------------------------------------------

create table if not exists public.ti_manufacturer_aliases (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null
    references public.ti_manufacturers(id)
    on delete cascade,
  alias text not null,
  normalized_alias text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_ti_manufacturer_aliases_manufacturer
  on public.ti_manufacturer_aliases(manufacturer_id);

comment on table public.ti_manufacturer_aliases is
  'Aliases, abreviações e variações de OCR utilizadas para matching de fabricantes.';

-- ---------------------------------------------------------------------
-- 3. Categorias de equipamentos e grupos de especificações
-- ---------------------------------------------------------------------

create table if not exists public.ti_equipment_categories (
  code text primary key,
  name text not null,
  spec_fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ti_equipment_categories is
  'Categorias de ativos e grupos de especificações técnicas esperados por tipo.';

-- ---------------------------------------------------------------------
-- 4. Execuções de interpretação OCR
-- ---------------------------------------------------------------------

create table if not exists public.ti_ocr_extraction_runs (
  id uuid primary key default gen_random_uuid(),

  -- Será ligado à tabela real de ativos depois que confirmarmos
  -- o nome e a PK da estrutura atual do patrimônio.
  asset_id uuid null,

  engine_version text not null default '1.0.0',
  equipment_hint text null,
  detected_category text null,

  raw_text text not null,
  normalized_text text not null,

  overall_confidence numeric(5,4) not null default 0
    check (overall_confidence >= 0 and overall_confidence <= 1),

  unclassified_text text null,

  created_by uuid not null default auth.uid()
    references auth.users(id),

  created_at timestamptz not null default now()
);

create index if not exists idx_ti_ocr_extraction_runs_asset
  on public.ti_ocr_extraction_runs(asset_id);

create index if not exists idx_ti_ocr_extraction_runs_created_by
  on public.ti_ocr_extraction_runs(created_by);

create index if not exists idx_ti_ocr_extraction_runs_created_at
  on public.ti_ocr_extraction_runs(created_at desc);

comment on table public.ti_ocr_extraction_runs is
  'Execuções do motor de interpretação OCR; preserva texto bruto, texto normalizado e rastreabilidade.';

comment on column public.ti_ocr_extraction_runs.asset_id is
  'UUID reservado para vínculo com o patrimônio. FK será adicionada quando a tabela real de ativos for confirmada.';

-- ---------------------------------------------------------------------
-- 5. Campos extraídos individualmente
-- ---------------------------------------------------------------------

create table if not exists public.ti_ocr_extraction_fields (
  id uuid primary key default gen_random_uuid(),

  run_id uuid not null
    references public.ti_ocr_extraction_runs(id)
    on delete cascade,

  field_key text not null,

  value_text text null,
  value_number numeric null,

  confidence numeric(5,4) not null
    check (confidence >= 0 and confidence <= 1),

  source_line text not null,
  rule text not null,

  -- null = ainda não revisado
  -- true = aceito
  -- false = rejeitado
  accepted boolean null,

  corrected_value_text text null,
  corrected_value_number numeric null,

  reviewed_at timestamptz null,
  reviewed_by uuid null
    references auth.users(id),

  created_at timestamptz not null default now()
);

create index if not exists idx_ti_ocr_extraction_fields_run
  on public.ti_ocr_extraction_fields(run_id);

create index if not exists idx_ti_ocr_extraction_fields_key
  on public.ti_ocr_extraction_fields(field_key);

create index if not exists idx_ti_ocr_extraction_fields_confidence
  on public.ti_ocr_extraction_fields(confidence desc);

comment on table public.ti_ocr_extraction_fields is
  'Campos estruturados extraídos do OCR, com confiança, regra, origem e eventual correção humana.';

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------

alter table public.ti_manufacturers enable row level security;
alter table public.ti_manufacturer_aliases enable row level security;
alter table public.ti_equipment_categories enable row level security;
alter table public.ti_ocr_extraction_runs enable row level security;
alter table public.ti_ocr_extraction_fields enable row level security;

-- Catálogo: leitura para usuários autenticados.
drop policy if exists ti_manufacturers_read_authenticated
  on public.ti_manufacturers;

create policy ti_manufacturers_read_authenticated
  on public.ti_manufacturers
  for select
  to authenticated
  using (active = true);

drop policy if exists ti_manufacturer_aliases_read_authenticated
  on public.ti_manufacturer_aliases;

create policy ti_manufacturer_aliases_read_authenticated
  on public.ti_manufacturer_aliases
  for select
  to authenticated
  using (active = true);

drop policy if exists ti_equipment_categories_read_authenticated
  on public.ti_equipment_categories;

create policy ti_equipment_categories_read_authenticated
  on public.ti_equipment_categories
  for select
  to authenticated
  using (active = true);

-- Execuções OCR: usuário autenticado enxerga e grava suas próprias execuções.
drop policy if exists ti_ocr_runs_select_own
  on public.ti_ocr_extraction_runs;

create policy ti_ocr_runs_select_own
  on public.ti_ocr_extraction_runs
  for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists ti_ocr_runs_insert_own
  on public.ti_ocr_extraction_runs;

create policy ti_ocr_runs_insert_own
  on public.ti_ocr_extraction_runs
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- Campos OCR: acesso somente se a execução pai pertence ao usuário.
drop policy if exists ti_ocr_fields_select_own
  on public.ti_ocr_extraction_fields;

create policy ti_ocr_fields_select_own
  on public.ti_ocr_extraction_fields
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ti_ocr_extraction_runs r
      where r.id = run_id
        and r.created_by = auth.uid()
    )
  );

drop policy if exists ti_ocr_fields_insert_own
  on public.ti_ocr_extraction_fields;

create policy ti_ocr_fields_insert_own
  on public.ti_ocr_extraction_fields
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.ti_ocr_extraction_runs r
      where r.id = run_id
        and r.created_by = auth.uid()
    )
  );

drop policy if exists ti_ocr_fields_update_own
  on public.ti_ocr_extraction_fields;

create policy ti_ocr_fields_update_own
  on public.ti_ocr_extraction_fields
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.ti_ocr_extraction_runs r
      where r.id = run_id
        and r.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.ti_ocr_extraction_runs r
      where r.id = run_id
        and r.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 7. Fabricantes principais
-- ---------------------------------------------------------------------

insert into public.ti_manufacturers(name, normalized_name)
values
  ('Login', 'LOGIN'),
  ('Dell', 'DELL'),
  ('HP', 'HP'),
  ('Lenovo', 'LENOVO'),
  ('Acer', 'ACER'),
  ('ASUS', 'ASUS'),
  ('MSI', 'MSI'),
  ('Gigabyte', 'GIGABYTE'),
  ('ASRock', 'ASROCK'),
  ('Positivo', 'POSITIVO'),
  ('Daten', 'DATEN'),
  ('Intel', 'INTEL'),
  ('AMD', 'AMD'),
  ('Apple', 'APPLE'),
  ('Samsung', 'SAMSUNG'),
  ('LG', 'LG'),
  ('AOC', 'AOC'),
  ('Philips', 'PHILIPS'),
  ('Epson', 'EPSON'),
  ('Brother', 'BROTHER'),
  ('Canon', 'CANON'),
  ('Zebra', 'ZEBRA'),
  ('Lexmark', 'LEXMARK'),
  ('Xerox', 'XEROX'),
  ('Ricoh', 'RICOH'),
  ('Kyocera', 'KYOCERA'),
  ('Cisco', 'CISCO'),
  ('Aruba', 'ARUBA'),
  ('Ubiquiti', 'UBIQUITI'),
  ('MikroTik', 'MIKROTIK'),
  ('TP-Link', 'TP-LINK'),
  ('D-Link', 'D-LINK'),
  ('Intelbras', 'INTELBRAS'),
  ('Fortinet', 'FORTINET'),
  ('Huawei', 'HUAWEI'),
  ('Juniper', 'JUNIPER'),
  ('Netgear', 'NETGEAR'),
  ('Realtek', 'REALTEK'),
  ('Qualcomm', 'QUALCOMM'),
  ('Broadcom', 'BROADCOM'),
  ('Kingston', 'KINGSTON'),
  ('Crucial', 'CRUCIAL'),
  ('Micron', 'MICRON'),
  ('Western Digital', 'WESTERN DIGITAL'),
  ('Seagate', 'SEAGATE'),
  ('SanDisk', 'SANDISK'),
  ('APC', 'APC'),
  ('SMS', 'SMS'),
  ('TS Shara', 'TS SHARA'),
  ('Ragtech', 'RAGTECH'),
  ('Multilaser', 'MULTILASER'),
  ('Logitech', 'LOGITECH'),
  ('Microsoft', 'MICROSOFT'),
  ('Synology', 'SYNOLOGY'),
  ('QNAP', 'QNAP')
on conflict (normalized_name)
do update set
  name = excluded.name,
  active = true,
  updated_at = now();

-- ---------------------------------------------------------------------
-- 8. Aliases
-- ---------------------------------------------------------------------

with raw_aliases(manufacturer_normalized_name, alias, normalized_alias) as (
  values
('LOGIN', 'LOGIN', 'LOGIN'),
    ('LOGIN', 'LOGIN INFORMATICA', 'LOGIN INFORMATICA'),
    ('LOGIN', 'LOGIN INFORMÁTICA', 'LOGIN INFORMATICA'),

    ('DELL', 'DELL', 'DELL'),
    ('DELL', 'DELL INC', 'DELL INC'),

    ('HP', 'HP', 'HP'),
    ('HP', 'HP INC', 'HP INC'),
    ('HP', 'HEWLETT PACKARD', 'HEWLETT PACKARD'),
    ('HP', 'HEWLETT-PACKARD', 'HEWLETT PACKARD'),

    ('LENOVO', 'LENOVO', 'LENOVO'),
    ('LENOVO', 'LENOVO GROUP', 'LENOVO GROUP'),

    ('ACER', 'ACER', 'ACER'),

    ('ASUS', 'ASUS', 'ASUS'),
    ('ASUS', 'ASUSTEK', 'ASUSTEK'),
    ('ASUS', 'ASUSTEK COMPUTER', 'ASUSTEK COMPUTER'),

    ('MSI', 'MSI', 'MSI'),
    ('MSI', 'MICRO-STAR', 'MICRO STAR'),
    ('MSI', 'MICRO STAR INTERNATIONAL', 'MICRO STAR INTERNATIONAL'),

    ('GIGABYTE', 'GIGABYTE', 'GIGABYTE'),
    ('GIGABYTE', 'GIGABYTE TECHNOLOGY', 'GIGABYTE TECHNOLOGY'),

    ('ASROCK', 'ASROCK', 'ASROCK'),

    ('POSITIVO', 'POSITIVO', 'POSITIVO'),
    ('POSITIVO', 'POSITIVO TECNOLOGIA', 'POSITIVO TECNOLOGIA'),

    ('DATEN', 'DATEN', 'DATEN'),

    ('INTEL', 'INTEL', 'INTEL'),
    ('INTEL', 'INTEL CORPORATION', 'INTEL CORPORATION'),

    ('AMD', 'AMD', 'AMD'),
    ('AMD', 'ADVANCED MICRO DEVICES', 'ADVANCED MICRO DEVICES'),

    ('APPLE', 'APPLE', 'APPLE'),
    ('APPLE', 'APPLE INC', 'APPLE INC'),

    ('SAMSUNG', 'SAMSUNG', 'SAMSUNG'),
    ('LG', 'LG', 'LG'),
    ('LG', 'LG ELECTRONICS', 'LG ELECTRONICS'),
    ('AOC', 'AOC', 'AOC'),
    ('PHILIPS', 'PHILIPS', 'PHILIPS'),

    ('EPSON', 'EPSON', 'EPSON'),
    ('EPSON', 'SEIKO EPSON', 'SEIKO EPSON'),
    ('BROTHER', 'BROTHER', 'BROTHER'),
    ('CANON', 'CANON', 'CANON'),
    ('ZEBRA', 'ZEBRA', 'ZEBRA'),
    ('ZEBRA', 'ZEBRA TECHNOLOGIES', 'ZEBRA TECHNOLOGIES'),
    ('LEXMARK', 'LEXMARK', 'LEXMARK'),
    ('XEROX', 'XEROX', 'XEROX'),
    ('RICOH', 'RICOH', 'RICOH'),
    ('KYOCERA', 'KYOCERA', 'KYOCERA'),

    ('CISCO', 'CISCO', 'CISCO'),
    ('CISCO', 'CISCO SYSTEMS', 'CISCO SYSTEMS'),
    ('ARUBA', 'ARUBA', 'ARUBA'),
    ('ARUBA', 'ARUBA NETWORKS', 'ARUBA NETWORKS'),
    ('UBIQUITI', 'UBIQUITI', 'UBIQUITI'),
    ('UBIQUITI', 'UBNT', 'UBNT'),
    ('MIKROTIK', 'MIKROTIK', 'MIKROTIK'),
    ('TP-LINK', 'TP-LINK', 'TP-LINK'),
    ('TP-LINK', 'TPLINK', 'TPLINK'),
    ('D-LINK', 'D-LINK', 'D-LINK'),
    ('D-LINK', 'DLINK', 'DLINK'),
    ('INTELBRAS', 'INTELBRAS', 'INTELBRAS'),
    ('FORTINET', 'FORTINET', 'FORTINET'),
    ('FORTINET', 'FORTIGATE', 'FORTIGATE'),
    ('HUAWEI', 'HUAWEI', 'HUAWEI'),
    ('JUNIPER', 'JUNIPER', 'JUNIPER'),
    ('JUNIPER', 'JUNIPER NETWORKS', 'JUNIPER NETWORKS'),
    ('NETGEAR', 'NETGEAR', 'NETGEAR'),

    ('REALTEK', 'REALTEK', 'REALTEK'),
    ('REALTEK', 'REALTEK SEMICONDUCTOR', 'REALTEK SEMICONDUCTOR'),
    ('QUALCOMM', 'QUALCOMM', 'QUALCOMM'),
    ('QUALCOMM', 'QUALCOMM ATHEROS', 'QUALCOMM ATHEROS'),
    ('QUALCOMM', 'ATHEROS', 'ATHEROS'),
    ('BROADCOM', 'BROADCOM', 'BROADCOM'),

    ('KINGSTON', 'KINGSTON', 'KINGSTON'),
    ('KINGSTON', 'KINGSTON TECHNOLOGY', 'KINGSTON TECHNOLOGY'),
    ('CRUCIAL', 'CRUCIAL', 'CRUCIAL'),
    ('MICRON', 'MICRON', 'MICRON'),
    ('MICRON', 'MICRON TECHNOLOGY', 'MICRON TECHNOLOGY'),
    ('WESTERN DIGITAL', 'WESTERN DIGITAL', 'WESTERN DIGITAL'),
    ('WESTERN DIGITAL', 'WDC', 'WDC'),
    ('WESTERN DIGITAL', 'WD', 'WD'),
    ('SEAGATE', 'SEAGATE', 'SEAGATE'),
    ('SANDISK', 'SANDISK', 'SANDISK'),

    ('APC', 'APC', 'APC'),
    ('APC', 'APC BY SCHNEIDER ELECTRIC', 'APC BY SCHNEIDER ELECTRIC'),
    ('SMS', 'SMS', 'SMS'),
    ('TS SHARA', 'TS SHARA', 'TS SHARA'),
    ('TS SHARA', 'TSSHARA', 'TSSHARA'),
    ('RAGTECH', 'RAGTECH', 'RAGTECH'),

    ('MULTILASER', 'MULTILASER', 'MULTILASER'),
    ('LOGITECH', 'LOGITECH', 'LOGITECH'),
    ('MICROSOFT', 'MICROSOFT', 'MICROSOFT'),
    ('SYNOLOGY', 'SYNOLOGY', 'SYNOLOGY'),
    ('QNAP', 'QNAP', 'QNAP')
),
aliases as (
  select distinct on (normalized_alias)
    manufacturer_normalized_name,
    alias,
    normalized_alias
  from raw_aliases
  order by normalized_alias, alias
)
insert into public.ti_manufacturer_aliases (
  manufacturer_id,
  alias,
  normalized_alias
)
select
  m.id,
  a.alias,
  a.normalized_alias
from aliases a
join public.ti_manufacturers m
  on m.normalized_name = a.manufacturer_normalized_name
on conflict (normalized_alias)
do update set
  manufacturer_id = excluded.manufacturer_id,
  alias = excluded.alias,
  active = true;

-- ---------------------------------------------------------------------
-- 9. Categorias e especificações esperadas
-- ---------------------------------------------------------------------

insert into public.ti_equipment_categories(code, name, spec_fields)
values
  (
    'desktop',
    'Desktop',
    '["processor","memory","storage","motherboard","operating_system","network"]'::jsonb
  ),
  (
    'notebook',
    'Notebook',
    '["processor","memory","storage","motherboard","operating_system","network","battery"]'::jsonb
  ),
  (
    'server',
    'Servidor',
    '["processor","memory","storage","raid","network","power_supply","operating_system"]'::jsonb
  ),
  (
    'monitor',
    'Monitor',
    '["screen_size","resolution","refresh_rate","panel","video_inputs","power"]'::jsonb
  ),
  (
    'printer',
    'Impressora',
    '["technology","network","duplex","paper","consumables","power"]'::jsonb
  ),
  (
    'switch',
    'Switch',
    '["ports","speed","poe","poe_budget","uplinks","mac_address","firmware","power"]'::jsonb
  ),
  (
    'router',
    'Roteador',
    '["wan","lan","wifi","mac_address","firmware","power"]'::jsonb
  ),
  (
    'access_point',
    'Access Point',
    '["wifi","ethernet","poe","mac_address","firmware","power"]'::jsonb
  ),
  (
    'firewall',
    'Firewall',
    '["ports","throughput","licenses","firmware","mac_address","power"]'::jsonb
  ),
  (
    'ups',
    'Nobreak',
    '["va","power_w","input_voltage","output_voltage","battery","frequency"]'::jsonb
  ),
  (
    'stabilizer',
    'Estabilizador',
    '["va","power_w","input_voltage","output_voltage","frequency"]'::jsonb
  ),
  (
    'power_strip',
    'Filtro de linha',
    '["outlets","input_voltage","max_current","power_w"]'::jsonb
  ),
  (
    'projector',
    'Projetor',
    '["resolution","brightness","video_inputs","lamp","network","power"]'::jsonb
  ),
  (
    'keyboard',
    'Teclado',
    '["connection","layout","wireless","power"]'::jsonb
  ),
  (
    'mouse',
    'Mouse',
    '["connection","dpi","wireless","power"]'::jsonb
  ),
  (
    'scanner',
    'Scanner',
    '["resolution","duplex","adf","connection","power"]'::jsonb
  ),
  (
    'barcode_scanner',
    'Leitor de código de barras',
    '["technology","connection","wireless","power"]'::jsonb
  ),
  (
    'webcam',
    'Webcam',
    '["resolution","fps","connection","microphone"]'::jsonb
  ),
  (
    'dock',
    'Dock station',
    '["host_connection","video_outputs","usb_ports","network","power_delivery"]'::jsonb
  ),
  (
    'nas',
    'NAS',
    '["bays","storage","raid","network","memory","processor","firmware","power"]'::jsonb
  )
on conflict (code)
do update set
  name = excluded.name,
  spec_fields = excluded.spec_fields,
  active = true,
  updated_at = now();

commit;

-- =====================================================================
-- 10. VALIDAÇÃO
-- =====================================================================

select
  'ti_manufacturers' as objeto,
  count(*) as registros
from public.ti_manufacturers

union all

select
  'ti_manufacturer_aliases',
  count(*)
from public.ti_manufacturer_aliases

union all

select
  'ti_equipment_categories',
  count(*)
from public.ti_equipment_categories

union all

select
  'ti_ocr_extraction_runs',
  count(*)
from public.ti_ocr_extraction_runs

union all

select
  'ti_ocr_extraction_fields',
  count(*)
from public.ti_ocr_extraction_fields

order by objeto;