-- M18: etiquetas antecipadas e resgate atomico, executar em AMBOS os projetos
begin;
create table if not exists public.preprinted_labels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  batch_id uuid not null,
  state text not null default 'reserved' check (state in ('reserved','claimed')),
  asset_id uuid references public.assets(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  constraint preprinted_labels_claim_integrity check ((state='reserved' and asset_id is null and claimed_at is null) or (state='claimed' and asset_id is not null and claimed_at is not null)),
  constraint preprinted_labels_code_format check (code ~ '^QR-[A-F0-9]{12}$')
);
create unique index if not exists preprinted_labels_asset_uidx on public.preprinted_labels(asset_id) where asset_id is not null;
create index if not exists preprinted_labels_batch_idx on public.preprinted_labels(batch_id,created_at);
alter table public.preprinted_labels enable row level security;
revoke all on public.preprinted_labels from public, anon, authenticated;
grant select on public.preprinted_labels to authenticated;
drop policy if exists m18_labels_select on public.preprinted_labels;
create policy m18_labels_select on public.preprinted_labels for select to authenticated using (public.has_permission('assets.view'));

create or replace function public.m18_issue_labels(p_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_batch uuid := gen_random_uuid(); v_code text; v_codes text[] := '{}'; v_attempt integer; v_i integer;
begin
  if auth.uid() is null or not public.has_permission('assets.create') then raise exception 'Sem permissao para emitir etiquetas.'; end if;
  if p_count < 1 or p_count > 100 then raise exception 'Quantidade deve estar entre 1 e 100.'; end if;
  for v_i in 1..p_count loop
    v_attempt := 0;
    loop
      v_attempt := v_attempt + 1;
      if v_attempt > 50 then raise exception 'Falha ao gerar codigo exclusivo.'; end if;
      v_code := 'QR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
      -- Nao ocupar qualquer codigo historico/ativo/estoque que ja exista.
      if exists(select 1 from public.assets where upper(asset_code)=v_code) then continue; end if;
      if exists(select 1 from public.stock_units where upper(stock_code)=v_code or upper(short_code)=v_code) then continue; end if;
      insert into public.preprinted_labels(code,batch_id,created_by) values(v_code,v_batch,auth.uid()) on conflict(code) do nothing;
      exit when found;
    end loop;
    v_codes := array_append(v_codes,v_code);
  end loop;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data,metadata)
  values(auth.uid(),'labels.batch_issue','preprinted_labels',v_batch,null,jsonb_build_object('count',p_count),jsonb_build_object('codes',to_jsonb(v_codes)));
  return jsonb_build_object('batch_id',v_batch,'codes',to_jsonb(v_codes),'count',p_count);
end; $$;

create or replace function public.m18_get_label(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.preprinted_labels%rowtype;
begin
  if auth.uid() is null or not public.has_permission('assets.view') then raise exception 'Sem permissao para identificar etiquetas.'; end if;
  select * into v_row from public.preprinted_labels where code=upper(btrim(coalesce(p_code,'')));
  if not found then return null; end if;
  return jsonb_build_object('code',v_row.code,'state',v_row.state,'asset_id',v_row.asset_id,'batch_id',v_row.batch_id);
end; $$;

create or replace function public.m18_claim_label(
  p_code text, p_asset_type_id uuid, p_serial text default null,
  p_third_party text default null, p_manufacturer text default null,
  p_model text default null, p_origin text default 'used'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_label public.preprinted_labels%rowtype; v_asset public.assets%rowtype; v_serial text;
begin
  if auth.uid() is null or not public.has_permission('assets.create') then raise exception 'Sem permissao para cadastrar equipamentos.'; end if;
  if p_origin not in ('purchase','donation','used','transfer','other') then raise exception 'Origem invalida.'; end if;
  select * into v_label from public.preprinted_labels where code=upper(btrim(coalesce(p_code,''))) for update;
  if not found then raise exception 'Este QR nao pertence a um lote de etiquetas antecipadas.'; end if;
  if v_label.state='claimed' then return jsonb_build_object('asset_id',v_label.asset_id,'code',v_label.code,'already_claimed',true); end if;
  if not exists(select 1 from public.asset_types where id=p_asset_type_id and active) then raise exception 'Tipo inexistente ou inativo.'; end if;
  v_serial:=nullif(btrim(coalesce(p_serial,'')),'');
  if v_serial is not null and exists(select 1 from public.assets where upper(serial_number)=upper(v_serial)) then
    raise exception 'Serial ja cadastrado em outro patrimonio. Verifique antes de continuar.';
  end if;
  insert into public.assets(asset_code,asset_type_id,serial_number,manufacturer,model,status,registration_state,entry_origin)
  values(v_label.code,p_asset_type_id,v_serial,nullif(btrim(coalesce(p_manufacturer,'')),''),nullif(btrim(coalesce(p_model,'')),''),'stock','express_pending',p_origin)
  returning * into v_asset;
  if nullif(btrim(coalesce(p_third_party,'')),'') is not null then
    perform public.add_asset_external_identifier(v_asset.id,null,'patrimony',btrim(p_third_party),'Codigo de terceiro registrado pela etiqueta antecipada');
  end if;
  update public.preprinted_labels set state='claimed',asset_id=v_asset.id,claimed_at=now(),claimed_by=auth.uid() where id=v_label.id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data,metadata)
  values(auth.uid(),'labels.claim','assets',v_asset.id,jsonb_build_object('label_state','reserved'),to_jsonb(v_asset),jsonb_build_object('batch_id',v_label.batch_id,'code',v_label.code));
  return jsonb_build_object('asset_id',v_asset.id,'code',v_label.code,'already_claimed',false);
end; $$;

revoke all on function public.m18_issue_labels(integer) from public, anon, authenticated;
revoke all on function public.m18_get_label(text) from public, anon, authenticated;
revoke all on function public.m18_claim_label(text,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.m18_issue_labels(integer) to authenticated;
grant execute on function public.m18_get_label(text) to authenticated;
grant execute on function public.m18_claim_label(text,uuid,text,text,text,text,text) to authenticated;

-- Catalogo inicial: tipos existentes permanecem preservados.
insert into public.asset_types(code,name,description,active)
select seed.code,seed.name,'Tipo rapido M18',true from (values
('DT','Computador desktop'),('NB','Notebook'),('SRV','Servidor'),('MON','Monitor'),
('IMP','Impressora'),('MFP','Multifuncional'),('SW','Switch'),('RTR','Roteador'),
('AP','Access point Wi-Fi'),('FW','Firewall'),('NOB','Nobreak'),('EST','Estabilizador'),
('PRJ','Projetor'),('TCL','Teclado'),('MOU','Mouse'),('WBC','Webcam'),
('SCN','Scanner'),('LBC','Leitor de código de barras'),('NVR','NVR/DVR'),
('CAM','Câmera IP'),('NAS','NAS/Armazenamento'),('HDD','Disco rígido'),
('SSD','SSD'),('MEM','Memória RAM'),('CPU','Processador'),('MB','Placa-mãe'),
('FNT','Fonte de alimentação'),('VGA','Cabo VGA'),('HDM','Cabo HDMI'),
('USB','Cabo USB'),('NET','Cabo de rede'),('PWR','Cabo de energia'),
('DCK','Dock/Adaptador'),('HDS','Headset'),('TEL','Telefone IP'),
('TAB','Tablet'),('CEL','Celular'),('OTH','Outros itens')
) as seed(code,name)
where not exists(select 1 from public.asset_types t where upper(t.code)=seed.code);
commit;
