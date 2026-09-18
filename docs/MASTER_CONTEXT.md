# INVENTÃRIO TI â€” MASTER CONTEXT â€” INSTANCIA 1

Atualizado em: 2026-09-18 09:29:14 -03:00

## 1. Identidade

Produto: `InventÃ¡rio TI`

InstÃ¢ncia: **Instancia 1**

Branding institucional atual: **Wisdom**

O cÃ³digo da aplicaÃ§Ã£o Ã© sincronizado entre as duas instÃ¢ncias. Dados, Auth, Supabase, Cloudflare, branding e secrets sÃ£o independentes.

## 2. Mapa oficial da instÃ¢ncia

- Projeto local: `C:\Projetos\TI Wisdom\wisdom-ti`
- GitHub: `https://github.com/wisdomcontrole-ssa/Wisdom-TI.git`
- Branch: `main`
- Supabase Project Ref: `dqfbzsneaamihfphjfcj`
- Supabase URL: `https://dqfbzsneaamihfphjfcj.supabase.co`
- Cloudflare Pages: `https://inventario-ti-8s6.pages.dev`
- Release canÃ´nico M16B originado da InstÃ¢ncia 1: `4579581713400e51425726d1ba8405afa7a54de7`

## 3. Stack

- React + TypeScript + Vite
- Tailwind / componentes acessÃ­veis
- Supabase PostgreSQL + Auth + RLS/RBAC
- Google Drive / Google Apps Script para evidÃªncias e integraÃ§Ãµes
- Cloudflare Pages
- Agente Windows C#/.NET 10
- Git/GitHub
- VS Code + Windows PowerShell

## 4. Arquitetura relevante

``text
src/
  components/
  data/
  features/
  lib/
  pages/
  types/
agent/
  InventarioTI.Agent/
  scripts/
supabase/
  functions/
  migrations/
docs/
public/
scripts/
``

Frontend usa exclusivamente:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Nenhuma service role, senha ou token administrativo entra no frontend ou no agente.

## 5. MÃ³dulos concluÃ­dos

- FundaÃ§Ã£o Auth/RBAC/RLS
- patrimÃ´nio e movimentaÃ§Ãµes
- estoque/componentes
- auditorias fÃ­sicas e QR Code
- evidÃªncias
- manutenÃ§Ã£o/ciclo de vida/descarte
- administraÃ§Ã£o/branding/relatÃ³rios
- inventÃ¡rio automÃ¡tico e alertas
- cadastro Express com OCR
- OCR Intelligence determinÃ­stico
- identificaÃ§Ã£o externa/anterior
- Central de Chamados M15
- Endpoint Management M16A
- Suporte Integrado M16B

## 6. M16B â€” estado atual

Implementado e com SQL aplicado nos dois Supabase:

- cÃ³digos patrimoniais novos sem prefixo institucional;
- aliases para cÃ³digos legados/QR antigos;
- portal pÃºblico `/suporte` com e-mail e WhatsApp separados;
- Unidade + ResponsÃ¡vel/Solicitante na manutenÃ§Ã£o;
- outbox de notificaÃ§Ãµes;
- agente Windows 2.0.1;
- correÃ§Ã£o da trava de execuÃ§Ã£o concorrente;
- inventÃ¡rio de software com identificador de desinstalaÃ§Ã£o;
- desinstalaÃ§Ã£o remota restrita a mecanismos registrados pelo Windows;
- integraÃ§Ã£o preparada para acesso remoto via MeshCentral;
- cÃ¢mera/Tesseract/OCR preservados.

Instalador desta instÃ¢ncia:
- arquivo: `public/downloads/InventarioTI-Agent-Setup.exe`
- tamanho: `11,68 MiB`
- SHA256: `AD00835F0E2DE0B55F7ED8062D8B56D24F6EB48CBE7E4BC559BD521CC6ED177B`

## 7. Banco / migrations

- `20260813_190000_m02_foundation.sql`
- `20260814_090000_m03_assets_locations.sql`
- `20260815_090000_m04_stock_components.sql`
- `20260818_160000_m05_auditorias_qr.sql`
- `20260820_090000_m06_evidence_metadata.sql`
- `20260825_093600_m07_maintenance_lifecycle.sql`
- `20260826110000_m08_administration.sql`
- `20260826150000_m09_agent_inventory_alerts.sql`
- `20260826170000_m10_consolidation_branding_reports.sql`
- `20260828160000_m12_field_ops_bindings_labels.sql`
- `20260831093000_m13_smart_asset_registration.sql`
- `20260916083000_ocr_intelligence.sql`
- `20260916100000_ocr_intelligence_profile.sql`
- `20260916114500_m14_identification_branding_fix.sql`
- `20260916131500_m15_maintenance_requests_triage.sql`
- `20260916143000_m16a_endpoint_management.sql`
- `20260916183000_m16b_support_integrated.sql`

Regra permanente: migrations aplicadas nÃ£o devem ser reescritas retroativamente.

## 8. Tabelas/recursos M16B relevantes

- `asset_code_aliases`
- `stock_code_aliases`
- `maintenance_notification_outbox`
- `asset_remote_access`
- contatos separados em `maintenance_requests`
- `agent_commands` com `uninstall_software`

RPCs relevantes:
- `resolve_asset_by_code`
- `create_public_maintenance_request`
- `queue_agent_command`
- `set_asset_remote_access`
- `clear_asset_remote_access`

## 9. Edge Functions

CÃ³digo versionado para:
- `admin-users`
- `agent-admin`
- `agent-ingest`
- `drive-health`
- `evidence-upload`
- `evidence-file`
- `evidence-revoke`
- `maintenance-notify`

`agent-ingest` usa autenticaÃ§Ã£o prÃ³pria do agente.

`maintenance-notify` depende de configuraÃ§Ã£o externa antes de envio real de e-mails.

## 10. VariÃ¡veis / secrets â€” nomes apenas

Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

IntegraÃ§Ã£o Drive:
- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`

NotificaÃ§Ãµes:
- `MAINTENANCE_NOTIFY_APPS_SCRIPT_URL`
- `MAINTENANCE_NOTIFY_SHARED_SECRET`

Secrets reais nunca devem ser versionados.

## 11. Google Drive / Apps Script

- Google Drive e Google Apps Script: integraÃ§Ã£o suportada pelo mesmo cÃ³digo.
- ConfiguraÃ§Ãµes e secrets permanecem especÃ­ficos desta instÃ¢ncia.

## 12. Rotas principais

- `/`
- `/ativos`
- `/ativo/:assetCode`
- `/estoque`
- `/auditorias`
- `/manutencoes`
- `/manutencoes/chamados`
- `/suporte`
- `/relatorios`
- `/configuracoes`

## 13. SeguranÃ§a e rastreabilidade

- RLS/RBAC no backend;
- histÃ³rico nÃ£o destrutivo;
- operaÃ§Ãµes crÃ­ticas registram usuÃ¡rio, data/hora e antes/depois;
- justificativa obrigatÃ³ria quando aplicÃ¡vel;
- sem comando PowerShell arbitrÃ¡rio enviado pelo navegador;
- desinstalaÃ§Ã£o remota limitada a MSI/QuietUninstallString elegÃ­veis;
- MachineGuid protege vÃ­nculo do agente;
- credenciais permanentes do agente nÃ£o sÃ£o exibidas ao tÃ©cnico.

## 14. Testes realizados nesta sincronizaÃ§Ã£o

- acesso ao GitHub da instÃ¢ncia;
- validaÃ§Ã£o de `VITE_SUPABASE_URL`;
- instalaÃ§Ã£o de dependÃªncias;
- teste M16B de fontes quando disponÃ­vel;
- teste OCR Intelligence quando disponÃ­vel;
- `npm run build`;
- validaÃ§Ã£o de que o bundle contÃ©m somente o Supabase desta instÃ¢ncia;
- build do agente 2.0.1;
- instalador abaixo de 25 MiB;
- hashes dos arquivos protegidos de cÃ¢mera/OCR preservados;
- comparaÃ§Ã£o do cÃ³digo das duas instÃ¢ncias antes do push.

## 15. Estado de publicaÃ§Ã£o

A branch `main` desta instÃ¢ncia recebe o mesmo release funcional M16B das duas instalaÃ§Ãµes.

Cloudflare Pages deve executar deploy automÃ¡tico apÃ³s o push da `main`.

## 16. PendÃªncias

- smoke test completo em produÃ§Ã£o nas duas URLs Cloudflare;
- reinstalar/validar agente piloto 2.0.1;
- testar desinstalaÃ§Ã£o remota em aplicativo de homologaÃ§Ã£o;
- publicar/configurar `maintenance-notify` com secrets prÃ³prios de cada instÃ¢ncia;
- validar envio real de e-mail;
- WhatsApp permanece manual assistido por enquanto;
- definir servidor persistente MeshCentral/relay para acesso remoto visual;
- validar Google Drive/Apps Script apÃ³s o deploy, especialmente na InstÃ¢ncia 2.

## 17. Bugs/limitaÃ§Ãµes conhecidos

- acesso remoto visual ainda nÃ£o opera sem host MeshCentral persistente;
- e-mail automÃ¡tico nÃ£o funciona enquanto a Edge Function/secrets/Apps Script nÃ£o estiverem publicados/configurados;
- WhatsApp automÃ¡tico nÃ£o estÃ¡ habilitado; existe fluxo manual assistido;
- cÃ³digos legados permanecem apenas como aliases para compatibilidade histÃ³rica.

## 18. PrÃ³xima etapa

1. aguardar os dois deploys Cloudflare;
2. executar smoke test funcional nas duas instÃ¢ncias;
3. validar agente 2.0.1;
4. concluir notificaÃ§Ãµes de e-mail;
5. implantar MeshCentral.

## 19. Retomada em novo chat

Antes de alterar cÃ³digo:
1. ler este arquivo;
2. confirmar qual instÃ¢ncia estÃ¡ sendo operada;
3. nunca copiar `.env`/`.env.local` entre instÃ¢ncias;
4. manter o cÃ³digo da aplicaÃ§Ã£o equivalente entre os dois GitHubs;
5. compilar o agente separadamente para o Supabase correto;
6. preservar cÃ¢mera/Tesseract/OCR salvo regressÃ£o comprovada.

<!-- M17_FRONTEND_ONLY_BEGIN -->
## M17 — Cadastro assistido e estoque físico sem alteração de schema

Estado: implementação local preparada para validação antes de publicar nas duas instâncias.

Escopo desta etapa:
- nenhuma migration nova;
- nenhuma alteração de schema;
- reutilização das tabelas e RPCs existentes;
- câmera, Tesseract e motor OCR preservados.

Cadastro Express:
- fabricante passa a usar catálogo pesquisável com digitação livre;
- catálogo une fabricantes pré-cadastrados em `ti_manufacturers`, fabricantes já usados em ativos e uma lista de fallback;
- fabricante digitado manualmente fica salvo no próprio ativo e passa a reaparecer nas sugestões futuras por meio dos ativos existentes;
- processador, memória, armazenamento, sistema operacional, placa-mãe, Wi-Fi e MAC ficam editáveis mesmo quando o OCR não detecta;
- listas assistidas trazem tamanhos comuns de RAM, tipos DDR, frequências, capacidades de disco, interfaces, formatos, processadores e sistemas operacionais;
- o OCR continua preenchendo os mesmos campos automaticamente quando detectar;
- o perfil técnico continua sendo salvo em `asset_technical_profiles` e preservado no histórico existente.

Destino inicial:
- cadastro Express passa a diferenciar explicitamente `Estoque` e `Em uso`;
- `Estoque` mantém `assets.status = stock`;
- `Em uso` marca o ativo como `active` usando o serviço já existente;
- unidade/ambiente continuam sendo os campos físicos existentes, sem tabela nova.

Estoque:
- tela Estoque passa a mostrar ativos completos com `assets.status = stock`, além de peças/componentes;
- busca encontra código, fabricante, modelo, serial, unidade, estante e prateleira;
- novo local de estoque reutiliza `environments` com `environment_type = stock`;
- a localização simples segue a hierarquia física: unidade/site -> área de estoque -> estante -> prateleira;
- área/estante/prateleira são consolidadas no nome do ambiente para manter a operação simples sem alterar banco;
- criação de local de estoque exige a permissão backend já existente `locations.manage`.

Nota fiscal:
- foto da nota pode reutilizar o mesmo Tesseract local já carregado para etiquetas;
- parser leve tenta preencher número, série, data, emitente, CNPJ/CPF e chave NF-e;
- PDF continua aceito como evidência, mas o preenchimento OCR automático desta etapa usa imagem/foto;
- usuário continua revisando os campos antes de salvar.

Arquivos principais:
- `src/data/entry-catalog-service.ts`;
- `src/features/purchase-document-ocr.ts`;
- `src/components/assets/ExpressAssetModal.tsx`;
- `src/pages/InventoryPage.tsx`;
- `scripts/test-m17-source.mjs`.

Testes obrigatórios:
1. `node scripts/test-m17-source.mjs`;
2. `npm run build`;
3. `git diff --check`;
4. validar manualmente cadastro Express com OCR parcial;
5. validar fabricante manual;
6. validar RAM/processador por lista;
7. cadastrar um local de estoque;
8. cadastrar um computador completo em estoque e confirmar que aparece na tela Estoque;
9. fotografar uma nota fiscal e revisar o pré-preenchimento.

Próxima etapa:
- após validação local, publicar o mesmo código nas duas instâncias mantendo `.env`, Supabase, Cloudflare, branding e instaladores independentes.
<!-- M17_FRONTEND_ONLY_END -->

<!-- M17_TRACEABILITY_BEGIN -->
## M17.1 — Rastreabilidade multichave e Código de terceiro

Estado: implementação local preparada para validação antes de publicar.

Sem alteração de schema ou migration nesta subetapa.

Identificação do mesmo ativo:
- Código interno: identificador principal do Inventário TI e conteúdo do QR Code próprio;
- Código de terceiro: número patrimonial/tag da empresa ou órgão de origem;
- Número de série do fabricante: serial original do equipamento;
- aliases legados continuam válidos;
- qualquer chave cadastrada e sem ambiguidade deve conduzir à mesma ficha.

Leitor universal e auditoria física:
- QR Code;
- Code 128;
- Code 39;
- Code 93;
- EAN-13 / EAN-8;
- UPC-A / UPC-E;
- ITF;
- Codabar;
- entrada manual e leitura de imagem;
- auditoria física pré-resolve Código de terceiro e serial para o Código interno antes de registrar a leitura.

Regras de segurança:
- código interno tem prioridade;
- código de terceiro duplicado em ativos diferentes não é resolvido silenciosamente;
- serial duplicado em ativos diferentes não é resolvido silenciosamente;
- em situação ambígua, o usuário deve usar outra chave de identificação.

Cadastro:
- `Código de terceiro` é a nomenclatura principal na interface;
- pode ser digitado ou capturado por código de barras;
- número de série do fabricante também pode ser capturado por código de barras;
- a classificação técnica existente em `asset_external_identifiers.identifier_type` é preservada para histórico.

Etiquetas:
- QR Code continua apontando ao código interno;
- etiqueta impressa exibe o Código de terceiro quando cadastrado;
- serial do fabricante continua visível;
- Central de Etiquetas permite pesquisar também pelo Código de terceiro.

Arquivos alterados:
- `src/components/assets/ExpressAssetModal.tsx`;
- `src/components/field/InventoryScanner.tsx`;
- `src/data/field-ops-service.ts`;
- `src/types/field-ops.ts`;
- `src/pages/LabelsPage.tsx`;
- `src/components/assets/AssetQrLabelCard.tsx`;
- `src/components/assets/AssetSmartMetadataCard.tsx`;
- `src/pages/FieldScannerPage.tsx`;
- `src/components/audits/AuditScanner.tsx`;
- `src/pages/AuditExecutionPage.tsx`;
- `scripts/test-m17-traceability.mjs`.

Testes:
1. `node scripts/test-m17-source.mjs`;
2. `node scripts/test-m17-traceability.mjs`;
3. `npm run build`;
4. `git diff --check`;
5. cadastrar Código de terceiro lendo Code 128/Code 39;
6. localizar o mesmo ativo pelo QR interno;
7. localizar o mesmo ativo pelo Código de terceiro;
8. localizar o mesmo ativo pelo serial do fabricante;
9. validar Código de terceiro na etiqueta individual e na Central de Etiquetas;
10. em auditoria física, ler Código de terceiro/serial e confirmar o mesmo ativo;
11. confirmar câmera/OCR de etiqueta sem regressão.
<!-- M17_TRACEABILITY_END -->
