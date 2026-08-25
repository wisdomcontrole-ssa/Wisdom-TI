# M06 — Testes do Frontend de Evidências

## Escopo

Este bloco não altera o banco nem a integração Google Drive já validada.

Implementado:

- painel reutilizável de evidências;
- upload por câmera;
- seleção da galeria;
- seleção de imagem/PDF;
- otimização de JPEG/PNG/WEBP no navegador;
- limite final de 5 MB;
- metadados no Supabase;
- arquivo físico no Google Drive via Apps Script;
- preview protegido pela Edge Function `evidence-file`;
- abertura opcional do arquivo diretamente no Google Drive;
- revogação lógica com justificativa;
- histórico preservado;
- integração em patrimônio;
- integração na auditoria geral;
- integração por item de auditoria;
- integração no item de estoque.

## Testes objetivos

### Patrimônio

Abra um ativo em `/patrimonio/:assetId`.

Validar:

1. seção `Fotos e evidências`;
2. `Adicionar`;
3. enviar uma foto;
4. verificar criação no Google Drive;
5. visualizar dentro do Wisdom TI;
6. abrir pelo botão `Drive`;
7. revogar com justificativa;
8. registro continua aparecendo como `revogada`.

### Auditoria

Abra uma auditoria em andamento.

Validar:

1. seção `Evidências da auditoria`;
2. enviar uma foto geral;
3. abrir um item da auditoria;
4. na janela de observação, localizar `Evidências deste item`;
5. enviar uma foto do item;
6. confirmar que ela permanece vinculada ao item.

Auditoria fechada/cancelada deve ficar sem botão de novo upload.

### Estoque

Abra `/estoque/:stockUnitId`.

Validar:

1. seção `Fotos e evidências`;
2. enviar foto da peça;
3. usar categoria `Estoque` ou `Manutenção`;
4. visualizar;
5. confirmar arquivo no Drive.

## Segurança

O navegador não recebe:

- segredo do Apps Script;
- credencial Google;
- Service Account;
- service_role.

O preview passa pela Edge Function autenticada.

## Critério de aprovação

- build OK;
- lint OK;
- upload real OK;
- arquivo no Drive OK;
- preview OK;
- revogação OK;
- patrimônio OK;
- auditoria OK;
- estoque OK.

Após aprovação, fechar oficialmente M06 e atualizar integralmente `docs/MASTER_CONTEXT.md`.
