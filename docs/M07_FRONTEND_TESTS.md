# M07 — Manutenção, ciclo de vida e descarte

## Implementado

- módulo `Manutenções` na navegação;
- listagem, busca, filtros e indicadores;
- abertura de manutenção;
- status operacional;
- prioridade;
- diagnóstico e ação executada;
- responsável atual;
- fornecedor externo;
- custos;
- peças e materiais;
- integração com estoque controlado para instalação, retirada e consumo;
- compensação lógica quando a movimentação de estoque falha;
- evidências da categoria Manutenção usando o M06;
- conclusão e cancelamento;
- linha do tempo de ciclo de vida na ficha do ativo;
- baixa controlada;
- descarte controlado;
- exigência de evidência de descarte na interface;
- bloqueio de movimentação da ficha para ativo baixado/descartado;
- cadastro de novo ativo limitado a Ativo ou Estoque;
- edição comum da ficha não altera mais status de ciclo de vida diretamente.

## Testes funcionais

### 1. Abrir manutenção

1. Abra `Manutenções`.
2. Clique em `Nova manutenção`.
3. Selecione um ativo.
4. Informe sintoma/objetivo.
5. Confirme.
6. Validar código `MAN-AAAA-000000`.
7. Validar que o ativo passou para `Manutenção`.

### 2. Atualizar ordem

1. Defina `Em andamento`.
2. Informe diagnóstico parcial.
3. Informe custos.
4. Salve.
5. Atualize a página e confirme persistência.

### 3. Evidência

1. Na manutenção, envie uma foto.
2. Validar preview.
3. Validar arquivo no Drive na categoria `Manutenção`.

### 4. Peça manual

1. Adicione material manual.
2. Informe quantidade e custo.
3. Confirmar item e total na ficha.

### 5. Peça controlada

Use um componente compatível do estoque.

- `Instalada`: deve vincular o componente ao ativo via estoque.
- `Retirada`: deve devolver o componente ao local atual do ativo como usado.
- `Consumida`: deve alterar o item controlado para descartado.

A movimentação deve aparecer também no histórico do estoque.

### 6. Concluir manutenção

1. Informe diagnóstico final.
2. Informe ação executada.
3. Escolha estado final `Ativo`, `Estoque` ou `Baixado`.
4. Confirme.
5. Validar manutenção `Concluída`.
6. Validar estado do ativo.

### 7. Baixa e descarte

1. Na ficha de um ativo sem manutenção ativa, clique `Baixar`.
2. Informe justificativa.
3. Validar estado `Baixado`.
4. Adicione evidência categoria `Descarte`.
5. Clique `Descartar`.
6. Informe motivo, destinação e justificativa.
7. Se houver componente instalado, o backend deve impedir até que seja retirado/tratado.
8. Após descarte, validar estado `Descartado` e histórico preservado.

## Critério de aprovação

- build OK;
- lint OK;
- abertura OK;
- atualização OK;
- evidência OK;
- peças/materiais OK;
- conclusão OK;
- cancelamento OK;
- baixa OK;
- descarte OK;
- ciclo de vida OK.