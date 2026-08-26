# WISDOM TI — MASTER CONTEXT

## 1. Estado atual

Projeto: Wisdom TI.

Marco concluído e validado:

M08 — Administração real: usuários, perfis/permissões, logs e configurações.

Marcos concluídos:

- M01 — Fundação visual e estrutural.
- M02 — Supabase, Auth, RBAC e RLS.
- M03 — Unidades, ambientes e patrimônio.
- M04 — Estoque e componentes.
- M05 — Auditorias físicas e QR Code.
- M06 — Fotos/evidências e Google Drive.
- M07 — Manutenção, ciclo de vida e descarte.
- M08 — Administração real.

Validação M08:

- banco M08 aplicado no projeto Supabase correto;
- Edge Function `admin-users` publicada;
- build OK;
- lint OK, com warnings não bloqueantes preexistentes nas Edge Functions M06;
- usuários OK;
- convite/alteração de papel/ativação OK;
- configurações OK;
- logs OK;
- regressão rápida M01–M07 OK;
- status final: M08 OK.

Não reconstruir M01–M08 sem evidência concreta de regressão.

Próximo marco:

M09 — Agente Windows + inventário automático + heartbeat + divergências + alertas reais.

## 2. Repositório e ambiente

Projeto local:

`C:\Projetos\TI Wisdom\wisdom-ti`

Backups externos:

`C:\Projetos\TI Wisdom\_backups\wisdom-ti`

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
- Supabase CLI.

Regras Git:

- verificar branch, remote e `git status` antes de cada macrobloco;
- ao concluir macrobloco: build, lint, testes, commit e push;
- não usar force push no fluxo normal;
- preservar trabalho local e backups externos.

## 3. Supabase oficial

Project Ref oficial do Wisdom TI:

`dqfbzsneaamihfphjfcj`

Project URL:

`https://dqfbzsneaamihfphjfcj.supabase.co`

Regra permanente:

- toda Edge Function, SQL, `.env.local` e deploy do Wisdom TI deve apontar para esse Project Ref;
- não inferir o projeto por nome exibido na CLI;
- ao preparar novo computador, conferir a URL do projeto antes de configurar chave pública.

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
- Supabase Edge Functions.

Evidências:

- Google Drive;
- Google Apps Script;
- DriveApp;
- Supabase Edge Functions como ponte segura.

Agente planejado:

- C#/.NET para Windows.

Hospedagem planejada:

- Cloudflare Pages.

## 5. Segurança e variáveis de ambiente

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Valores reais ficam apenas em `.env.local`, que deve permanecer fora do Git.

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
- credenciais administrativas ficam somente em backend/infraestrutura;
- o agente futuro deve ter identidade própria e revogável, sem credencial administrativa.

## 6. Encoding e PowerShell

- arquivos-fonte: UTF-8;
- PS1 para PowerShell 5.1: UTF-8 com BOM quando houver caracteres não ASCII;
- preferir scripts ASCII quando possível;
- não pedir edição manual de linhas;
- quando arquivo mudar, entregar o arquivo completo;
- quando vários arquivos mudarem, preferir um instalador único.

## 7. Auth, RBAC e RLS

Tabelas-base:

- `roles`
- `permissions`
- `role_permissions`
- `profiles`

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

Após M08:

- alterações privilegiadas de usuários passam pela Edge Function `admin-users`;
- React não recebe credencial administrativa;
- `audit_logs` possui módulo administrativo real;
- `system_settings` possui leitura por RLS e escrita por RPC segura.

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

M08 índices:

- system_settings_group_idx
- audit_logs_created_at_idx
- audit_logs_action_idx
- audit_logs_entity_type_idx

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
- descarte.

Rota QR estável:

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

Decisões permanentes:

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

### Usuários

Rota:

`/usuarios`

Frontend:

- listagem real de profiles/roles;
- busca;
- convite;
- alteração de papel;
- ativação/desativação.

Backend:

Edge Function `admin-users`.

Ações:

- invite
- update

Regras:

- requer `users.manage`;
- convite usa Supabase Auth Admin somente na Edge Function;
- usuário não pode desativar o próprio acesso;
- último administrador ativo não pode ser removido/desativado;
- alterações registradas em audit_logs.

Eventos:

- user.invite
- user.update

### Logs

Rota:

`/logs`

Permissão:

`logs.view`

Funcionalidades:

- consulta de audit_logs;
- busca;
- filtro por entidade;
- ator;
- data/hora;
- old_data;
- new_data;
- metadata.

### Configurações

Rota:

`/configuracoes`

Tabela:

`system_settings`

Permissões:

- settings.view
- settings.manage

Parâmetros iniciais:

- organization.display_name
- organization.support_email
- operations.timezone
- auth.invite_redirect_url

Escrita:

`update_system_setting()`

Evento:

- settings.update

Segurança:

- somente parâmetros operacionais não sensíveis;
- nenhuma secret key/service_role;
- alteração auditada;
- URL de convite exige HTTPS ou localhost.

### Arquivos M08

- src/types/admin.ts
- src/data/admin-service.ts
- src/pages/UsersPage.tsx
- src/pages/LogsPage.tsx
- src/pages/SettingsPage.tsx
- src/components/layout/navigation.ts
- src/App.tsx
- supabase/functions/admin-users/index.ts
- supabase/migrations/20260826_110000_m08_administration.sql
- supabase/sql-history/M08_SUPABASE.sql
- docs/M08_TESTS.md
- docs/M08_V2_FIX.md
- scripts/VALIDAR_M08.ps1
- scripts/DEPLOY_M08_BACKEND.ps1

### Correção M08 V2

A V1 passou build e falhou no lint React 19 com `react-hooks/set-state-in-effect`.

V2:

- bootstraps assíncronos canceláveis;
- modais sem sincronização de estado por efeito;
- nenhuma regra ESLint desabilitada;
- build OK;
- lint 0 errors;
- warnings antigos das Edge Functions M06 permanecem não bloqueantes.

## 15. Rotas atuais

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

## 16. Pendências reais

Alertas:

- rota/UI existe;
- ainda usa mock;
- será substituído no M09.

Dashboard:

- estrutura existe;
- partes ainda usam mock;
- será conectado a dados reais após M09.

Agente Windows:

- ainda não implementado;
- próximo macrobloco.

Relatórios e consolidação:

- pendentes após M09.

Deploy final:

- Cloudflare Pages, hardening, code splitting e PWA final depois dos módulos funcionais principais.

## 17. Próximo marco — M09

M09 — Agente Windows + inventário automático + heartbeat + divergências + alertas reais.

Macroescopo:

1. Backend:
   - agentes/dispositivos;
   - credencial própria e revogável;
   - heartbeat;
   - snapshots de inventário;
   - hardware;
   - software;
   - saúde;
   - divergências;
   - alertas;
   - histórico.

2. Agente C#/.NET:
   - instalação/configuração;
   - identidade da máquina;
   - coleta hardware/software;
   - envio periódico;
   - retry/offline;
   - logs locais;
   - HTTPS;
   - nenhuma credencial administrativa.

3. Comparação esperado x detectado:
   - vínculo com ativo;
   - CPU/RAM/discos/serial;
   - componentes;
   - software;
   - divergências.

4. Alertas reais:
   - substituir mock;
   - severidade;
   - status;
   - categoria;
   - origem;
   - ativo/agente;
   - reconhecimento/resolução;
   - auditoria.

5. Integração:
   - ficha do ativo recebe inventário automático;
   - dashboard passa a usar indicadores reais onde aplicável.

## 18. Decisões arquiteturais M09

O agente NÃO deve:

- usar service_role;
- usar senha administrativa;
- alterar patrimônio diretamente;
- acessar Google Drive diretamente.

O agente deve:

- autenticar-se com identidade própria e revogável;
- ter credencial individual;
- permitir revogação;
- usar HTTPS;
- registrar last_seen_at;
- usar protocolo versionado;
- ter escopo mínimo.

O backend decide:

- vínculo agente ↔ ativo;
- divergências;
- criação/atualização de alertas;
- reconhecimento/resolução.

## 19. Depois do M09

M10 — Consolidação operacional e produção:

- dashboard real;
- relatórios;
- indicadores;
- code splitting;
- hardening;
- PWA final;
- Cloudflare Pages;
- domínio/HTTPS;
- processo de backup;
- preparação white-label.

## 20. Retomada

Ao abrir novo chat, ler primeiro:

`C:\Projetos\TI Wisdom\wisdom-ti\docs\MASTER_CONTEXT.md`

Considerar:

- M01–M08 concluídos;
- Supabase oficial: `dqfbzsneaamihfphjfcj`;
- M08 banco, Edge Function e frontend validados;
- próximo trabalho: M09;
- não reconstruir etapas anteriores sem regressão concreta.
