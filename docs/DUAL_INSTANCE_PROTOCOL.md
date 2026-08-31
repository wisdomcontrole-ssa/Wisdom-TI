# Protocolo obrigatório — duas instâncias

## Identificação

- Instância 1: GitHub wisdomcontrole-ssa/Wisdom-TI; Supabase dqfbzsneaamihfphjfcj.
- Instância 2: GitHub juliocpsprof-afk/Inventario-TI; Supabase yresuszqnakdxupewtsf.
- Desenvolvimento: C:\Projetos\Inventario TI - Canonico\inventario-ti.

## Regra

Existe um único código-fonte funcional. Os dois GitHubs devem terminar cada publicação no mesmo commit SHA.

Diferenças permitidas ficam fora do Git: .env.local, secrets, projeto Supabase, Google Drive, Cloudflare e credenciais.

## Fluxo obrigatório

1. Desenvolver somente na base canônica.
2. Build, lint e git diff --check antes do commit.
3. Migration nova deve estar pronta nos dois Supabases antes do frontend dependente ser publicado.
4. Criar um único commit.
5. Fazer dry-run de push para os dois remotes.
6. Enviar o MESMO SHA para instancia1/main e instancia2/main.
7. Fazer git fetch e confirmar que os dois main têm exatamente o mesmo SHA.
8. Confirmar as duas produções Cloudflare.
9. Atualizar docs/MASTER_CONTEXT.md.
10. Nenhuma etapa é concluída se apenas uma instância estiver atualizada.

## Identificação obrigatória em comandos e instruções

- Instância 1 = GitHub wisdomcontrole-ssa / Supabase dqfbzsneaamihfphjfcj.
- Instância 2 = GitHub juliocpsprof-afk / Supabase yresuszqnakdxupewtsf.
