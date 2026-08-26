# INVENTÁRIO TI — MASTER CONTEXT

## 1. Identidade do produto

Nome genérico oficial do aplicativo:

`Inventário TI`

O nome anterior do produto não deve ser usado como marca principal da interface.

A organização usuária pode personalizar:

- nome institucional;
- logomarca PNG;
- e-mail de suporte;
- demais parâmetros institucionais disponíveis em Administração → Configurações.

Fallback:

- quando não houver identidade institucional configurada, usar `Inventário TI`.

Repositório e nomes técnicos internos podem continuar usando `wisdom-ti` para preservar compatibilidade e histórico.

## 2. Estado atual

Projeto funcional concluído até:

M10 — Consolidação operacional + identidade institucional + dashboard real + relatórios.

Marcos concluídos:

- M01 — Fundação visual e estrutural.
- M02 — Supabase, Auth, RBAC e RLS.
- M03 — Unidades, ambientes e patrimônio.
- M04 — Estoque e componentes.
- M05 — Auditorias físicas e QR Code.
- M06 — Fotos/evidências e Google Drive.
- M07 — Manutenção, ciclo de vida e descarte.
- M08 — Administração real.
- M09 — Agente Windows, inventário automático, divergências e alertas reais.
- M09 V2 — Instalador gráfico do agente + armazenamento + softwares.
- M10 — Branding institucional + etiquetas + dashboard real + relatórios + preparação PWA/Cloudflare.

Status funcional:

`M10 FUNCIONAL OK`

Não reconstruir M01–M10 sem evidência concreta de regressão.

Próximo marco:

M11 — Produção, Cloudflare Pages, hardening e distribuição do agente.

## 3. Repositório e ambiente

Projeto local:

`C:\Projetos\TI Wisdom\wisdom-ti`

Backups:

`C:\Projetos\TI Wisdom\_backups\wisdom-ti`

Build externo do agente:

`C:\Projetos\TI Wisdom\_builds\wisdom-ti-agent`

Repositório:

`https://github.com/wisdomcontrole-ssa/Wisdom-TI.git`

Branch:

`main`

Ambiente principal:

- Windows;
- VS Code;
- Windows PowerShell 5.1;
- Git/GitHub;
- Node/npm;
- Supabase CLI;
- .NET 10 SDK.

## 4. Supabase oficial

Project Ref:

`dqfbzsneaamihfphjfcj`

Project URL:

`https://dqfbzsneaamihfphjfcj.supabase.co`

Regra permanente:

- SQL, Edge Functions, ambiente frontend e agente devem apontar para esse projeto;
- não usar outros projetos Supabase existentes na conta;
- validar Project Ref antes de deploys administrativos.

## 5. Stack consolidada

Frontend/PWA:

- React;
- TypeScript;
- Vite;
- Tailwind CSS;
- React Router;
- Lucide;
- vite-plugin-pwa;
- html5-qrcode;
- react-qr-code.

Backend:

- Supabase PostgreSQL;
- Supabase Auth;
- RLS;
- RBAC;
- RPCs PostgreSQL;
- Supabase Storage;
- Supabase Edge Functions;
- pg_cron.

Evidências:

React → Supabase → Edge Function → Google Apps Script → Google Drive.

Agente Windows:

- C#/.NET 10;
- self-contained win-x64;
- WinForms para instalador gráfico;
- CIM/PowerShell interno para inventário;
- HTTPS;
- token individual;
- MachineGuid;
- tarefas agendadas;
- heartbeat;
- histórico de snapshots.

Hospedagem:

- preparada para Cloudflare Pages;
- publicação de produção ainda é pendência do M11.

## 6. Variáveis e secrets

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

M06 Edge Functions:

- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`

Google Apps Script:

- `WISDOM_SHARED_SECRET`
- `WISDOM_ROOT_FOLDER_ID`

Nunca versionar valores reais.

Nunca colocar no frontend ou agente:

- service_role;
- secret key;
- senha PostgreSQL;
- senha administrativa;
- secrets Google;
- tokens administrativos.

## 7. Segurança

Backend é a autoridade de permissão.

Frontend pode ocultar ações, mas isso não substitui:

- RLS;
- RBAC;
- validação em RPC;
- validação em Edge Function.

Operações críticas devem registrar:

- usuário;
- data/hora;
- ação;
- antes/depois quando aplicável;
- justificativa quando necessária.

Agente:

- token começa com `wti_`;
- banco guarda hash SHA-256;
- token é individual;
- token pode ser rotacionado;
- agente pode ser revogado;
- MachineGuid impede reutilização indevida em outra máquina;
- HTTPS obrigatório.

Branding:

- logomarca é pública por desenho, pois precisa aparecer antes do login e nas etiquetas;
- escrita da logo exige `settings.manage`;
- somente PNG;
- limite de 2 MB;
- arquivo público não contém informação sensível.

## 8. RBAC

Papéis:

- admin
- manager
- technician
- auditor
- viewer

Permissões principais:

- dashboard.view
- assets.view
- assets.create
- assets.update
- assets.move
- assets.retire
- stock.view
- stock.move
- stock.adjust
- audits.view
- audits.create
- audits.execute
- audits.close
- alerts.view
- alerts.manage
- locations.view
- locations.manage
- reports.view
- users.view
- users.manage
- settings.view
- settings.manage
- logs.view

Funções-base:

- `public.has_permission(text)`
- `public.get_my_access_context()`

## 9. Banco consolidado

M02:

- roles
- permissions
- role_permissions
- profiles
- units
- environments
- audit_logs

M03:

- asset_types
- assets
- asset_movements
- asset_code_seq
- `move_asset()`

M04:

- stock_products
- stock_units
- asset_components
- stock_movements
- stock_unit_code_seq
- `install_stock_unit()`
- `remove_stock_unit()`
- `move_stock_unit()`
- `change_stock_unit_status()`

M05:

- audit_cycles
- audit_items
- audit_scan_events
- audit_cycle_code_seq
- `create_physical_audit()`
- `register_audit_scan()`
- `update_audit_item_note()`
- `close_physical_audit()`
- `cancel_physical_audit()`

M06:

- evidence_categories
- evidence_files

M07:

- maintenance_orders
- maintenance_parts
- maintenance_events
- asset_lifecycle_events
- asset_disposals

M07 RPCs:

- `create_maintenance_order()`
- `update_maintenance_order()`
- `add_maintenance_part()`
- `remove_maintenance_part()`
- `complete_maintenance_order()`
- `cancel_maintenance_order()`
- `retire_asset()`
- `dispose_asset()`

M08:

- system_settings
- `update_system_setting()`

M09:

- agent_devices
- agent_inventory_expectations
- agent_inventory_snapshots
- agent_divergences
- system_alerts

M09 RPCs:

- `set_asset_inventory_expectation()`
- `update_system_alert_status()`
- `refresh_agent_connectivity_alerts()`

M10:

- nova permissão `reports.view`;
- bucket Storage `institution-branding`;
- setting `branding.logo_path`;
- `get_public_branding()`;
- `get_dashboard_summary()`;
- `get_operational_report(text)`.

Migração M10:

`supabase/migrations/20260826_170000_m10_consolidation_branding_reports.sql`

Histórico SQL:

`supabase/sql-history/M10_SUPABASE.sql`

SQL M10 aplicado e funcionalmente validado no projeto oficial.

## 10. Edge Functions

M06:

- drive-health
- evidence-upload
- evidence-file
- evidence-revoke

M08:

- admin-users

M09:

- agent-admin
- agent-ingest

M10:

- nenhuma nova Edge Function;
- nenhum novo secret.

## 11. Patrimônio

Código:

`WIS-{TIPO}-{000000}`

Status:

- active
- stock
- maintenance
- retired
- disposed

Funcionalidades:

- cadastro;
- edição;
- consulta;
- filtros;
- movimentação;
- histórico;
- componentes;
- evidências;
- QR Code;
- etiqueta;
- manutenção;
- baixa;
- descarte;
- agente;
- inventário automático;
- baseline;
- divergências.

QR:

`/ativo/{asset_code}`

## 12. Estoque

Código:

`WIS-CMP-{TIPO}-{000000}`

Rastreabilidade:

- origem;
- destino;
- unidade;
- ambiente;
- instalação em ativo;
- remoção;
- mudança de status;
- histórico não destrutivo.

## 13. Auditorias

Código:

`AUD-{ANO}-{000000}`

Resultados:

- pending
- found
- missing
- divergent
- extra
- unknown_code

Métodos:

- QR;
- câmera;
- imagem;
- manual;
- arquivo.

## 14. Evidências

Arquitetura oficial:

React → Supabase Auth/RBAC → Edge Function → Google Apps Script → DriveApp → Google Drive.

Categorias:

- registration
- audit
- movement
- maintenance
- disposal
- stock
- other

Limite:

5 MB.

Revogação:

- lógica;
- não destrutiva;
- preserva metadados.

## 15. Manutenção e ciclo de vida

Códigos:

- `MAN-{ANO}-{000000}`
- `DSC-{ANO}-{000000}`

Regras:

- uma manutenção ativa por ativo;
- abertura coloca ativo em maintenance;
- conclusão define status final;
- cancelamento restaura ciclo;
- descarte exige retired;
- descarte bloqueado com componente instalado;
- histórico preservado.

Rotas:

- `/manutencoes`
- `/manutencoes/:maintenanceId`

## 16. Administração

Usuários:

- convite real;
- mudança de papel;
- ativação;
- desativação;
- proteção contra remover último admin;
- auditoria.

Logs:

- audit_logs reais;
- filtros;
- before/after;
- metadata.

Configurações:

- system_settings;
- identidade institucional;
- logo;
- parâmetros operacionais.

## 17. Agente Windows

### 17.1 Projeto

Agente:

`agent/WisdomTI.Agent`

Instalador gráfico:

`agent/WisdomTI.Agent.Setup`

Build:

`.NET 10`

Runtime:

`win-x64 self-contained`

Instalador oficial:

`WisdomTI-Agent-Setup.exe`

Fluxo normal:

1. abrir ativo;
2. criar/rotacionar token;
3. copiar token;
4. executar Setup EXE;
5. aceitar UAC;
6. colar token;
7. instalar.

PowerShell não faz parte do fluxo normal do usuário.

### 17.2 Coleta

Máquina:

- MachineGuid;
- hostname;
- fabricante;
- modelo;
- serial.

Sistema:

- Windows;
- versão;
- build;
- arquitetura;
- boot.

Hardware:

- CPU;
- cores;
- processadores lógicos;
- RAM.

Armazenamento:

- volume;
- capacidade;
- livre;
- usado;
- disco de sistema.

Software:

- nome;
- versão;
- publisher;
- HKLM 64-bit;
- WOW6432Node;
- HKCU;
- deduplicação;
- limite de 2000.

### 17.3 Heartbeat

Tarefas:

- `Wisdom TI Agent - Startup`
- `Wisdom TI Agent - Heartbeat`

Heartbeat:

15 minutos.

Offline:

mais de 30 minutos sem comunicação.

### 17.4 Alertas

Categorias:

- connectivity
- identity
- hardware
- software
- health

Status:

- open
- acknowledged
- resolved

## 18. M10 — Identidade institucional

Nome genérico:

`Inventário TI`

Contexto:

`src/branding/BrandContext.tsx`

Serviço:

`src/branding/branding-service.ts`

Marca dinâmica:

`src/components/brand/WisdomMark.tsx`

Administração:

`src/pages/SettingsPage.tsx`

Storage:

bucket `institution-branding`

Objeto:

`institution/logo.png`

Regras:

- PNG;
- máximo 2 MB;
- leitura pública;
- insert/update/delete somente com `settings.manage`.

RPC público:

`get_public_branding()`

Expõe somente:

- product_name;
- organization_name;
- support_email;
- logo_path;
- updated_at.

Não expõe configurações administrativas ou secrets.

Uso:

- login;
- sidebar/menu;
- cabeçalhos apropriados;
- etiqueta patrimonial.

## 19. Etiqueta patrimonial M10

Componente:

`src/components/assets/AssetQrLabelCard.tsx`

A etiqueta imprime:

- logo institucional quando configurada;
- nome da instituição;
- Inventário TI;
- código patrimonial;
- QR Code;
- tipo do ativo;
- fabricante/modelo;
- serial quando existente.

Formato de impressão preparado para etiqueta compacta.

Fallback sem logo continua funcional.

## 20. Dashboard real M10

Página:

`src/pages/DashboardPage.tsx`

Serviço:

`getDashboardSummary()`

RPC:

`get_dashboard_summary()`

Indicadores:

- total de ativos;
- ativos em operação;
- estoque;
- manutenções;
- auditorias;
- alertas;
- agentes online/offline;
- divergências;
- ativos sem localização;
- saúde operacional;
- alertas recentes;
- manutenções recentes.

Não usar mock no dashboard concluído.

## 21. Relatórios M10

Rota:

`/relatorios`

Página:

`src/pages/ReportsPage.tsx`

Permissão:

`reports.view`

RPC:

`get_operational_report(text)`

Relatórios:

- assets;
- stock;
- audits;
- maintenance;
- alerts;
- agents.

Funcionalidades:

- consulta;
- filtro/busca;
- tabela responsiva;
- exportação CSV UTF-8;
- limite backend de 5000 registros por execução.

## 22. PWA e preparação Cloudflare

Nome PWA:

`Inventário TI`

Arquivos principais:

- `vite.config.ts`
- `public/inventario-ti.svg`
- `public/_redirects`

SPA fallback:

`/* /index.html 200`

Code splitting:

- React;
- Supabase;
- QR.

A publicação real em Cloudflare Pages ainda não foi executada.

Documento:

`docs/M10_DEPLOY_CLOUDFLARE.md`

## 23. Rotas atuais

- /login
- /dashboard
- /patrimonio
- /patrimonio/:assetId
- /ativo/:assetCode
- /estoque
- /estoque/:stockUnitId
- /auditorias
- /auditorias/:auditId
- /manutencoes
- /manutencoes/:maintenanceId
- /alertas
- /ambientes
- /relatorios
- /usuarios
- /logs
- /configuracoes
- /sem-permissao

## 24. Testes M10 realizados

M10 foi validado funcionalmente pelo usuário.

Validações:

- instalação macrobloco OK;
- TypeScript build OK;
- Vite build OK;
- lint sem erros bloqueantes;
- SQL M10 aplicado;
- branding funcional;
- logo PNG funcional;
- identidade no aplicativo;
- etiqueta personalizada funcional;
- dashboard real funcional;
- relatórios funcionais;
- busca de relatórios funcional;
- CSV funcional;
- regressão operacional aceita;
- resultado final: `M10 FUNCIONAL OK`.

## 25. Bugs conhecidos / observações

Agente:

- ainda sem assinatura digital;
- SmartScreen pode alertar;
- atualização automática do agente ainda não implementada.

PWA:

- manifest usa identidade genérica Inventário TI;
- nome/logo da instituição são carregados dinamicamente após iniciar o app.

Relatórios:

- limite atual de 5000 registros por execução;
- paginação/exportação em lote pode ser adicionada se escala exigir.

Branding:

- apenas PNG;
- limite 2 MB;
- substituir a logo reutiliza o mesmo objeto público com versionamento por query string.

Cloudflare:

- ainda não publicado em produção.

## 26. Próximo marco — M11

M11 — Produção + hardening final.

Macroescopo:

1. Cloudflare Pages:
   - conectar GitHub;
   - configurar build;
   - cadastrar variáveis frontend;
   - domínio;
   - HTTPS;
   - deploy;
   - rollback;
   - smoke tests.

2. PWA:
   - instalação real;
   - atualização;
   - cache;
   - offline controlado;
   - câmera/QR em HTTPS.

3. Hardening:
   - revisão RLS/RBAC;
   - revisão Storage;
   - CSP/headers;
   - tratamento de erros;
   - rate limiting onde aplicável;
   - retenção de snapshots;
   - observabilidade;
   - backups/restore.

4. Agente:
   - assinatura digital;
   - versionamento formal;
   - estratégia de update;
   - distribuição;
   - documentação para técnicos.

5. Produção:
   - smoke tests completos;
   - checklist operacional;
   - documentação de implantação;
   - atualização final deste MASTER_CONTEXT.

## 27. Retomada

Ao iniciar novo chat:

1. ler `docs/MASTER_CONTEXT.md`;
2. considerar M01–M10 concluídos;
3. não reconstruir módulos anteriores sem regressão concreta;
4. Supabase oficial é `dqfbzsneaamihfphjfcj`;
5. produto genérico é `Inventário TI`;
6. branding institucional é configurável;
7. agente Windows está funcional;
8. dashboard e relatórios usam dados reais;
9. próximo marco é M11 — publicação/hardening.

