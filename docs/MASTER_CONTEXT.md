# INVENTÃRIO TI â€” MASTER CONTEXT â€” INSTÃ‚NCIA 2

## 1. Identidade e finalidade

Produto oficial:

`InventÃ¡rio TI`

Esta Ã© a INSTÃ‚NCIA 2 do produto, totalmente independente da instalaÃ§Ã£o original.

Isolamento da InstÃ¢ncia 2:

- repositÃ³rio GitHub prÃ³prio;
- Supabase prÃ³prio;
- banco PostgreSQL prÃ³prio;
- Auth/RBAC/RLS prÃ³prios;
- Google Drive prÃ³prio;
- Google Apps Script prÃ³prio;
- Cloudflare Pages prÃ³prio;
- usuÃ¡rios e dados prÃ³prios.

A identidade institucional continua configurÃ¡vel pelo aplicativo.

Nomes tÃ©cnicos histÃ³ricos como `WisdomTI.Agent`, prefixos `WIS-*` e algumas nomenclaturas internas podem permanecer por compatibilidade tÃ©cnica.

## 2. Status executivo

A aplicaÃ§Ã£o web da InstÃ¢ncia 2 estÃ¡ em PRODUÃ‡ÃƒO.

URL oficial:

`https://inventario-ti-9z1.pages.dev`

SituaÃ§Ã£o:

- GitHub independente: OK;
- Supabase independente: OK;
- migrations M02â€“M10: OK;
- Edge Functions: OK;
- Google Apps Script: OK;
- Google Drive: OK;
- frontend local: OK;
- frontend Cloudflare Pages: OK;
- primeiro administrador: OK;
- Auth/RBAC: OK;
- branding/configuraÃ§Ãµes: OK;
- redirect de convites: OK;
- PWA: OK;
- headers/CSP: OK;
- smoke tÃ©cnico de produÃ§Ã£o: OK;
- smoke manual autenticado em produÃ§Ã£o: OK;
- agente Windows: cÃ³digo/instalador jÃ¡ normalizados para o Supabase 2; empacotamento final da InstÃ¢ncia 2 ainda deve ser validado antes da distribuiÃ§Ã£o.

## 3. RepositÃ³rio e ambiente

Projeto local:

`C:\Projetos\Inventario TI - Instancia 2\inventario-ti`

RepositÃ³rio oficial:

`https://github.com/juliocpsprof-afk/Inventario-TI.git`

Branch:

`main`

Commit-base da normalizaÃ§Ã£o/go-live web:

`f535061b0b75aa49e07783f8f3eb9dd9f023f241`

Ambiente principal:

- Windows;
- VS Code;
- Windows PowerShell 5.1;
- Git/GitHub;
- Node/npm;
- Supabase CLI;
- .NET 10 SDK.

Backups e segredos locais ficam fora do repositÃ³rio.

## 4. Supabase oficial da InstÃ¢ncia 2

Project Ref:

`yresuszqnakdxupewtsf`

Project URL:

`https://yresuszqnakdxupewtsf.supabase.co`

Regra permanente:

- frontend, scripts operacionais, Edge Functions e agente desta instÃ¢ncia devem apontar somente para esse projeto;
- nÃ£o reutilizar o Supabase da instalaÃ§Ã£o original;
- validar Project Ref antes de deploy administrativo.

## 5. Frontend e variÃ¡veis

Frontend:

- React;
- TypeScript;
- Vite;
- Tailwind;
- PWA.

VariÃ¡veis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Valor esperado:

`VITE_SUPABASE_URL=https://yresuszqnakdxupewtsf.supabase.co`

A publishable key nÃ£o deve ser registrada neste documento.

`.env.local`:

- existe apenas no ambiente local;
- Ã© ignorado pelo Git;
- nÃ£o deve ser versionado.

Cloudflare Pages possui as mesmas duas variÃ¡veis no ambiente de build/produÃ§Ã£o.

## 6. Cloudflare Pages â€” produÃ§Ã£o

URL:

`https://inventario-ti-9z1.pages.dev`

ConfiguraÃ§Ã£o:

- repositÃ³rio: `juliocpsprof-afk/Inventario-TI`
- branch de produÃ§Ã£o: `main`
- framework preset: `None`
- build command: `npm run build`
- output directory: `dist`
- root directory: vazio
- env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

Auth do Supabase:

- Site URL configurada para `https://inventario-ti-9z1.pages.dev`
- Redirect URL de produÃ§Ã£o permitida
- configuraÃ§Ã£o interna `auth.invite_redirect_url` definida para `https://inventario-ti-9z1.pages.dev`

Smoke de produÃ§Ã£o aprovado:

- home HTTP 200;
- rotas SPA HTTP 200;
- headers de seguranÃ§a presentes;
- CSP aponta para Supabase 2;
- CSP nÃ£o aponta para Supabase original;
- manifest PWA disponÃ­vel;
- service worker disponÃ­vel;
- bundle contÃ©m Supabase 2;
- bundle nÃ£o contÃ©m Supabase original;
- login administrativo em produÃ§Ã£o: OK;
- VisÃ£o geral: OK;
- RelatÃ³rios: OK;
- ConfiguraÃ§Ãµes: OK;
- refresh direto em rota SPA: OK.

## 7. Banco e migrations

Dry-run remoto validado:

`supabase db push --dry-run --include-all`

Resultado:

`Remote database is up to date.`

Migrations atuais:

- `20260813_190000_m02_foundation.sql`
- `20260814_090000_m03_assets_locations.sql`
- `20260815_090000_m04_stock_components.sql`
- `20260818_160000_m05_auditorias_qr.sql`
- `20260820_090000_m06_evidence_metadata.sql`
- `20260825_093600_m07_maintenance_lifecycle.sql`
- `20260826110000_m08_administration.sql`
- `20260826150000_m09_agent_inventory_alerts.sql`
- `20260826170000_m10_consolidation_branding_reports.sql`

### RecuperaÃ§Ã£o da cadeia de migrations

No repositÃ³rio duplicado estavam ausentes as migrations originais M03, M04 e M06.

Elas foram reconstruÃ­das a partir do contrato atual do produto:

- frontend;
- Edge Functions;
- validadores;
- documentaÃ§Ã£o;
- dependÃªncias das migrations posteriores.

M08/M09/M10 originalmente compartilhavam o prefixo de versÃ£o `20260826`, incompatÃ­vel com o histÃ³rico Ãºnico da CLI.

Foram normalizadas para:

- M08 â†’ `20260826110000`
- M09 â†’ `20260826150000`
- M10 â†’ `20260826170000`

O histÃ³rico remoto foi reparado e reaplicado de forma idempotente.

Regra:

nÃ£o renomear nem reescrever migrations jÃ¡ aplicadas sem motivo tÃ©cnico concreto.

## 8. Estruturas de banco consolidadas

### M02 â€” FundaÃ§Ã£o

- roles
- permissions
- role_permissions
- profiles
- units
- environments
- audit_logs
- `has_permission(text)`
- `get_my_access_context()`

PapÃ©is:

- admin
- manager
- technician
- auditor
- viewer

### M03 â€” PatrimÃ´nio

- asset_types
- assets
- asset_movements
- asset_code_seq
- `move_asset()`

### M04 â€” Estoque/componentes

- stock_products
- stock_units
- asset_components
- stock_movements
- stock_unit_code_seq
- `install_stock_unit()`
- `remove_stock_unit()`
- `move_stock_unit()`
- `change_stock_unit_status()`

### M05 â€” Auditorias

- audit_cycles
- audit_items
- audit_scan_events
- audit_cycle_code_seq
- RPCs de criaÃ§Ã£o, leitura, fechamento e cancelamento

### M06 â€” EvidÃªncias

- evidence_categories
- evidence_files

### M07 â€” ManutenÃ§Ã£o/ciclo de vida

- maintenance_orders
- maintenance_parts
- maintenance_events
- asset_lifecycle_events
- asset_disposals
- RPCs de manutenÃ§Ã£o, baixa e descarte

### M08 â€” AdministraÃ§Ã£o/configuraÃ§Ã£o

- system_settings
- `update_system_setting()`

### M09 â€” Agente/inventÃ¡rio/alertas

- agent_devices
- agent_inventory_expectations
- agent_inventory_snapshots
- agent_divergences
- system_alerts
- `set_asset_inventory_expectation()`
- `update_system_alert_status()`
- `refresh_agent_connectivity_alerts()`

### M10 â€” Branding/dashboard/relatÃ³rios

- permissÃ£o `reports.view`
- bucket `institution-branding`
- setting `branding.logo_path`
- `get_public_branding()`
- `get_dashboard_summary()`
- `get_operational_report(text)`

## 9. RBAC

PermissÃµes principais:

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

Backend Ã© a autoridade de permissÃ£o.

O primeiro usuÃ¡rio administrativo da InstÃ¢ncia 2 foi criado e validado.

NÃ£o registrar e-mail nem senha neste arquivo.

## 10. Edge Functions

Publicadas:

- `drive-health`
- `evidence-upload`
- `evidence-file`
- `evidence-revoke`
- `admin-users`
- `agent-admin`
- `agent-ingest`

`agent-ingest` utiliza autenticaÃ§Ã£o prÃ³pria do agente e foi publicado sem verificaÃ§Ã£o JWT do gateway.

Demais funÃ§Ãµes seguem Supabase Auth/RBAC.

## 11. Google Drive / Apps Script

Arquitetura:

React
â†’ Supabase Auth/RBAC
â†’ Edge Function
â†’ Google Apps Script
â†’ Google Drive

Apps Script Web App:

`https://script.google.com/macros/s/AKfycbzbakPvXXvFIlj3zOELl9pRFpSb9NJaWjkp77O3b07izbAmA4XcjEMYwHqWWYLAiunIMQ/exec`

Drive root folder ID:

`1COGqF8q93BSwWkhQKPayF337HpzAIkxk`

Pastas-base:

- Ativos
- Auditorias
- Estoque
- Documentos Gerais

Supabase secrets â€” nomes:

- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`

Apps Script Properties â€” nomes:

- `WISDOM_SHARED_SECRET`
- `WISDOM_ROOT_FOLDER_ID`

O shared secret foi preservado localmente protegido por DPAPI e fora do repositÃ³rio.

Teste end-to-end aprovado:

Auth
â†’ RBAC `settings.manage`
â†’ `drive-health`
â†’ Supabase secrets
â†’ Apps Script
â†’ Google Drive.

## 12. EvidÃªncias

Limite:

5 MB.

MIME suportado pelo bridge:

- JPEG
- PNG
- WebP
- HEIC
- HEIF
- PDF

Categorias:

- registration
- audit
- movement
- maintenance
- disposal
- stock
- other

RevogaÃ§Ã£o Ã© lÃ³gica e nÃ£o destrutiva.

## 13. PatrimÃ´nio

CÃ³digo:

`WIS-{TIPO}-{000000}`

Status:

- active
- stock
- maintenance
- retired
- disposed

Funcionalidades:

- cadastro;
- ediÃ§Ã£o;
- consulta;
- filtros;
- movimentaÃ§Ã£o;
- histÃ³rico;
- componentes;
- evidÃªncias;
- QR Code;
- etiqueta;
- manutenÃ§Ã£o;
- baixa;
- descarte;
- inventÃ¡rio automÃ¡tico.

QR:

`/ativo/{asset_code}`

## 14. Estoque

CÃ³digo:

`WIS-CMP-{TIPO}-{000000}`

Rastreabilidade:

- origem;
- destino;
- localizaÃ§Ã£o;
- instalaÃ§Ã£o;
- remoÃ§Ã£o;
- vÃ­nculo componente â†” ativo;
- status;
- histÃ³rico.

## 15. Auditorias

CÃ³digo:

`AUD-{ANO}-{000000}`

Resultados:

- pending
- found
- missing
- divergent
- extra
- unknown_code

MÃ©todos:

- QR;
- cÃ¢mera;
- imagem;
- manual;
- arquivo.

## 16. ManutenÃ§Ã£o e ciclo de vida

CÃ³digos:

- `MAN-{ANO}-{000000}`
- `DSC-{ANO}-{000000}`

Regras:

- uma manutenÃ§Ã£o ativa por ativo;
- abertura coloca ativo em maintenance;
- conclusÃ£o define status final;
- cancelamento restaura ciclo;
- descarte exige retired;
- descarte bloqueado com componente instalado;
- histÃ³rico preservado.

## 17. Branding

Produto:

`InventÃ¡rio TI`

Branding institucional configurÃ¡vel:

- nome da organizaÃ§Ã£o;
- e-mail de suporte;
- logo PNG.

Storage:

- bucket `institution-branding`
- objeto `institution/logo.png`

Regras:

- PNG;
- atÃ© 2 MB;
- leitura pÃºblica;
- escrita protegida por `settings.manage`.

## 18. Dashboard e relatÃ³rios

Dashboard:

- ativos;
- estoque;
- manutenÃ§Ã£o;
- auditorias;
- alertas;
- agentes;
- divergÃªncias;
- saÃºde operacional.

RelatÃ³rios:

- assets
- stock
- audits
- maintenance
- alerts
- agents

PermissÃ£o:

`reports.view`

ExportaÃ§Ã£o:

CSV UTF-8.

Limite backend atual:

5000 registros por execuÃ§Ã£o.

## 19. Agente Windows

Projetos:

- `agent/WisdomTI.Agent`
- `agent/WisdomTI.Agent.Setup`

Runtime:

- .NET 10;
- win-x64 self-contained;
- instalador WinForms.

AutenticaÃ§Ã£o:

- token individual `wti_`;
- hash SHA-256 no banco;
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

mais de 30 minutos sem comunicaÃ§Ã£o.

Alertas:

- connectivity
- identity
- hardware
- software
- health

Os arquivos operacionais e o instalador foram normalizados para o Project Ref/URL da InstÃ¢ncia 2 durante a preparaÃ§Ã£o de produÃ§Ã£o.

Antes da distribuiÃ§Ã£o definitiva:

- executar build do agente;
- gerar instalador da InstÃ¢ncia 2;
- instalar em uma mÃ¡quina de teste;
- cadastrar token pelo fluxo administrativo;
- validar primeiro collect;
- validar snapshot;
- validar heartbeat;
- validar divergÃªncias/alertas;
- confirmar que nenhuma chamada alcanÃ§a o Supabase original.

## 20. SeguranÃ§a

Nunca versionar:

- `.env.local`;
- DB password;
- Supabase access token;
- service_role;
- Supabase secret key;
- Google shared secret;
- senha administrativa;
- tokens individuais do agente;
- arquivos DPAPI.

Credenciais administrativas nunca entram no frontend ou agente.

OperaÃ§Ãµes crÃ­ticas preservam:

- usuÃ¡rio;
- data/hora;
- aÃ§Ã£o;
- antes/depois;
- justificativa quando aplicÃ¡vel.

## 21. Testes concluÃ­dos na InstÃ¢ncia 2

### Banco

- migrations M02â€“M10: OK;
- history normalizado: OK;
- dry-run remoto: OK.

### Backend

- Edge Functions: OK;
- Supabase secrets: OK;
- RBAC administrativo: OK.

### Drive

- Apps Script health direto: OK;
- root folder: OK;
- pastas-base: OK;
- health end-to-end autenticado: OK.

### Frontend local

- dependÃªncias: OK;
- build: OK;
- lint: 0 erros bloqueantes;
- `.env.local`: OK;
- login administrativo: OK.

### ProduÃ§Ã£o Cloudflare

- deploy: OK;
- home: OK;
- SPA: OK;
- headers/CSP: OK;
- PWA: OK;
- Supabase 2 no bundle: OK;
- Supabase original ausente do bundle: OK;
- login admin em produÃ§Ã£o: OK;
- dashboard: OK;
- relatÃ³rios: OK;
- configuraÃ§Ãµes: OK;
- Ctrl+F5 em rota interna: OK.

## 22. PendÃªncias

### PrÃ³xima etapa bloqueante para duplicaÃ§Ã£o integral

`AGENTE WINDOWS â€” BUILD + INSTALADOR + TESTE NA INSTÃ‚NCIA 2`

### Depois do agente

- teste funcional amplo com dados de homologaÃ§Ã£o;
- validar uploads/revogaÃ§Ã£o de evidÃªncias pela interface;
- validar convite real de usuÃ¡rio;
- validar fluxo QR em dispositivo mÃ³vel;
- validar auditoria com cÃ¢mera em HTTPS;
- revisar branding institucional final.

### Backlog nÃ£o bloqueante

- domÃ­nio customizado;
- assinatura digital do agente;
- auto-update do agente;
- ARM64;
- observabilidade avanÃ§ada;
- paginaÃ§Ã£o/exportaÃ§Ãµes muito grandes.

## 23. PrÃ³xima etapa

PrÃ³xima grande etapa:

`M09 INSTÃ‚NCIA 2 â€” EMPACOTAMENTO E VALIDAÃ‡ÃƒO DO AGENTE WINDOWS`

Objetivo:

gerar e validar o instalador do agente apontando exclusivamente para:

`https://yresuszqnakdxupewtsf.supabase.co`

## 24. Retomada em novo chat

Ao abrir um novo chat:

1. ler este documento primeiro;
2. tratar esta instalaÃ§Ã£o como InstÃ¢ncia 2 independente;
3. repositÃ³rio: `https://github.com/juliocpsprof-afk/Inventario-TI.git`;
4. Supabase Project Ref: `yresuszqnakdxupewtsf`;
5. Supabase URL: `https://yresuszqnakdxupewtsf.supabase.co`;
6. produÃ§Ã£o: `https://inventario-ti-9z1.pages.dev`;
7. Apps Script/Drive jÃ¡ estÃ£o conectados;
8. primeiro admin/login jÃ¡ foram validados;
9. migrations M03/M04/M06 foram recuperadas;
10. M08/M09/M10 tiveram versÃµes normalizadas;
11. Auth Site URL e redirect de convite jÃ¡ estÃ£o configurados;
12. smoke tÃ©cnico/manual de produÃ§Ã£o foi aprovado;
13. nÃ£o reconstruir M01â€“M10 sem regressÃ£o concreta;
14. prÃ³xima etapa: build/instalador/teste do agente Windows da InstÃ¢ncia 2.

## M13 / DUAS INSTANCIAS - PRE-PUBLICACAO MOBILE

- Base canonica: C:\Projetos\Inventario TI - Canonico\inventario-ti.
- Instancia 1: GitHub wisdomcontrole-ssa/Wisdom-TI; Supabase dqfbzsneaamihfphjfcj; Cloudflare https://inventario-ti-8s6.pages.dev.
- Instancia 2: GitHub juliocpsprof-afk/Inventario-TI; Supabase yresuszqnakdxupewtsf; Cloudflare https://inventario-ti-9z1.pages.dev.
- M12 passa a integrar o mesmo historico de codigo das duas instancias.
- M13 adiciona OCR local PaddleOCR.js/PP-OCRv5, barcode antes do OCR, revisao humana, Service Tag/Product Number, garantia, NF, instituicoes externas, identificadores externos e busca inteligente.
- Artefatos pesados de OCR ficam fora do precache inicial da PWA e usam runtime cache.
- O mesmo commit deve ser publicado nos dois GitHubs.
- .env.local, secrets, Supabase, Drive e Cloudflare permanecem independentes por instancia.
- Alteracao pendente em gent/scripts/BUILD_AGENT_PACKAGE.ps1 da antiga pasta da Instancia 2 NAO faz parte deste commit M13.
- Estado atual: publicacao destinada a teste mobile/HTTPS antes do encerramento definitivo do M13.

## OCR Intelligence estruturado - 2026-09-16

- O fluxo de camera traseira e Tesseract ja publicado foi preservado.
- O motor `src/features/ocr-intelligence/` classifica texto OCR de forma deterministica.
- Fabricante, modelo, serial, CPU, RAM, armazenamento, placa-mae, sistema operacional, Wi-Fi e MAC sao tratados como dados estruturados.
- Apenas texto realmente nao classificado segue para Observacoes.
- `asset_technical_profiles` armazena o perfil tecnico atual.
- `asset_technical_profile_history` preserva historico nao destrutivo.
- `ti_ocr_extraction_runs` e `ti_ocr_extraction_fields` registram origem, regra e confianca.
- O mesmo SQL de perfil tecnico foi aplicado manualmente nas duas instancias Supabase.
- Teste Login L500 e build completo sao obrigatorios antes de publicacao.