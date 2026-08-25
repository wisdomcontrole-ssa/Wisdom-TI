# WISDOM TI — MASTER CONTEXT

## 1. Estado atual

Projeto: Wisdom TI

Marco atual concluído:

M06 — Fotos, Evidências e Google Drive.

Marcos concluídos e validados:

- M01 — Fundação visual e estrutural;
- M02 — Supabase, autenticação, RBAC e RLS;
- correção global de encoding / PowerShell 5.1;
- M03 — Unidades, ambientes e patrimônio real;
- M04 — Estoque e componentes;
- M05 — Auditorias físicas e QR Code;
- M06 — Fotos, evidências e Google Drive.

Status:

M06 FRONTEND OK.

Próximo marco:

M07 — Manutenção, ciclo de vida e descarte.

Não iniciar M07 antes de confirmar que este MASTER_CONTEXT foi atualizado com sucesso.

## 2. Stack definida

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
- Supabase Edge Functions para operações seguras de evidência.

Fotos/evidências:

- Google Drive;
- Google Apps Script;
- DriveApp;
- Supabase Edge Functions como ponte segura.

Não usar na arquitetura M06:

- Google Cloud Service Account;
- Google Drive API direta no frontend;
- credenciais administrativas Google no navegador;
- GOOGLE_SERVICE_ACCOUNT_JSON_B64.

Hospedagem planejada:

- Cloudflare Pages.

Agente futuro:

- C#/.NET;
- Windows;
- inventário automático;
- heartbeat;
- comparação esperado x detectado;
- alertas.

Ambiente local:

- VS Code;
- PowerShell;
- Windows.

Controle de versão:

- Git;
- GitHub.

## 3. Diretórios importantes

Projeto:

C:\Projetos\TI Wisdom\wisdom-ti

Backups externos:

C:\Projetos\TI Wisdom\_backups\wisdom-ti

Downloads:

$env:USERPROFILE\Downloads

Regra operacional:

- scripts, pacotes e instaladores entregues devem ser executados diretamente de Downloads;
- não pedir ao usuário para mover arquivos para o projeto;
- scripts devem usar caminhos absolutos para alterar o projeto;
- localizar automaticamente o arquivo mais recente quando o navegador adicionar sufixos como (1), (2), etc.

## 4. Encoding / PowerShell

Aplicação:

- arquivos-fonte em UTF-8.

PowerShell 5.1:

- .ps1 com caracteres não ASCII deve usar UTF-8 com BOM;
- preferir lógica ASCII nos instaladores quando possível;
- não entregar scripts acentuados em UTF-8 sem BOM.

Histórico:

- houve mojibake causado por PowerShell 5.1 interpretando UTF-8 sem BOM;
- a aplicação foi corrigida;
- esta regra é permanente.

## 5. Variáveis de ambiente e secrets

Frontend:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Supabase Edge Functions / Secrets M06:

- GOOGLE_APPS_SCRIPT_URL
- GOOGLE_APPS_SCRIPT_SHARED_SECRET

Google Apps Script / Script Properties:

- WISDOM_SHARED_SECRET
- WISDOM_ROOT_FOLDER_ID

Nunca colocar no frontend ou agente:

- secret key;
- service_role;
- senha do PostgreSQL;
- tokens administrativos;
- credenciais administrativas Google;
- segredo compartilhado do Apps Script.

.env.local contém valores locais reais e não deve ser exposto.

Nenhum valor real de secret deve ser registrado neste documento.

## 6. Segurança e autorização

Autenticação:

- Supabase Auth;
- login email/senha;
- sessão persistente;
- logout;
- rotas protegidas.

RBAC:

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

Regras:

- RLS nas tabelas operacionais;
- permissões críticas validadas no banco;
- frontend não é a barreira final de segurança;
- RPCs críticas validam permissão e justificativa;
- Edge Functions M06 validam usuário e permissões;
- segredo do Apps Script nunca é enviado ao navegador;
- arquivo protegido é servido ao usuário via Edge Function autenticada;
- revogação de evidência é lógica e preserva histórico.

Funções-base:

- public.has_permission(text)
- public.get_my_access_context()

## 7. Banco até M06

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

Funções de backend M06:

- drive-health
- evidence-upload
- evidence-file
- evidence-revoke

## 8. Patrimônio

Código:

WIS-{TIPO}-{000000}

Exemplos:

- WIS-DT-000001
- WIS-MON-000002
- WIS-NB-000003

Código gerado no PostgreSQL.

Campos principais:

- tipo;
- fabricante;
- modelo;
- serial;
- hostname;
- sistema operacional;
- status;
- unidade atual;
- ambiente atual;
- aquisição;
- observações;
- autoria;
- timestamps.

Status:

- active;
- stock;
- maintenance;
- retired;
- disposed.

Movimentação:

- histórico não destrutivo;
- origem;
- destino;
- usuário;
- data/hora;
- justificativa;
- RPC move_asset().

M06 adicionou à ficha do ativo:

- seção Fotos e evidências;
- upload por câmera;
- galeria;
- arquivo;
- preview protegido;
- abertura no Google Drive;
- revogação lógica;
- categorias por contexto.

## 9. Localizações

Tabelas:

- units;
- environments.

Regras:

- inativação em vez de delete operacional;
- ambiente pertence a uma unidade;
- backend valida a relação;
- operações críticas são auditadas.

## 10. Estoque e componentes

Peça física:

stock_units

Código:

WIS-CMP-{TIPO}-{000000}

Exemplos:

- WIS-CMP-RAM-000001
- WIS-CMP-SSD-000002
- WIS-CMP-HDD-000003

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

Histórico:

stock_movements

Componente ↔ máquina:

asset_components

Regras:

- uma instalação ativa por peça;
- histórico anterior preservado;
- retirada encerra a instalação;
- peça retorna ao estoque com condição informada;
- origem/destino preservados.

M06 adicionou à ficha de estoque:

- Fotos e evidências;
- categorias Estoque, Manutenção e Outros;
- preview protegido;
- Google Drive;
- revogação não destrutiva.

## 11. QR patrimonial

Destino estável:

/ativo/{asset_code}

Exemplo:

/ativo/WIS-DT-000001

Ficha do ativo:

- QR visual;
- código;
- descrição;
- URL;
- impressão de etiqueta.

Biblioteca:

- react-qr-code 2.2.0.

Etiqueta atual:

- aproximadamente 60 mm x 35 mm;
- QR;
- Wisdom TI;
- código;
- tipo;
- fabricante/modelo;
- serial quando existente.

## 12. Auditorias físicas M05/M06

Tabelas:

- audit_cycles;
- audit_items;
- audit_scan_events.

Código:

AUD-{ANO}-{000000}

Escopo:

- unidade inteira;
- ambiente específico.

Ao criar:

- banco gera snapshot dos ativos esperados;
- snapshot permanece como referência do ciclo.

Resultados de audit_items:

- pending
- found
- missing
- divergent
- extra

Resultado adicional de scan:

- unknown_code

Métodos:

- qr
- manual
- file

Leitura aceita:

- URL completa;
- código patrimonial;
- câmera;
- imagem;
- entrada manual.

Classificação:

found:
- ativo pertence ao snapshot;
- local observado coincide com o esperado.

divergent:
- ativo pertence ao snapshot;
- observado em local diferente.

extra:
- ativo existe no Wisdom TI;
- não fazia parte do snapshot.

unknown_code:
- código não corresponde a ativo cadastrado.

missing:
- ativo esperado permaneceu pending até o fechamento.

Cada leitura gera audit_scan_events, inclusive leituras repetidas.

M06 adicionou:

- evidências gerais da auditoria;
- evidências vinculadas a audit_item;
- captura por câmera/galeria/arquivo;
- preview protegido;
- histórico preservado;
- auditoria fechada/cancelada em modo somente consulta para novas evidências.

## 13. Execução mobile

Rota:

/auditorias/:auditId

Interface:

- progresso;
- contadores;
- local observado;
- câmera;
- leitura de imagem;
- entrada manual;
- resultado da última leitura;
- filtros;
- lista esperada;
- observações;
- leituras recentes;
- fechamento;
- cancelamento;
- consulta após fechamento;
- evidências gerais da auditoria;
- evidências por item.

Scanner:

- html5-qrcode 2.3.8.

Câmera:

- preferência por facingMode environment;
- depende de contexto seguro;
- localhost serve para desenvolvimento;
- produção futura usará HTTPS no Cloudflare Pages.

M06:

- captura de evidência mobile-first;
- imagens JPEG/PNG/WEBP são otimizadas no navegador antes do upload;
- HEIC/HEIF e PDF são aceitos dentro do limite suportado;
- limite operacional final da ponte: 5 MB por arquivo.

## 14. Fechamento da auditoria

RPC:

public.close_physical_audit()

Ao fechar:

- expected=true e pending vira missing;
- status vira closed;
- closed_at;
- closed_by;
- contagens finais preservadas;
- eventos preservados;
- interface somente consulta.

Cancelamento:

public.cancel_physical_audit()

Requer:

- audits.close;
- justificativa.

## 15. Fotos e evidências M06

Arquitetura oficial:

React
→ Supabase Auth / RBAC
→ Supabase Edge Function
→ Google Apps Script Web App
→ DriveApp
→ Google Drive

Google Drive raiz:

Wisdom TI

Estrutura base:

Wisdom TI
├── Ativos
├── Auditorias
├── Estoque
└── Documentos Gerais

Pastas de ativo criadas sob demanda:

Ativos
└── {asset_code}
    ├── Cadastro
    ├── Auditoria
    ├── Movimentacao
    ├── Manutencao
    ├── Descarte
    └── Outros

Pastas de auditoria:

Auditorias
└── {audit_code}
    └── categoria da evidência

Pastas de estoque:

Estoque
└── {stock_code}
    └── categoria da evidência

Categorias suportadas pelo backend:

- registration
- audit
- movement
- maintenance
- disposal
- stock
- other

Metadados preservados no PostgreSQL incluem:

- categoria;
- ativo;
- auditoria;
- item de auditoria;
- item de estoque;
- nome original;
- nome armazenado;
- MIME type;
- tamanho;
- SHA-256;
- ID do arquivo no Drive;
- ID da pasta no Drive;
- método de captura;
- legenda;
- data de captura;
- usuário;
- status;
- timestamps;
- metadados auxiliares.

Métodos de captura:

- camera
- gallery
- file
- system

Tipos suportados:

- image/jpeg
- image/png
- image/webp
- image/heic
- image/heif
- application/pdf

Limite da ponte Apps Script:

5 MB por arquivo.

Frontend:

- compacta JPEG/PNG/WEBP antes do envio quando necessário;
- oferece câmera;
- oferece galeria;
- oferece seleção de arquivo;
- faz preview de imagens/PDF suportados;
- permite abrir no Google Drive;
- permite revogação com justificativa.

Revogação:

- não destrutiva;
- status muda para revoked;
- revoked_at;
- revoked_by;
- revoke_reason;
- registro continua consultável;
- arquivo físico não é automaticamente destruído pela operação de revogação.

## 16. Google Apps Script M06

Projeto:

Wisdom TI - Drive Bridge

Arquivo principal:

Code.gs

Função de verificação:

setupCheck()

Ações do Web App:

- health
- upload
- download
- trash

Script Properties:

- WISDOM_SHARED_SECRET
- WISDOM_ROOT_FOLDER_ID

Publicação:

- Web App;
- executar como a conta proprietária/autorizada;
- URL publicada termina em /exec.

A ponte valida:

- segredo compartilhado;
- pasta raiz;
- MIME type;
- tamanho;
- rota lógica;
- arquivo pertencente à árvore Wisdom TI nas operações protegidas.

Decisão permanente do M06:

- não usar Google Cloud Service Account;
- não usar GOOGLE_SERVICE_ACCOUNT_JSON_B64;
- não expor credenciais Google no React;
- integração automática ocorre via Google Apps Script + DriveApp.

## 17. Supabase Edge Functions M06

drive-health:

- exige usuário autenticado;
- exige settings.manage;
- valida a ponte Apps Script;
- retorna pasta raiz e pastas base.

evidence-upload:

- exige usuário autenticado;
- valida RBAC pelo contexto;
- valida categoria;
- valida MIME type;
- valida tamanho;
- resolve ativo/auditoria/item/estoque;
- gera nome padronizado;
- calcula SHA-256;
- envia arquivo para Apps Script;
- registra metadados no PostgreSQL;
- em falha do insert tenta enviar arquivo recém-criado para lixeira.

evidence-file:

- exige usuário autenticado;
- valida permissão de visualização;
- obtém arquivo via Apps Script;
- devolve conteúdo protegido ao navegador.

evidence-revoke:

- exige usuário autenticado;
- exige permissão correspondente ao contexto;
- exige justificativa;
- revoga logicamente a evidência;
- preserva trilha.

## 18. Rotas atuais

/login
/dashboard
/patrimonio
/patrimonio/:assetId
/ativo/:assetCode
/estoque
/estoque/:stockUnitId
/auditorias
/auditorias/:auditId
/alertas
/ambientes
/usuarios
/configuracoes
/sem-permissao

## 19. Testes concluídos

M01:

- interface base funcional.

M02:

- build;
- lint;
- Supabase;
- login;
- sessão;
- rotas protegidas;
- RBAC;
- RLS;
- logout.

Encoding:

- textos corrigidos;
- regra UTF-8/BOM aplicada.

M03:

- unidades;
- ambientes;
- patrimônio;
- código automático;
- ficha;
- edição;
- movimentação;
- histórico;
- rota /ativo/{codigo};
- build;
- lint.

M04:

- estoque;
- entrada;
- código automático;
- ficha;
- transferência;
- instalação;
- retirada;
- condição;
- status;
- histórico;
- componente ↔ máquina;
- build;
- lint.

M05:

- build aprovado;
- lint aprovado;
- QR visual;
- impressão de etiqueta;
- rota /ativo/{asset_code};
- criação de auditoria;
- snapshot;
- entrada manual;
- leitura por imagem;
- scanner de câmera;
- found;
- divergent;
- extra;
- unknown_code;
- observações;
- fechamento;
- pending -> missing;
- histórico preservado;
- consulta pós-fechamento.

M06 backend:

- Google Apps Script configurado;
- Script Properties configuradas;
- Web App publicado;
- Supabase CLI autenticado;
- Supabase Secrets configurados;
- Edge Functions publicadas;
- drive-health validado;
- Supabase -> Apps Script -> Google Drive validado.

M06 frontend:

- build OK;
- lint OK;
- upload de ativo OK;
- preview de ativo OK;
- arquivo no Google Drive OK;
- revogação OK;
- evidência de auditoria OK;
- evidência por item de auditoria implementada;
- evidência de estoque OK;
- câmera/galeria/arquivo implementados;
- compactação de imagem implementada;
- preview protegido implementado;
- histórico não destrutivo preservado.

Status final:

M06 FRONTEND OK.

## 20. Avisos técnicos

Vite pode avisar:

Some chunks are larger than 500 kB after minification.

Situação:

- warning não bloqueante;
- build passa;
- otimização/code splitting será tratada separadamente;
- não misturar com módulos funcionais atuais.

Apps Script:

- sujeito às cotas normais do Google Apps Script;
- manter limite de 5 MB por arquivo na ponte atual;
- imagens devem continuar sendo comprimidas no frontend;
- não transformar arquivos privados do Drive em públicos apenas para facilitar preview.

Não há bug bloqueante conhecido no M06.

## 21. Fluxo Supabase

Banco:

- fornecer SQL completo;
- colar no SQL Editor do Supabase;
- não pedir edição manual de trechos;
- scripts idempotentes quando possível;
- nunca expor secrets.

PowerShell:

- baixar;
- manter em Downloads;
- executar de Downloads;
- alterar projeto usando caminhos absolutos.

Apps Script:

- Code.gs sempre entregue completo quando houver mudança;
- não pedir edição parcial de função;
- Script Properties nunca devem ser expostas na conversa;
- novas versões do Web App devem respeitar a URL/implantação vigente.

## 22. Backups

Backups fora do projeto:

C:\Projetos\TI Wisdom\_backups\wisdom-ti

Motivos:

- evitar lint de backup;
- repositório limpo;
- recuperação segura.

M06 usou backups externos antes de substituir backend/frontend.

## 23. Próximo marco

M07 — Manutenção, ciclo de vida e descarte.

Objetivo preliminar:

- ordens/registros de manutenção;
- entrada e saída de manutenção;
- defeito/sintoma;
- diagnóstico;
- ação executada;
- peças utilizadas;
- técnico responsável;
- fornecedor externo quando aplicável;
- custo;
- datas;
- status;
- anexos/evidências já fornecidos pelo M06;
- histórico não destrutivo;
- descarte/baixa com justificativa;
- evidências de descarte;
- bloqueio de operações incompatíveis após descarte;
- trilha de auditoria.

M06 já fornece a infraestrutura de fotos/evidências que M07 deve reutilizar.

Não iniciar M07 antes de confirmação da atualização deste MASTER_CONTEXT.

## 24. Retomada em novo chat

1. Ler primeiro:

C:\Projetos\TI Wisdom\wisdom-ti\docs\MASTER_CONTEXT.md

2. Considerar M01 até M06 concluídos e validados.

3. Não reconstruir etapas anteriores sem evidência de regressão.

4. Próximo trabalho:

M07 — Manutenção, ciclo de vida e descarte.

5. Manter:

- Windows;
- PowerShell;
- Downloads;
- scripts completos;
- arquivos completos;
- Supabase SQL Editor;
- Google Drive via Apps Script;
- sem Google Cloud Service Account;
- backups externos;
- UTF-8;
- PS1 UTF-8 BOM;
- RBAC/RLS;
- histórico não destrutivo;
- mobile-first em operações de campo;
- nenhuma credencial administrativa no frontend.
