# INVENTÁRIO TI — MASTER CONTEXT — INSTÂNCIA 2

## 1. Identidade

Produto oficial:

`Inventário TI`

Esta é a segunda instalação independente do produto. Ela não compartilha banco, autenticação, evidências, hospedagem ou usuários com a instalação original.

A identidade institucional é configurável pelo próprio aplicativo. O nome técnico histórico `wisdom-ti`, prefixos patrimoniais `WIS-*` e nomes internos do agente podem permanecer para compatibilidade.

## 2. Estado atual

Base funcional concluída:

- M01 — fundação visual e estrutural;
- M02 — Supabase, Auth, RBAC e RLS;
- M03 — unidades, ambientes e patrimônio;
- M04 — estoque e componentes;
- M05 — auditorias físicas e QR Code;
- M06 — fotos/evidências e Google Drive;
- M07 — manutenção, ciclo de vida e descarte;
- M08 — administração;
- M09 — agente Windows, inventário automático, divergências e alertas;
- M09 V2 — instalador gráfico do agente + armazenamento + softwares;
- M10 — branding institucional + etiquetas + dashboard + relatórios;
- M11 base — hardening/PWA/Cloudflare herdado do produto original.

Status da duplicação da Instância 2:

- GitHub independente: OK;
- clone local independente: OK;
- Supabase independente: OK;
- migrations M02–M10: OK;
- Edge Functions: OK;
- Google Apps Script: OK;
- Google Drive: OK;
- secrets de integração: OK;
- frontend local: OK;
- primeiro administrador: OK;
- login/RBAC: OK;
- teste end-to-end Auth → RBAC → Edge Function → Apps Script → Drive: OK;
- Cloudflare Pages 2: PENDENTE.

## 3. Ambiente e repositório

Projeto local:

`C:\Projetos\Inventario TI - Instancia 2\inventario-ti`

Repositório oficial desta instância:

`https://github.com/juliocpsprof-afk/Inventario-TI.git`

Branch:

`main`

Ambiente local:

- Windows;
- VS Code;
- Windows PowerShell 5.1;
- Git/GitHub;
- Node/npm;
- Supabase CLI;
- .NET 10 SDK.

Backups e segredos locais da duplicação ficam fora do repositório.

## 4. Supabase oficial

Project Ref:

`yresuszqnakdxupewtsf`

Project URL:

`https://yresuszqnakdxupewtsf.supabase.co`

Regra permanente:

- frontend, scripts operacionais, Edge Functions e agente desta instância devem usar somente esse projeto;
- não apontar a Instância 2 para outro Supabase;
- validar o Project Ref antes de deploys administrativos.

## 5. Variáveis e secrets

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Valor esperado para `VITE_SUPABASE_URL`:

`https://yresuszqnakdxupewtsf.supabase.co`

M06 / Edge Functions:

- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`

Google Apps Script:

- `WISDOM_SHARED_SECRET`
- `WISDOM_ROOT_FOLDER_ID`

Nunca versionar valores reais de secrets.

Nunca colocar no frontend ou no agente:

- service_role;
- secret key;
- senha PostgreSQL;
- senha administrativa;
- Google shared secret;
- Supabase access token;
- tokens administrativos.

## 6. Banco e migrations

Histórico remoto/local validado com:

`supabase db push --dry-run --include-all`

Resultado esperado e já obtido:

`Remote database is up to date.`

Migrations:

- `20260813_190000_m02_foundation.sql`
- `20260814_090000_m03_assets_locations.sql`
- `20260815_090000_m04_stock_components.sql`
- `20260818_160000_m05_auditorias_qr.sql`
- `20260820_090000_m06_evidence_metadata.sql`
- `20260825_093600_m07_maintenance_lifecycle.sql`
- `20260826110000_m08_administration.sql`
- `20260826150000_m09_agent_inventory_alerts.sql`
- `20260826170000_m10_consolidation_branding_reports.sql`

### Recuperação de migrations

As migrations M03, M04 e M06 não existiam no repositório recebido pela Instância 2.

Elas foram reconstruídas usando:

- contrato real do frontend;
- contratos das Edge Functions;
- validadores;
- documentação;
- dependências das migrations posteriores.

As migrations M08/M09/M10 originalmente compartilhavam uma versão curta `20260826`. A CLI usa a versão da migration como chave única no histórico remoto. Elas foram normalizadas para versões únicas:

- M08 → `20260826110000`
- M09 → `20260826150000`
- M10 → `20260826170000`

O histórico remoto foi normalizado e o banco foi validado após essa alteração.

Regra:

não renomear nem reescrever novamente migrations já aplicadas sem necessidade técnica concreta.

## 7. Estrutura consolidada do banco

### M02

- roles
- permissions
- role_permissions
- profiles
- units
- environments
- audit_logs
- `has_permission(text)`
- `get_my_access_context()`

### M03

- asset_types
- assets
- asset_movements
- asset_code_seq
- `move_asset()`

### M04

- stock_products
- stock_units
- asset_components
- stock_movements
- stock_unit_code_seq
- `install_stock_unit()`
- `remove_stock_unit()`
- `move_stock_unit()`
- `change_stock_unit_status()`

### M05

- audit_cycles
- audit_items
- audit_scan_events
- audit_cycle_code_seq
- `create_physical_audit()`
- `register_audit_scan()`
- `update_audit_item_note()`
- `close_physical_audit()`
- `cancel_physical_audit()`

### M06

- evidence_categories
- evidence_files

### M07

- maintenance_orders
- maintenance_parts
- maintenance_events
- asset_lifecycle_events
- asset_disposals
- RPCs de manutenção, baixa e descarte

### M08

- system_settings
- `update_system_setting()`

### M09

- agent_devices
- agent_inventory_expectations
- agent_inventory_snapshots
- agent_divergences
- system_alerts
- `set_asset_inventory_expectation()`
- `update_system_alert_status()`
- `refresh_agent_connectivity_alerts()`

### M10

- permissão `reports.view`
- bucket `institution-branding`
- setting `branding.logo_path`
- `get_public_branding()`
- `get_dashboard_summary()`
- `get_operational_report(text)`

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

O backend é a autoridade de permissão. O frontend pode ocultar ações, mas isso não substitui RLS/RBAC/RPC/Edge Function.

## 9. Edge Functions

Publicadas na Instância 2:

- `drive-health`
- `evidence-upload`
- `evidence-file`
- `evidence-revoke`
- `admin-users`
- `agent-admin`
- `agent-ingest`

`agent-ingest` usa autenticação própria do agente e foi publicado sem verificação JWT do gateway.

As demais funções seguem Auth/RBAC do produto.

## 10. Evidências e Google Drive

Arquitetura:

React
→ Supabase Auth/RBAC
→ Supabase Edge Function
→ Google Apps Script
→ Google Drive

Apps Script Web App:

`https://script.google.com/macros/s/AKfycbzbakPvXXvFIlj3zOELl9pRFpSb9NJaWjkp77O3b07izbAmA4XcjEMYwHqWWYLAiunIMQ/exec`

Google Drive root folder ID:

`1COGqF8q93BSwWkhQKPayF337HpzAIkxk`

Pastas-base validadas:

- Ativos
- Auditorias
- Estoque
- Documentos Gerais

Limite atual de evidência:

5 MB.

Categorias:

- registration
- audit
- movement
- maintenance
- disposal
- stock
- other

Revogação:

- lógica;
- não destrutiva;
- metadados preservados.

Teste realizado e aprovado:

Supabase Auth
→ RBAC `settings.manage`
→ `drive-health`
→ Supabase secrets
→ Apps Script
→ Google Drive.

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

## 14. Manutenção e ciclo de vida

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

## 15. Administração

Usuários:

- convite real;
- mudança de papel;
- ativação;
- desativação;
- proteção contra remover último admin;
- auditoria.

Primeiro administrador da Instância 2:

- criado;
- autenticação validada;
- acesso administrativo validado.

Não registrar e-mail ou senha neste documento.

Configurações:

- system_settings;
- identidade institucional;
- logo;
- parâmetros operacionais.

## 16. Branding

Nome genérico:

`Inventário TI`

Branding configurável:

- nome institucional;
- e-mail de suporte;
- logo PNG.

Storage:

bucket `institution-branding`

Objeto:

`institution/logo.png`

Regras:

- PNG;
- até 2 MB;
- leitura pública;
- escrita protegida por `settings.manage`.

## 17. Dashboard e relatórios

Dashboard:

- dados reais;
- ativos;
- estoque;
- manutenção;
- auditorias;
- alertas;
- agentes;
- divergências;
- saúde operacional.

Relatórios:

- assets;
- stock;
- audits;
- maintenance;
- alerts;
- agents.

Permissão:

`reports.view`

Exportação:

CSV UTF-8.

Limite backend atual:

5000 registros por execução.

## 18. Agente Windows

Projetos:

- `agent/WisdomTI.Agent`
- `agent/WisdomTI.Agent.Setup`

Runtime:

- .NET 10;
- win-x64 self-contained;
- instalador WinForms.

Autenticação:

- token individual começando com `wti_`;
- SHA-256 armazenado no banco;
- MachineGuid;
- HTTPS.

Coleta:

- hostname;
- fabricante;
- modelo;
- serial;
- Windows;
- CPU;
- RAM;
- discos;
- softwares.

Heartbeat:

15 minutos.

Offline:

mais de 30 minutos sem comunicação.

Categorias de alerta:

- connectivity
- identity
- hardware
- software
- health

Antes de distribuir o agente da Instância 2, todo endpoint Supabase embutido no instalador/scripts deve apontar para:

`https://yresuszqnakdxupewtsf.supabase.co`

## 19. PWA e Cloudflare

Base PWA/hardening já existente:

- Vite;
- vite-plugin-pwa;
- `public/_redirects`;
- `public/_headers`;
- CSP;
- cache;
- robots noindex;
- ConnectivityBanner;
- preparação de smoke tests.

Cloudflare Pages da Instância 2:

`PENDENTE`

Configuração esperada:

- repositório: `juliocpsprof-afk/Inventario-TI`
- branch: `main`
- build command: `npm run build`
- output directory: `dist`
- root directory: vazio
- variáveis:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

Após obter a URL Pages:

- configurar URL de convite/redirect quando necessário;
- executar smoke test;
- validar login;
- validar PWA;
- validar QR/câmera em HTTPS;
- atualizar este documento com a URL oficial.

## 20. Segurança

Nunca versionar:

- `.env.local`;
- senha PostgreSQL;
- Supabase access token;
- service_role;
- Supabase secret key;
- Google shared secret;
- senha administrativa;
- tokens individuais do agente.

Operações críticas devem registrar:

- usuário;
- data/hora;
- ação;
- antes/depois quando aplicável;
- justificativa quando necessária.

## 21. Testes realizados na duplicação

- mirror GitHub com histórico: OK;
- clone local separado: OK;
- Supabase link: OK;
- migrations M02–M10: OK;
- migration history: OK;
- dry-run remoto: `Remote database is up to date`;
- dependências npm: OK;
- TypeScript/Vite build: OK;
- lint: 0 erros; warnings não bloqueantes;
- Edge Functions publicadas: OK;
- Apps Script health: OK;
- Google Drive root: OK;
- pastas-base: OK;
- Supabase secrets: OK;
- `.env.local`: OK;
- primeiro admin: OK;
- login administrativo: OK;
- RBAC: OK;
- `drive-health` end-to-end: OK.

## 22. Pendências

Bloqueantes para go-live:

1. normalizar referências operacionais da instalação;
2. commit/push da Instância 2;
3. criar Cloudflare Pages na nova conta;
4. cadastrar variáveis do frontend;
5. obter URL Pages;
6. revisar redirects/site URL;
7. executar smoke test de produção;
8. validar agente da Instância 2;
9. atualizar este MASTER_CONTEXT após go-live.

Não bloqueantes:

- assinatura digital do agente;
- auto-update do agente;
- ARM64;
- observabilidade avançada;
- paginação/exportação em lote.

## 23. Próxima etapa

Etapa imediata após este contexto:

`CLOUDFLARE PAGES — INSTÂNCIA 2`

## 24. Retomada em novo chat

Ao iniciar novo chat:

1. ler este documento primeiro;
2. tratar esta instalação como totalmente independente;
3. repositório oficial: `https://github.com/juliocpsprof-afk/Inventario-TI.git`;
4. Supabase oficial: `yresuszqnakdxupewtsf`;
5. URL Supabase: `https://yresuszqnakdxupewtsf.supabase.co`;
6. Apps Script/Drive já estão conectados;
7. primeiro admin/login já foram validados;
8. banco M02–M10 já está aplicado;
9. M03/M04/M06 foram recuperadas;
10. M08/M09/M10 possuem versões normalizadas;
11. não reconstruir M01–M10 sem regressão concreta;
12. próxima grande etapa: Cloudflare Pages 2 + go-live.