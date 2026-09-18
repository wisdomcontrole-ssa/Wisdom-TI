# INVENTÁRIO TI — MASTER CONTEXT — INSTANCIA 1

Atualizado em: 2026-09-18 08:34:35 -03:00

## 1. Identidade

Produto: `Inventário TI`

Instância: **Instancia 1**

Branding institucional atual: **Wisdom**

O código da aplicação é sincronizado entre as duas instâncias. Dados, Auth, Supabase, Cloudflare, branding e secrets são independentes.

## 2. Mapa oficial da instância

- Projeto local: `C:\Projetos\TI Wisdom\wisdom-ti`
- GitHub: `https://github.com/wisdomcontrole-ssa/Wisdom-TI.git`
- Branch: `main`
- Supabase Project Ref: `dqfbzsneaamihfphjfcj`
- Supabase URL: `https://dqfbzsneaamihfphjfcj.supabase.co`
- Cloudflare Pages: `https://inventario-ti-8s6.pages.dev`
- Release canônico M16B originado da Instância 1: `4579581713400e51425726d1ba8405afa7a54de7`

## 3. Stack

- React + TypeScript + Vite
- Tailwind / componentes acessíveis
- Supabase PostgreSQL + Auth + RLS/RBAC
- Google Drive / Google Apps Script para evidências e integrações
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

## 5. Módulos concluídos

- Fundação Auth/RBAC/RLS
- patrimônio e movimentações
- estoque/componentes
- auditorias físicas e QR Code
- evidências
- manutenção/ciclo de vida/descarte
- administração/branding/relatórios
- inventário automático e alertas
- cadastro Express com OCR
- OCR Intelligence determinístico
- identificação externa/anterior
- Central de Chamados M15
- Endpoint Management M16A
- Suporte Integrado M16B

## 6. M16B — estado atual

Implementado e com SQL aplicado nos dois Supabase:

- códigos patrimoniais novos sem prefixo institucional;
- aliases para códigos legados/QR antigos;
- portal público `/suporte` com e-mail e WhatsApp separados;
- Unidade + Responsável/Solicitante na manutenção;
- outbox de notificações;
- agente Windows 2.0.1;
- correção da trava de execução concorrente;
- inventário de software com identificador de desinstalação;
- desinstalação remota restrita a mecanismos registrados pelo Windows;
- integração preparada para acesso remoto via MeshCentral;
- câmera/Tesseract/OCR preservados.

Instalador desta instância:
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

Regra permanente: migrations aplicadas não devem ser reescritas retroativamente.

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

Código versionado para:
- `admin-users`
- `agent-admin`
- `agent-ingest`
- `drive-health`
- `evidence-upload`
- `evidence-file`
- `evidence-revoke`
- `maintenance-notify`

`agent-ingest` usa autenticação própria do agente.

`maintenance-notify` depende de configuração externa antes de envio real de e-mails.

## 10. Variáveis / secrets — nomes apenas

Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Integração Drive:
- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SHARED_SECRET`

Notificações:
- `MAINTENANCE_NOTIFY_APPS_SCRIPT_URL`
- `MAINTENANCE_NOTIFY_SHARED_SECRET`

Secrets reais nunca devem ser versionados.

## 11. Google Drive / Apps Script

- Google Drive e Google Apps Script: integração suportada pelo mesmo código.
- Configurações e secrets permanecem específicos desta instância.

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

## 13. Segurança e rastreabilidade

- RLS/RBAC no backend;
- histórico não destrutivo;
- operações críticas registram usuário, data/hora e antes/depois;
- justificativa obrigatória quando aplicável;
- sem comando PowerShell arbitrário enviado pelo navegador;
- desinstalação remota limitada a MSI/QuietUninstallString elegíveis;
- MachineGuid protege vínculo do agente;
- credenciais permanentes do agente não são exibidas ao técnico.

## 14. Testes realizados nesta sincronização

- acesso ao GitHub da instância;
- validação de `VITE_SUPABASE_URL`;
- instalação de dependências;
- teste M16B de fontes quando disponível;
- teste OCR Intelligence quando disponível;
- `npm run build`;
- validação de que o bundle contém somente o Supabase desta instância;
- build do agente 2.0.1;
- instalador abaixo de 25 MiB;
- hashes dos arquivos protegidos de câmera/OCR preservados;
- comparação do código das duas instâncias antes do push.

## 15. Estado de publicação

A branch `main` desta instância recebe o mesmo release funcional M16B das duas instalações.

Cloudflare Pages deve executar deploy automático após o push da `main`.

## 16. Pendências

- smoke test completo em produção nas duas URLs Cloudflare;
- reinstalar/validar agente piloto 2.0.1;
- testar desinstalação remota em aplicativo de homologação;
- publicar/configurar `maintenance-notify` com secrets próprios de cada instância;
- validar envio real de e-mail;
- WhatsApp permanece manual assistido por enquanto;
- definir servidor persistente MeshCentral/relay para acesso remoto visual;
- validar Google Drive/Apps Script após o deploy, especialmente na Instância 2.

## 17. Bugs/limitações conhecidos

- acesso remoto visual ainda não opera sem host MeshCentral persistente;
- e-mail automático não funciona enquanto a Edge Function/secrets/Apps Script não estiverem publicados/configurados;
- WhatsApp automático não está habilitado; existe fluxo manual assistido;
- códigos legados permanecem apenas como aliases para compatibilidade histórica.

## 18. Próxima etapa

1. aguardar os dois deploys Cloudflare;
2. executar smoke test funcional nas duas instâncias;
3. validar agente 2.0.1;
4. concluir notificações de e-mail;
5. implantar MeshCentral.

## 19. Retomada em novo chat

Antes de alterar código:
1. ler este arquivo;
2. confirmar qual instância está sendo operada;
3. nunca copiar `.env`/`.env.local` entre instâncias;
4. manter o código da aplicação equivalente entre os dois GitHubs;
5. compilar o agente separadamente para o Supabase correto;
6. preservar câmera/Tesseract/OCR salvo regressão comprovada.