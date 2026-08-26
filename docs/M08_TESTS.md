# Wisdom TI — M08 Administração Real — Testes

## Pré-condições

- M01–M07 preservados.
- `main` sem alterações inesperadas antes da instalação.
- SQL `supabase/sql-history/M08_SUPABASE.sql` aplicado no Supabase SQL Editor.
- Edge Function `admin-users` publicada.
- usuário de teste com papel `admin`.

## Validação técnica

Executar:

```powershell
Set-Location "C:\Projetos\TI Wisdom\wisdom-ti"
& ".\scripts\VALIDAR_M08.ps1"
```

Esperado:

- arquivos M08 presentes;
- rota `/logs`;
- navegação administrativa com Logs;
- build OK;
- lint OK.

## Usuários

1. Abrir Administração → Usuários.
2. Confirmar listagem de perfis e papéis.
3. Pesquisar por nome/e-mail.
4. Convidar um usuário com papel Viewer.
5. Confirmar recebimento do convite.
6. Alterar papel do usuário.
7. Desativar o usuário.
8. Reativar o usuário.
9. Confirmar que usuário inativo não consegue operar o sistema.
10. Confirmar que o próprio usuário não consegue desativar a si mesmo.
11. Confirmar que o último administrador ativo não pode ser removido/desativado.

## Logs

1. Abrir Administração → Logs.
2. Confirmar eventos recentes.
3. Filtrar por entidade.
4. Buscar por ação/usuário.
5. Expandir um evento e conferir:
   - valores anteriores;
   - valores posteriores;
   - metadados;
   - ator;
   - data/hora.
6. Confirmar existência de `user.invite`, `user.update` e `settings.update` após os testes.

## Configurações

1. Abrir Administração → Configurações.
2. Confirmar parâmetros:
   - Nome exibido da organização;
   - E-mail interno de suporte;
   - Fuso horário;
   - URL de retorno dos convites.
3. Alterar um valor e salvar.
4. Atualizar a página e confirmar persistência.
5. Confirmar registro `settings.update` em Logs.
6. Testar URL inválida em `auth.invite_redirect_url` e confirmar bloqueio.
7. Confirmar que nenhum campo de secret/service_role existe na interface.

## Permissões

- `users.view`: visualiza usuários.
- `users.manage`: convida/altera usuários.
- `logs.view`: visualiza logs.
- `settings.view`: visualiza configurações.
- `settings.manage`: altera configurações.

## Regressão mínima

Validar que continuam acessíveis:

- `/patrimonio`
- `/manutencoes`
- `/estoque`
- `/auditorias`
- evidências M06
- baixa/descarte M07

## Critério de fechamento

M08 somente será considerado concluído após:

- SQL OK;
- Edge Function publicada;
- build OK;
- lint OK;
- testes funcionais acima aprovados;
- `docs/MASTER_CONTEXT.md` atualizado;
- commit/push aprovado.
