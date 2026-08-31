# INVENTÁRIO TI — MASTER CONTEXT — INSTÂNCIA 2

## 1. Identidade e finalidade

Produto oficial:

`Inventário TI`

Esta é a INSTÂNCIA 2 do produto, totalmente independente da instalação original.

Isolamento da Instância 2:

- repositório GitHub próprio;
- Supabase próprio;
- banco PostgreSQL próprio;
- Auth/RBAC/RLS próprios;
- Google Drive próprio;
- Google Apps Script próprio;
- Cloudflare Pages próprio;
- usuários e dados próprios.

A identidade institucional continua configurável pelo aplicativo.

Nomes técnicos históricos como `WisdomTI.Agent`, prefixos `WIS-*` e algumas nomenclaturas internas podem permanecer por compatibilidade técnica.

## 2. Status executivo

A aplicação web da Instância 2 está em PRODUÇÃO.

URL oficial:

`https://inventario-ti-9z1.pages.dev`

Situação:

- GitHub independente: OK;
- Supabase independente: OK;
- migrations M02–M10: OK;
- Edge Functions: OK;
- Google Apps Script: OK;
- Google Drive: OK;
- frontend local: OK;
- frontend Cloudflare Pages: OK;
- primeiro administrador: OK;
- Auth/RBAC: OK;
- branding/configurações: OK;
- redirect de convites: OK;
- PWA: OK;
- headers/CSP: OK;
- smoke técnico de produção: OK;
- smoke manual autenticado em produção: OK;
- agente Windows: código/instalador já normalizados para o Supabase 2; empacotamento final da Instância 2 ainda deve ser validado antes da distribuição.

## 3. Repositório e ambiente

Projeto local:

`C:\Projetos\Inventario TI - Instancia 2\inventario-ti`

Repositório oficial:

`https://github.com/juliocpsprof-afk/Inventario-TI.git`

Branch:

`main`

Commit-base da normalização/go-live web:

`f535061b0b75aa49e07783f8f3eb9dd9f023f241`

Ambiente principal:

- Windows;
- VS Code;
- Windows PowerShell 5.1;
- Git/GitHub;
- Node/npm;
- Supabase CLI;
- .NET 10 SDK.

Backups e segredos locais ficam fora do repositório.

## 4. Supabase oficial da Instância 2

Project Ref:

`yresuszqnakdxupewtsf`

Project URL:

`https://yresuszqnakdxupewtsf.supabase.co`

Regra permanente:

- frontend, scripts operacionais, Edge Functions e agente desta instância devem apontar somente para esse projeto;
- não reutilizar o Supabase da instalação original;
- validar Project Ref antes de deploy administrativo.

## 5. Frontend e variáveis

Frontend:

- React;
- TypeScript;
- Vite;
- Tailwind;
- PWA.

Variáveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Valor esperado:

`VITE_SUPABASE_URL=https://yresuszqnakdxupewtsf.supabase.co`

A publishable key não deve ser registrada neste documento.

`.env.local`:

- existe apenas no ambiente local;
- é ignorado pelo Git;
- não deve ser versionado.

Cloudflare Pages possui as mesmas duas variáveis no ambiente de build/produção.

## 6. Cloudflare Pages — produção

URL:

`https://inventario-ti-9z1.pages.dev`

Configuração:

- repositório: `juliocpsprof-afk/Inventario-TI`
- branch de produção: `main`
- framework preset: `None`
- build command: `npm run build`
- output directory: `dist`
- root directory: vazio
- env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

Auth do Supabase:

- Site URL configurada para `https://inventario-ti-9z1.pages.dev`
- Redirect URL de produção permitida
- configuração interna `auth.invite_redirect_url` definida para `https://inventario-ti-9z1.pages.dev`

Smoke de produção aprovado:

- home HTTP 200;
- rotas SPA HTTP 200;
- headers de segurança presentes;
- CSP aponta para Supabase 2;
- CSP não aponta para Supabase original;
- manifest PWA disponível;
- service worker disponível;
- bundle contém Supabase 2;
- bundle não contém Supabase original;
- login administrativo em produção: OK;
- Visão geral: OK;
- Relatórios: OK;
- Configurações: OK;
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

### Recuperação da cadeia de migrations

No repositório duplicado estavam ausentes as migrations originais M03, M04 e M06.

Elas foram reconstruídas a partir do contrato atual do produto:

- frontend;
- Edge Functions;
- validadores;
- documentação;
- dependências das migrations posteriores.

M08/M09/M10 originalmente compartilhavam o prefixo de versão `20260826`, incompatível com o histórico único da CLI.

Foram normalizadas para:

- M08 → `20260826110000`
- M09 → `20260826150000`
- M10 → `20260826170000`

O histórico remoto foi reparado e reaplicado de forma idempotente.

Regra:

não renomear nem reescrever migrations já aplicadas sem motivo técnico concreto.

## 8. Estruturas de banco consolidadas

### M02 — Fundação

- roles
- permissions
- role_permissions
- profiles
- units
- environments
- audit_logs
- `has_permission(text)`
- `get_my_access_context()`

Papéis:

- admin
- manager
- technician
- auditor
- viewer

### M03 — Patrimônio

- asset_types
- assets
- asset_movements
- asset_code_seq
- `move_asset()`

### M04 — Estoque/componentes

- stock_products
- stock_units
- asset_components
- stock_movements
- stock_unit_code_seq
- `install_stock_unit()`
- `remove_stock_unit()`
- `move_stock_unit()`
- `change_stock_unit_status()`

### M05 — Auditorias

- audit_cycles
- audit_items
- audit_scan_events
- audit_cycle_code_seq
- RPCs de criação, leitura, fechamento e cancelamento

### M06 — Evidências

- evidence_categories
- evidence_files

### M07 — Manutenção/ciclo de vida

- maintenance_orders
- maintenance_parts
- maintenance_events
- asset_lifecycle_events
- asset_disposals
- RPCs de manutenção, baixa e descarte

### M08 — Administração/configuração

- system_settings
- `update_system_setting()`

### M09 — Agente/inventário/alertas

- agent_devices
- agent_inventory_expectations
- agent_inventory_snapshots
- agent_divergences
- system_alerts
- `set_asset_inventory_expectation()`
- `update_system_alert_status()`
- `refresh_agent_connectivity_alerts()`

### M10 — Branding/dashboard/relatórios

- permissão `reports.view`
- bucket `institution-branding`
- setting `branding.logo_path`
- `get_public_branding()`
- `get_dashboard_summary()`
- `get_operational_report(text)`

## 9. RBAC

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

Backend é a autoridade de permissão.

O primeiro usuário administrativo da Instância 2 foi criado e validado.

Não registrar e-mail nem senha neste arquivo.

## 10. Edge Functions

Publicadas:

- `drive-health`
- `evidence-upload`
- `evidence-file`
- `evidence-revoke`
- `admin-users`
- `agent-admin`
- `agent-ingest`

`agent-ingest` utiliza autenticação própria do agente e foi publicado sem verificação JWT do gateway.

Demais funções seguem Supabase Auth/RBAC.

## 11. Google Drive / Apps Script

Arquitetura:

React
→ Supabase Auth/RBAC
→ Edge Function
→ Google Apps Script
→ Google Drive

Apps Script Web App:

`https://script.google.com/macros/s/AKfycbzbakPvXXvFIlj3zOELl9pRFpSb9NJaWjkp77O3b07izbAmA4XcjEMYwHqWWYLAiunIMQ/exec`

Drive root folder ID:

`1COGqF8q93BSwWkhQKPayF337HpzAIkxk`

Pastas-base:

- Ativos
- Auditorias
- Estoque
- Documentos Gerais

Supabase secrets — nomes:

- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`

Apps Script Properties — nomes:

- `WISDOM_SHARED_SECRET`
- `WISDOM_ROOT_FOLDER_ID`

O shared secret foi preservado localmente protegido por DPAPI e fora do repositório.

Teste end-to-end aprovado:

Auth
→ RBAC `settings.manage`
→ `drive-health`
→ Supabase secrets
→ Apps Script
→ Google Drive.

## 12. Evidências

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

Revogação é lógica e não destrutiva.

## 13. Patrimônio

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
- inventário automático.

QR:

`/ativo/{asset_code}`

## 14. Estoque

Código:

`WIS-CMP-{TIPO}-{000000}`

Rastreabilidade:

- origem;
- destino;
- localização;
- instalação;
- remoção;
- vínculo componente ↔ ativo;
- status;
- histórico.

## 15. Auditorias

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

## 16. Manutenção e ciclo de vida

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

## 17. Branding

Produto:

`Inventário TI`

Branding institucional configurável:

- nome da organização;
- e-mail de suporte;
- logo PNG.

Storage:

- bucket `institution-branding`
- objeto `institution/logo.png`

Regras:

- PNG;
- até 2 MB;
- leitura pública;
- escrita protegida por `settings.manage`.

## 18. Dashboard e relatórios

Dashboard:

- ativos;
- estoque;
- manutenção;
- auditorias;
- alertas;
- agentes;
- divergências;
- saúde operacional.

Relatórios:

- assets
- stock
- audits
- maintenance
- alerts
- agents

Permissão:

`reports.view`

Exportação:

CSV UTF-8.

Limite backend atual:

5000 registros por execução.

## 19. Agente Windows

Projetos:

- `agent/WisdomTI.Agent`
- `agent/WisdomTI.Agent.Setup`

Runtime:

- .NET 10;
- win-x64 self-contained;
- instalador WinForms.

Autenticação:

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

mais de 30 minutos sem comunicação.

Alertas:

- connectivity
- identity
- hardware
- software
- health

Os arquivos operacionais e o instalador foram normalizados para o Project Ref/URL da Instância 2 durante a preparação de produção.

Antes da distribuição definitiva:

- executar build do agente;
- gerar instalador da Instância 2;
- instalar em uma máquina de teste;
- cadastrar token pelo fluxo administrativo;
- validar primeiro collect;
- validar snapshot;
- validar heartbeat;
- validar divergências/alertas;
- confirmar que nenhuma chamada alcança o Supabase original.

## 20. Segurança

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

Operações críticas preservam:

- usuário;
- data/hora;
- ação;
- antes/depois;
- justificativa quando aplicável.

## 21. Testes concluídos na Instância 2

### Banco

- migrations M02–M10: OK;
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

- dependências: OK;
- build: OK;
- lint: 0 erros bloqueantes;
- `.env.local`: OK;
- login administrativo: OK.

### Produção Cloudflare

- deploy: OK;
- home: OK;
- SPA: OK;
- headers/CSP: OK;
- PWA: OK;
- Supabase 2 no bundle: OK;
- Supabase original ausente do bundle: OK;
- login admin em produção: OK;
- dashboard: OK;
- relatórios: OK;
- configurações: OK;
- Ctrl+F5 em rota interna: OK.

## 22. Pendências

### Próxima etapa bloqueante para duplicação integral

`AGENTE WINDOWS — BUILD + INSTALADOR + TESTE NA INSTÂNCIA 2`

### Depois do agente

- teste funcional amplo com dados de homologação;
- validar uploads/revogação de evidências pela interface;
- validar convite real de usuário;
- validar fluxo QR em dispositivo móvel;
- validar auditoria com câmera em HTTPS;
- revisar branding institucional final.

### Backlog não bloqueante

- domínio customizado;
- assinatura digital do agente;
- auto-update do agente;
- ARM64;
- observabilidade avançada;
- paginação/exportações muito grandes.

## 23. Próxima etapa

Próxima grande etapa:

`M09 INSTÂNCIA 2 — EMPACOTAMENTO E VALIDAÇÃO DO AGENTE WINDOWS`

Objetivo:

gerar e validar o instalador do agente apontando exclusivamente para:

`https://yresuszqnakdxupewtsf.supabase.co`

## 24. Retomada em novo chat

Ao abrir um novo chat:

1. ler este documento primeiro;
2. tratar esta instalação como Instância 2 independente;
3. repositório: `https://github.com/juliocpsprof-afk/Inventario-TI.git`;
4. Supabase Project Ref: `yresuszqnakdxupewtsf`;
5. Supabase URL: `https://yresuszqnakdxupewtsf.supabase.co`;
6. produção: `https://inventario-ti-9z1.pages.dev`;
7. Apps Script/Drive já estão conectados;
8. primeiro admin/login já foram validados;
9. migrations M03/M04/M06 foram recuperadas;
10. M08/M09/M10 tiveram versões normalizadas;
11. Auth Site URL e redirect de convite já estão configurados;
12. smoke técnico/manual de produção foi aprovado;
13. não reconstruir M01–M10 sem regressão concreta;
14. próxima etapa: build/instalador/teste do agente Windows da Instância 2.

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
