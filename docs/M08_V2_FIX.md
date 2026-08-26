# Wisdom TI — M08 V2 — Correção de lint React 19

## Origem

A primeira instalação local do M08 concluiu o build, mas o lint bloqueou cinco ocorrências de `react-hooks/set-state-in-effect`:

- `LogsPage.tsx`: bootstrap inicial;
- `SettingsPage.tsx`: bootstrap inicial;
- `UsersPage.tsx`: bootstrap inicial;
- `UsersPage.tsx`: inicialização do modal de convite;
- `UsersPage.tsx`: inicialização do modal de edição.

O instalador V1 executou rollback automático com sucesso.

## Correção V2

- bootstraps iniciais usam função assíncrona interna com cancelamento;
- nenhuma atualização de estado ocorre sincronicamente antes da primeira operação assíncrona;
- modal de convite é montado somente quando aberto e inicializa o papel via `useState`;
- modal de edição é montado somente com usuário selecionado e inicializa o formulário diretamente pelas props;
- nenhuma regra ESLint foi desabilitada;
- M01–M07 não são alterados;
- SQL e desenho de segurança M08 permanecem os mesmos.

## Critério

O instalador V2 somente permanece aplicado se:

- build passar;
- lint passar.

Em qualquer falha de build/lint, o rollback automático restaura o estado M07.
