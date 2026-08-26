# WISDOM TI — MASTER CONTEXT

## 1. Estado atual

Projeto: Wisdom TI.

Marco atual concluído e validado:

M09 — Agente Windows + inventário automático + heartbeat + divergências + alertas reais.

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
- M09 V2 UX — instalador gráfico universal + visualização de armazenamento e softwares.

Validação M09:

- SQL M09 aplicado no Supabase oficial;
- Edge Function `agent-admin` publicada;
- Edge Function `agent-ingest` publicada;
- frontend build OK;
- lint OK com warnings não bloqueantes preexistentes;
- agente .NET 10 build OK;
- pacote Windows gerado;
- agente real instalado em Windows;
- heartbeat real recebido;
- agente exibido Online na ficha do ativo;
- sistema operacional coletado;
- CPU coletada;
- RAM coletada;
- hostname coletado;
- fabricante/modelo/serial coletados;
- volumes/discos coletados;
- softwares instalados coletados;
- divergência real criada;
- alertas reais integrados;
- token individual funcionando;
- rotação/revogação disponíveis;
- instalador gráfico validado;
- fluxo normal de instalação sem PowerShell na máquina-alvo;
- armazenamento detalhado exibido;
- programas instalados exibidos e pesquisáveis;
- status final: M09 OK.

Não reconstruir M01–M09 sem evidência concreta de regressão.

Próximo marco:

M10 — Consolidação operacional e produção.

## 2. Repositório e ambiente

Projeto local:

`C:\Projetos\TI Wisdom\wisdom-ti`

Backups externos:

`C:\Projetos\TI Wisdom\_backups\wisdom-ti`

Builds externos:

`C:\Projetos\TI Wisdom\_builds\wisdom-ti-agent`

Repositório:

`https://github.com/wisdomcontrole-ssa/Wisdom-TI.git`

Branch principal:

`main`

Ambiente:

- Windows;
- VS Code;
- Windows PowerShell 5.1;
- Git/GitHub;
- Node/npm;
- Supabase CLI;
- .NET 10 SDK.

Regras Git:

- verificar branch, remote e `git status` antes de cada macrobloco;
- ao concluir macrobloco: build, lint, testes, commit e push;
- não usar force push no fluxo normal;
- preservar trabalho local;
- artefatos de build não devem ser versionados.

## 3. Supabase oficial

Project Ref oficial:

`dqfbzsneaamihfphjfcj`

Project URL:

`https://dqfbzsneaamihfphjfcj.supabase.co`

Regra permanente:

- toda Edge Function, SQL, `.env.local` e deploy deve apontar para esse projeto;
- não inferir projeto por nome mostrado pela CLI;
- não usar outros Project Refs do mesmo usuário.

## 4. Stack

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
- Supabase Edge Functions;
- pg_cron para verificação periódica de conectividade do agente.

Evidências:

- Google Drive;
- Google Apps Script;
- DriveApp;
- Supabase Edge Functions como ponte segura.

Agente Windows:

- C#/.NET 10;
- executável self-contained win-x64;
- instalador gráfico WinForms self-contained;
- coleta via Windows PowerShell/CIM internamente;
- heartbeat;
- inventário de hardware/software;
- identidade por MachineGuid;
- token individual revogável.

Hospedagem planejada:

- Cloudflare Pages.

## 5. Segurança e variáveis de ambiente

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Valores reais ficam apenas em `.env.local`, fora do Git.

M06 Edge Functions:

- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`

Google Apps Script:

- `WISDOM_SHARED_SECRET`
- `WISDOM_ROOT_FOLDER_ID`

Regras:

- nunca registrar valores reais de secrets;
- nunca colocar `service_role`, secret key, senha PostgreSQL ou token administrativo no frontend ou agente;
- Publishable/anon pública pode existir no frontend;
- credenciais administrativas ficam somente no backend/infraestrutura;
- o agente usa credencial própria, individual e revogável;
- token do agente não deve ser enviado por chat/e-mail;
- banco guarda hash SHA-256 da credencial do agente;
- token pode ser rotacionado ou revogado;
- MachineGuid protege contra uso da mesma credencial em outra máquina;
- HTTPS obrigatório para comunicação do agente.

## 6. Encoding e PowerShell

- arquivos-fonte: UTF-8;
- PS1 para PowerShell 5.1: UTF-8 com BOM quando houver caracteres não ASCII;
- preferir scripts ASCII quando possível;
- não pedir edição manual de linhas;
- quando arquivo mudar, entregar arquivo completo;
- quando vários arquivos mudarem, preferir instalador único.

## 7. Auth, RBAC e RLS

Tabelas-base:

- roles
- permissions
- role_permissions
- profiles

Papéis:

- admin
- manager
- technician
- auditor
- viewer

Permissões principais:

- dashboard.view
- assets.view/create/update/move/retire
- stock.view/move/adjust
- audits.view/create/execute/close
- alerts.view/manage
- locations.view/manage
- users.view/manage
- settings.view/manage
- logs.view

Funções-base:

- `public.has_permission(text)`
- `public.get_my_access_context()`

Estado consolidado:

- backend valida permissões;
- frontend não é a camada exclusiva de autorização;
- operações críticas geram audit_logs;
- gestão administrativa de usuários fica em Edge Function;
- alertas possuem tratamento auditado.

## 8. Banco consolidado

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

M06 Edge Functions:

- drive-health
- evidence-upload
- evidence-file
- evidence-revoke

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

M08 RPC:

- `update_system_setting()`

M08 Edge Function:

- `admin-users`

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

M09 Edge Functions:

- `agent-admin`
- `agent-ingest`

## 9. Patrimônio

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
- busca/filtros;
- edição;
- ficha;
- movimentação;
- histórico;
- QR Code;
- componentes;
- evidências;
- manutenção;
- ciclo de vida;
- baixa;
- descarte;
- inventário automático;
- agente Windows;
- divergências;
- baseline esperado.

Rota QR:

`/ativo/{asset_code}`

## 10. Estoque e componentes

Código:

`WIS-CMP-{TIPO}-{000000}`

Tabelas:

- stock_products
- stock_units
- asset_components
- stock_movements

Regras:

- histórico não destrutivo;
- origem/destino;
- vínculo componente ↔ máquina;
- uma instalação ativa por peça;
- ativos retired/disposed não recebem componentes;
- descarte bloqueado enquanto houver componente instalado.

## 11. Auditorias e QR

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

- qr
- manual
- file

Scanner:

- câmera;
- imagem;
- entrada manual;
- URL `/ativo/{asset_code}`.

## 12. Evidências M06

Arquitetura oficial:

React → Supabase Auth/RBAC → Supabase Edge Function → Google Apps Script → DriveApp → Google Drive.

Decisões:

- não usar Google Cloud Service Account;
- não usar Drive API direta no frontend;
- não tornar arquivo privado público para simplificar preview.

Categorias:

- registration
- audit
- movement
- maintenance
- disposal
- stock
- other

Limite operacional:

5 MB por arquivo.

Revogação:

- lógica e não destrutiva;
- preserva metadados/histórico.

## 13. M07 — Manutenção e ciclo de vida

Status:

CONCLUÍDO E VALIDADO.

Códigos:

- `MAN-{ANO}-{000000}`
- `DSC-{ANO}-{000000}`

Regras:

- uma manutenção ativa por ativo;
- abertura muda ativo para maintenance;
- conclusão define status final;
- cancelamento restaura ciclo;
- baixa exige `assets.retire`;
- descarte exige retired;
- descarte bloqueado com componente instalado;
- histórico não destrutivo.

Frontend:

- `/manutencoes`
- `/manutencoes/:maintenanceId`
- MaintenancePage
- MaintenanceDetailPage
- MaintenanceCreateModal
- AssetLifecyclePanel
- maintenance-service
- EvidencePanel
- baixa/descarte

## 14. M08 — Administração real

Status:

CONCLUÍDO E VALIDADO.

Usuários:

- `/usuarios`;
- listagem real;
- convite;
- alteração de papel;
- ativação/desativação;
- Edge Function `admin-users`;
- auditoria `user.invite` e `user.update`.

Logs:

- `/logs`;
- consulta real de audit_logs;
- filtros/busca;
- old/new data;
- metadata.

Configurações:

- `/configuracoes`;
- tabela `system_settings`;
- RPC `update_system_setting()`;
- auditoria `settings.update`.

## 15. M09 — Agente Windows e inventário automático

Status:

CONCLUÍDO E VALIDADO.

### 15.1 Identidade e segurança do agente

Cada ativo pode possuir um agente ativo.

Credencial:

- prefixo `wti_`;
- token aleatório individual;
- banco armazena apenas hash SHA-256;
- token exibido uma única vez;
- rotação disponível;
- revogação com justificativa;
- um agente revogado não aceita novas coletas.

MachineGuid:

- primeira coleta vincula a credencial à máquina;
- tentativa de usar a credencial em outro MachineGuid gera alerta de identidade e rejeita coleta.

O agente NÃO possui:

- service_role;
- senha administrativa;
- segredo Google;
- acesso administrativo direto ao patrimônio.

### 15.2 Comunicação

Endpoint:

`agent-ingest`

Autenticação:

header próprio:

`x-wisdom-agent-token`

Protocolo:

versão `1`.

Heartbeat:

- tarefa Windows a cada 15 minutos;
- tarefa no startup;
- last_seen_at;
- last_inventory_at.

Conectividade:

- pg_cron verifica agentes;
- agente sem comunicação por mais de 30 minutos gera alerta;
- retorno do heartbeat resolve automaticamente alerta de conectividade.

### 15.3 Inventário coletado

Máquina:

- MachineGuid;
- hostname;
- fabricante;
- modelo;
- serial.

Sistema:

- nome do Windows;
- versão;
- build;
- arquitetura;
- último boot.

Hardware:

- CPU;
- número de núcleos;
- processadores lógicos;
- RAM.

Armazenamento:

- volumes locais;
- letra/device id;
- nome;
- capacidade;
- espaço livre;
- espaço usado calculado no frontend;
- volume do sistema.

Software:

- programas instalados;
- versão;
- fabricante/publisher;
- fontes HKLM 64-bit;
- HKLM WOW6432Node;
- HKCU;
- deduplicação;
- limite de 2000 entradas por snapshot.

Histórico:

- todo inventário vira novo registro em `agent_inventory_snapshots`;
- snapshots anteriores não são apagados.

### 15.4 Baseline e divergências

Tabela:

`agent_inventory_expectations`

Baseline:

- hostname;
- fabricante;
- modelo;
- serial;
- SO;
- CPU;
- RAM;
- mínimo de espaço livre do disco do sistema;
- software obrigatório.

Frontend:

botão `Adotar inventário detectado`.

Divergências:

- identity;
- hardware;
- software;
- health.

Exemplos:

- hostname divergente;
- serial divergente;
- fabricante/modelo divergente;
- CPU divergente;
- RAM divergente;
- SO divergente;
- espaço livre crítico;
- software obrigatório ausente.

Regras:

- divergência aberta é reutilizada/atualizada;
- ao voltar ao esperado, divergência é auto-resolvida;
- alerta associado é auto-resolvido quando aplicável.

### 15.5 Alertas reais

Página:

`/alertas`

A antiga fonte mock foi substituída por `system_alerts`.

Categorias:

- connectivity
- identity
- hardware
- software
- health

Severidades:

- info
- warning
- critical

Status:

- open
- acknowledged
- resolved

Operações:

- reconhecer;
- resolver;
- justificativa;
- auditoria `alert.status.update`.

### 15.6 Frontend do agente

Componente:

`src/components/agents/AssetAgentPanel.tsx`

Integrado à ficha do ativo.

Exibe:

- status Online/Sem comunicação;
- hostname;
- token prefix;
- versão;
- último heartbeat;
- SO/build;
- CPU;
- RAM;
- arquitetura;
- fabricante/modelo;
- serial;
- armazenamento;
- programas instalados;
- divergências;
- baseline;
- criar/rotacionar/revogar agente.

## 16. M09 V2 UX — instalação simplificada

Status:

CONCLUÍDO E VALIDADO.

Problema resolvido:

o primeiro fluxo exigia extração de ZIP e PowerShell administrativo na máquina-alvo.

Fluxo oficial após V2:

1. No Wisdom TI, abrir o ativo.
2. Criar ou rotacionar token.
3. Copiar token.
4. Levar `WisdomTI-Agent-Setup.exe` para a máquina.
5. Dar dois cliques.
6. Autorizar UAC.
7. Colar token no formulário.
8. Clicar Instalar.
9. Instalador executa toda configuração.
10. Primeira coleta é enviada automaticamente.

Não é necessário abrir PowerShell no fluxo normal.

Projeto:

`agent/WisdomTI.Agent.Setup`

Tecnologia:

- C#/.NET 10;
- WinForms;
- WinExe;
- self-contained win-x64;
- manifest `requireAdministrator`;
- payload `WisdomTI.Agent.exe` embutido como resource.

O instalador gráfico:

- valida token;
- extrai agente;
- cria `%ProgramData%\WisdomTI\Agent`;
- grava configuração;
- aplica ACL para SYSTEM/Administradores;
- cria tarefa Startup;
- cria tarefa Heartbeat a cada 15 minutos;
- executa primeira coleta;
- mostra sucesso/erro em interface gráfica.

Arquivo universal:

`WisdomTI-Agent-Setup.exe`

O mesmo executável pode ser usado em todos os computadores.

O token NÃO fica embutido no instalador universal.

PowerShell permanece apenas como fallback técnico.

## 17. Arquivos principais M09

Frontend:

- src/types/agent.ts
- src/data/agent-service.ts
- src/components/agents/AssetAgentPanel.tsx
- src/pages/AlertsPage.tsx
- src/pages/AssetDetailPage.tsx

Backend:

- supabase/functions/agent-admin/index.ts
- supabase/functions/agent-ingest/index.ts

Banco:

- supabase/migrations/20260826_150000_m09_agent_inventory_alerts.sql
- supabase/sql-history/M09_SUPABASE.sql

Agente:

- agent/WisdomTI.Agent/WisdomTI.Agent.csproj
- agent/WisdomTI.Agent/Program.cs

Instalador gráfico:

- agent/WisdomTI.Agent.Setup/WisdomTI.Agent.Setup.csproj
- agent/WisdomTI.Agent.Setup/Program.cs
- agent/WisdomTI.Agent.Setup/app.manifest

Scripts:

- agent/scripts/BUILD_AGENT_PACKAGE.ps1
- agent/scripts/INSTALL_AGENT.ps1
- agent/scripts/UNINSTALL_AGENT.ps1
- scripts/DEPLOY_M09_BACKEND.ps1
- scripts/VALIDAR_M09.ps1

Documentação:

- docs/M09_TESTS.md
- docs/M09_V2_UX.md

## 18. Rotas atuais

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
- /usuarios
- /logs
- /configuracoes
- /sem-permissao

## 19. Pendências reais depois do M09

Dashboard:

- estrutura existe;
- partes ainda usam mock;
- deve ser conectado a dados reais no M10.

Relatórios:

- faltam relatórios gerenciais consolidados;
- patrimônio;
- estoque;
- auditoria;
- manutenção;
- inventário automático;
- alertas.

Produção:

- Cloudflare Pages;
- PWA final;
- domínio/HTTPS;
- code splitting;
- hardening;
- assinatura digital do instalador/agente;
- estratégia de atualização automática do agente;
- retenção/compactação de snapshots;
- monitoramento operacional;
- processo formal de backup/restore.

## 20. Avisos técnicos

Vite:

- pode emitir warning de chunks maiores que 500 kB;
- não é bloqueante;
- code splitting será tratado no M10.

ESLint:

- existem warnings preexistentes em Edge Functions antigas;
- 0 errors;
- limpeza fica para hardening.

Agente:

- executável ainda não possui assinatura digital;
- Windows SmartScreen pode alertar em máquinas novas;
- assinatura de código deve ser feita antes da distribuição ampla em produção.

Agente atual:

- build win-x64;
- considerar ARM64 apenas se houver demanda real.

## 21. Próximo marco — M10

M10 — Consolidação operacional e produção.

Macroescopo recomendado:

1. Dashboard real:
   - ativos;
   - estoque;
   - auditorias;
   - manutenção;
   - alertas;
   - agentes online/offline;
   - divergências;
   - indicadores operacionais.

2. Relatórios:
   - patrimônio;
   - inventário;
   - componentes;
   - movimentações;
   - auditorias;
   - manutenções;
   - alertas;
   - agente/inventário automático;
   - exportações adequadas.

3. Hardening:
   - code splitting;
   - tratamento de warnings;
   - estados de erro/loading;
   - revisão de RLS/RBAC;
   - limites;
   - rate limiting onde necessário;
   - retenção de snapshots;
   - logs.

4. Produção:
   - Cloudflare Pages;
   - PWA;
   - HTTPS/domínio;
   - configuração de ambiente;
   - processo de deploy;
   - smoke tests.

5. Agente para produção:
   - assinatura digital;
   - versão;
   - mecanismo de atualização;
   - distribuição;
   - documentação operacional.

6. Continuidade:
   - atualizar integralmente este MASTER_CONTEXT;
   - commit/push final da etapa;
   - preparar documentação de operação.

## 22. Retomada

Ao abrir novo chat, ler primeiro:

`C:\Projetos\TI Wisdom\wisdom-ti\docs\MASTER_CONTEXT.md`

Considerar:

- M01–M09 concluídos;
- Supabase oficial: `dqfbzsneaamihfphjfcj`;
- M09 possui agente Windows real e validado;
- instalação oficial é gráfica por `WisdomTI-Agent-Setup.exe`;
- PowerShell não faz parte do fluxo normal de instalação do agente;
- armazenamento e softwares são exibidos na ficha;
- alertas são reais, não mock;
- próximo trabalho: M10;
- não reconstruir etapas anteriores sem regressão concreta.
