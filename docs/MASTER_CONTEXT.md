# WISDOM TI — MASTER CONTEXT

## 1. Estado atual

Projeto: Wisdom TI

Marco atual concluído e validado:

M07 — Manutenção, ciclo de vida e descarte.

Marcos concluídos e preservados:

- M01 — Fundação visual e estrutural;
- M02 — Supabase, autenticação, RBAC e RLS;
- correção global de encoding / PowerShell 5.1;
- M03 — Unidades, ambientes e patrimônio;
- M04 — Estoque e componentes;
- M05 — Auditorias físicas e QR Code;
- M06 — Fotos, evidências e Google Drive;
- M07 — Manutenção, ciclo de vida e descarte.

Validação M07:

- banco aplicado e validado anteriormente;
- M07 Frontend V3 instalado;
- arquivos e integrações V3 confirmados;
- npm run build: OK;
- npm run lint: OK;
- validação funcional concluída no fluxo do projeto;
- nenhum bug bloqueante de M07 foi reportado no fechamento.

Não reconstruir M01-M07 sem evidência concreta de regressão.

Próximo marco:

M08 — Administração real: usuários, perfis/permissões, logs e configurações.

## 2. Ambiente e repositório

Projeto local:

C:\Projetos\TI Wisdom\wisdom-ti

Backups externos:

C:\Projetos\TI Wisdom\_backups\wisdom-ti

Downloads:

$env:USERPROFILE\Downloads

GitHub:

https://github.com/wisdomcontrole-ssa/Wisdom-TI.git

Branch principal:

main

Regra de versionamento:

- GitHub é a fonte de versionamento entre computadores;
- antes de novas etapas, verificar git status e sincronização;
- ao concluir etapa aprovada: build, lint, testes, git add, commit e push;
- nunca usar force push no fluxo normal.

## 3. Stack definida

Frontend/PWA:

- React;
- TypeScript;
- Vite;
- Tailwind CSS;
- React Router;
- Lucide;
- vite-plugin-pwa;
- html5-qrcode 2.3.8;
- react-qr-code 2.2.0.

Backend:

- Supabase PostgreSQL;
- Supabase Auth;
- RLS;
- RBAC;
- RPCs PostgreSQL para operações críticas;
- Supabase Edge Functions.

Fotos/evidências:

- Google Drive;
- Google Apps Script;
- DriveApp;
- Supabase Edge Functions como ponte segura.

Hospedagem planejada:

- Cloudflare Pages.

Agente Windows planejado:

- C#/.NET;
- inventário automático;
- heartbeat;
- comparação esperado x detectado;
- alertas de hardware, software e saúde.

Ambiente local:

- VS Code;
- PowerShell 5.1 / Windows;
- Git / GitHub;
- Node/npm.

## 4. Regras permanentes de construção

- trabalhar em etapas grandes e funcionais;
- usar PowerShell pronto para copiar/executar;
- scripts e instaladores devem ser executados diretamente de Downloads;
- PowerShell deve criar/substituir estruturas automaticamente;
- não pedir edição manual de trechos;
- quando um arquivo mudar, entregar o arquivo completo;
- quando vários arquivos mudarem, preferir instalador único;
- executar build/lint/testes ao final de cada etapa;
- não avançar de grande etapa sem validação;
- antes de gerar código dependente da estrutura atual, ler este MASTER_CONTEXT;
- manter compatibilidade Windows/PowerShell;
- operações de campo devem ser mobile-first;
- administração, estoque, relatórios e cadastros extensos devem aproveitar desktop;
- manter histórico não destrutivo;
- operações críticas devem registrar usuário, data/hora, ação, valores e justificativa quando aplicável;
- permissões devem ser garantidas no backend, não somente na interface.

## 5. Encoding / PowerShell

Aplicação:

- arquivos-fonte em UTF-8.

PowerShell 5.1:

- PS1 com caracteres não ASCII deve usar UTF-8 com BOM;
- preferir ASCII em instaladores quando possível;
- não entregar PS1 acentuado em UTF-8 sem BOM.

Histórico:

- houve mojibake causado por PowerShell 5.1;
- a correção de encoding é permanente.

## 6. Segurança e variáveis de ambiente

Frontend:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Supabase Edge Functions M06:

- GOOGLE_APPS_SCRIPT_URL
- GOOGLE_APPS_SCRIPT_SHARED_SECRET

Google Apps Script / Script Properties:

- WISDOM_SHARED_SECRET
- WISDOM_ROOT_FOLDER_ID

Regras:

- nunca registrar valores reais de secrets;
- .env.local contém valores locais reais e não deve ser exposto;
- nunca colocar service_role, secret key, senha PostgreSQL, tokens administrativos ou credenciais Google administrativas no frontend ou agente;
- credenciais administrativas devem permanecer exclusivamente em backend/infraestrutura segura;
- o segredo Apps Script nunca é enviado ao navegador.

## 7. Autenticação, RBAC e RLS

Supabase Auth:

- login email/senha;
- sessão persistente;
- logout;
- rotas protegidas.

Tabelas:

- roles;
- permissions;
- role_permissions;
- profiles.

Papéis:

- admin;
- manager;
- technician;
- auditor;
- viewer.

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
- users.view
- users.manage
- settings.view
- settings.manage
- logs.view

Funções-base:

- public.has_permission(text)
- public.get_my_access_context()

Estado atual de administração:

- backend RBAC/RLS existe;
- UsersPage consulta profiles/roles;
- gestão administrativa completa de usuários ainda será concluída no M08;
- audit_logs existe no backend, mas ainda não há módulo administrativo completo de logs;
- SettingsPage atual ainda é estrutural/estática.

## 8. Banco consolidado até M07

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
- move_asset()

M04:

- stock_products
- stock_units
- asset_components
- stock_movements
- stock_unit_code_seq
- install_stock_unit()
- remove_stock_unit()
- move_stock_unit()
- change_stock_unit_status()

M05:

- audit_cycles
- audit_items
- audit_scan_events
- audit_cycle_code_seq
- create_physical_audit()
- register_audit_scan()
- update_audit_item_note()
- close_physical_audit()
- cancel_physical_audit()

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

- create_maintenance_order()
- update_maintenance_order()
- add_maintenance_part()
- remove_maintenance_part()
- complete_maintenance_order()
- cancel_maintenance_order()
- retire_asset()
- dispose_asset()

## 9. Patrimônio

Código patrimonial:

WIS-{TIPO}-{000000}

Exemplos:

- WIS-DT-000001
- WIS-MON-000002
- WIS-NB-000003

Status:

- active;
- stock;
- maintenance;
- retired;
- disposed.

Funcionalidades:

- cadastro;
- busca e filtros;
- edição;
- ficha;
- movimentação;
- histórico;
- QR Code;
- componentes instalados;
- evidências;
- manutenção;
- ciclo de vida;
- baixa;
- descarte.

Movimentação:

- histórico não destrutivo;
- origem/destino;
- usuário;
- data/hora;
- justificativa;
- RPC move_asset().

Rota patrimonial estável:

/ativo/{asset_code}

## 10. Localizações

Tabelas:

- units;
- environments.

Regras:

- ambiente pertence a uma unidade;
- inativação em vez de exclusão operacional;
- backend valida relação;
- operações críticas auditadas.

Frontend:

- página de ambientes/unidades integrada ao Supabase.

## 11. Estoque e componentes

Tabelas:

- stock_products;
- stock_units;
- asset_components;
- stock_movements.

Código físico:

WIS-CMP-{TIPO}-{000000}

Condição:

- new
- used
- refurbished
- damaged

Status:

- in_stock
- reserved
- installed
- maintenance
- disposed

Regras:

- uma instalação ativa por peça;
- histórico anterior preservado;
- retirada encerra instalação;
- origem/destino preservados;
- vínculo componente ↔ máquina;
- ativos retired/disposed não recebem novos componentes;
- descarte de ativo é bloqueado enquanto houver componentes instalados.

M06 adicionou evidências de estoque.

M07 reutiliza estoque/asset_components para peças e manutenção.

## 12. Auditorias físicas e QR Code

Tabelas:

- audit_cycles;
- audit_items;
- audit_scan_events.

Código:

AUD-{ANO}-{000000}

Escopo:

- unidade inteira;
- ambiente específico.

Resultados:

- pending
- found
- missing
- divergent
- extra
- unknown_code para scan

Métodos:

- qr
- manual
- file

Scanner:

- html5-qrcode 2.3.8;
- câmera com preferência environment;
- leitura de imagem;
- entrada manual;
- URL /ativo/{asset_code} ou código patrimonial.

Fechamento:

- pending esperado vira missing;
- ciclo fica closed;
- histórico preservado.

M06 adicionou:

- evidência geral de auditoria;
- evidência por audit_item;
- câmera/galeria/arquivo;
- preview protegido;
- Drive;
- histórico preservado.

## 13. Fotos e evidências M06

Arquitetura oficial:

React
→ Supabase Auth/RBAC
→ Supabase Edge Function
→ Google Apps Script Web App
→ DriveApp
→ Google Drive

Decisão permanente:

- não usar Google Cloud Service Account;
- não usar Google Drive API direta no frontend;
- não usar GOOGLE_SERVICE_ACCOUNT_JSON_B64;
- não tornar arquivos privados públicos para simplificar preview.

Google Drive raiz:

Wisdom TI

Estrutura base:

Wisdom TI
├── Ativos
├── Auditorias
├── Estoque
└── Documentos Gerais

Pastas de ativo:

Ativos/{asset_code}/
├── Cadastro
├── Auditoria
├── Movimentacao
├── Manutencao
├── Descarte
└── Outros

Categorias:

- registration
- audit
- movement
- maintenance
- disposal
- stock
- other

Tipos suportados:

- image/jpeg
- image/png
- image/webp
- image/heic
- image/heif
- application/pdf

Limite operacional atual:

5 MB por arquivo.

Frontend:

- câmera;
- galeria;
- seleção de arquivo;
- compressão JPEG/PNG/WEBP;
- preview autenticado;
- abrir no Drive;
- revogação lógica com justificativa.

Revogação:

- não destrutiva;
- arquivo/metadado preservado para histórico;
- status/revoked_at/revoked_by/reason registrados.

## 14. M07 — Manutenção, ciclo de vida e descarte

Status:

CONCLUÍDO E VALIDADO.

Banco:

- maintenance_orders;
- maintenance_parts;
- maintenance_events;
- asset_lifecycle_events;
- asset_disposals.

Códigos:

- manutenção: MAN-{ANO}-{000000};
- descarte: DSC-{ANO}-{000000}.

Regras principais:

- uma manutenção ativa por ativo;
- abrir manutenção muda o ativo para maintenance;
- atualização preserva histórico;
- conclusão define status final do ativo;
- cancelamento restaura o ciclo;
- baixa exige assets.retire;
- descarte exige ativo previamente retired;
- descarte é bloqueado se houver componentes instalados;
- ativo retired/disposed não recebe novos componentes;
- histórico de ciclo de vida é não destrutivo.

Frontend M07 V3:

- rota /manutencoes;
- rota /manutencoes/:maintenanceId;
- MaintenancePage;
- MaintenanceDetailPage;
- MaintenanceCreateModal;
- AssetLifecyclePanel;
- maintenance-service;
- tipos de manutenção;
- integração na ficha do ativo;
- histórico/ciclo de vida;
- peças e materiais;
- reutilização do EvidencePanel do M06;
- baixa;
- descarte.

Arquivos principais:

- src/types/maintenance.ts
- src/data/maintenance-service.ts
- src/components/maintenance/MaintenanceCreateModal.tsx
- src/components/maintenance/AssetLifecyclePanel.tsx
- src/pages/MaintenancePage.tsx
- src/pages/MaintenanceDetailPage.tsx
- src/components/evidence/EvidencePanel.tsx
- src/pages/AssetDetailPage.tsx
- src/pages/AssetsPage.tsx
- src/components/layout/navigation.ts
- src/App.tsx

Banco/documentação M07:

- supabase/migrations/20260825_093600_m07_maintenance_lifecycle.sql
- supabase/sql-history/M07_SUPABASE.sql
- supabase/sql-history/M07_VALIDAR.sql
- docs/M07_FRONTEND_TESTS.md
- docs/M07_FRONTEND_V2_FIX.md
- docs/M07_FRONTEND_V3_FIX.md
- scripts/VALIDAR_M07_FRONTEND.ps1

Validação técnica final:

- arquivos M07 V3 presentes: OK;
- navegação e integrações: OK;
- build: OK;
- lint: OK;
- validação funcional: concluída;
- SQL M07 não deve ser reexecutado sem evidência de problema.

## 15. Rotas atuais

/login
/dashboard
/patrimonio
/patrimonio/:assetId
/ativo/:assetCode
/estoque
/estoque/:stockUnitId
/auditorias
/auditorias/:auditId
/manutencoes
/manutencoes/:maintenanceId
/alertas
/ambientes
/usuarios
/configuracoes
/sem-permissao

## 16. Estado real das áreas ainda incompletas

Alertas:

- rota e UI existem;
- AlertsPage ainda consome src/data/mock.ts;
- não existe ainda backend real de alertas do agente.

Dashboard:

- estrutura visual existe desde M01;
- partes operacionais ainda usam dados mock;
- será conectado a dados reais após os módulos administrativos/agente necessários.

Usuários:

- Auth/RBAC/RLS existem desde M02;
- UsersPage lista profiles com roles;
- gestão administrativa completa ainda falta.

Configurações:

- página existe;
- opções atuais são estruturais/estáticas;
- configuração operacional real ainda falta.

Logs:

- audit_logs existe;
- não existe ainda uma experiência administrativa completa para consulta/filtro.

Agente Windows:

- ainda não implementado;
- será desenvolvido em C#/.NET;
- deve inventariar hardware/software, enviar heartbeat e gerar divergências/alertas.

## 17. Testes concluídos

M01:

- interface base funcional.

M02:

- Supabase;
- login/sessão/logout;
- rotas protegidas;
- RBAC;
- RLS;
- build/lint.

M03:

- unidades;
- ambientes;
- patrimônio;
- código automático;
- ficha;
- edição;
- movimentação;
- histórico;
- build/lint.

M04:

- estoque;
- entrada;
- transferência;
- instalação;
- retirada;
- condição/status;
- histórico;
- componente ↔ máquina;
- build/lint.

M05:

- QR;
- etiqueta;
- auditoria;
- snapshot;
- scanner;
- found/divergent/extra/unknown/missing;
- fechamento;
- histórico;
- build/lint.

M06:

- Apps Script;
- Supabase Edge Functions;
- drive-health;
- upload;
- preview;
- Drive;
- revogação;
- auditoria;
- estoque;
- câmera/galeria/arquivo;
- compactação;
- build/lint.

M07:

- banco: OK;
- frontend V3: OK;
- navegação/integrações: OK;
- build: OK;
- lint: OK;
- fluxo funcional: validado;
- status final: M07 OK.

## 18. Avisos técnicos e pendências não bloqueantes

Vite:

Some chunks are larger than 500 kB after minification.

Tratamento:

- warning não bloqueante;
- não misturar code splitting com correções funcionais;
- otimização será feita antes do deploy final.

Apps Script:

- sujeito às cotas do Google Apps Script;
- manter 5 MB por arquivo na ponte atual;
- continuar compressão de imagens no frontend.

PWA/deploy:

- Cloudflare Pages permanece planejado;
- HTTPS será necessário para câmera em produção;
- hardening, code splitting e configuração final de deploy ainda pendentes.

White-label:

- será preparado antes do deploy final;
- não tratar antes dos módulos funcionais restantes.

## 19. Próximo marco — M08

M08 — Administração real: usuários, perfis/permissões, logs e configurações.

Objetivo:

- transformar a administração atual em módulo operacional real;
- manter secrets administrativos fora do frontend;
- concluir gestão de usuários sem expor service_role;
- permitir alteração controlada de perfil/role e estado ativo;
- registrar alterações críticas em audit_logs;
- oferecer consulta/filtros de logs;
- tornar Configurações funcional para parâmetros seguros;
- preservar RBAC/RLS e trilha de auditoria.

Princípio de segurança:

qualquer operação que exija Supabase Admin API/service_role deve ocorrer somente em Edge Function/backend seguro, nunca no React.

Depois do M08:

M09 — Agente Windows + inventário automático + heartbeat + alertas reais.

Depois:

- dashboard/indicadores totalmente reais;
- relatórios e consolidação operacional;
- hardening/PWA/deploy Cloudflare Pages;
- preparação white-label/replicação.

## 20. Próxima etapa de implementação

Antes de gerar M08:

1. confirmar repositório limpo após commit/push M07;
2. ler este MASTER_CONTEXT;
3. considerar M01-M07 concluídos;
4. não alterar SQL M07;
5. mapear exatamente os arquivos M08 que serão afetados;
6. entregar banco/Edge Functions/frontend em etapa grande e coerente;
7. finalizar com build/lint/testes e atualização deste documento.

## 21. Retomada em novo chat

Ler primeiro:

C:\Projetos\TI Wisdom\wisdom-ti\docs\MASTER_CONTEXT.md

Considerar:

- M01-M07 concluídos;
- M07 banco e frontend validados;
- não reconstruir etapas anteriores sem regressão real;
- próximo trabalho: M08 — Administração real.

Manter obrigatoriamente:

- Windows;
- PowerShell;
- Downloads;
- scripts completos;
- arquivos completos;
- Supabase SQL somente no SQL Editor;
- Google Drive via Apps Script;
- sem Google Cloud Service Account;
- backups externos;
- UTF-8;
- PS1 UTF-8 BOM;
- RBAC/RLS;
- histórico não destrutivo;
- mobile-first em campo;
- segurança administrativa no backend;
- nenhuma credencial administrativa no frontend.
