# M11 — PRODUÇÃO / GO-LIVE — INSTÂNCIA 2

## Status

GO-LIVE WEB APROVADO.

Data de fechamento:

`2026-08-28`

Produto:

`Inventário TI`

Produção:

`https://inventario-ti-9z1.pages.dev`

## GitHub

Repositório:

`https://github.com/juliocpsprof-afk/Inventario-TI.git`

Branch:

`main`

Commit-base utilizado na normalização anterior ao go-live:

`f535061b0b75aa49e07783f8f3eb9dd9f023f241`

## Supabase

Project Ref:

`yresuszqnakdxupewtsf`

URL:

`https://yresuszqnakdxupewtsf.supabase.co`

Banco:

- migrations M02–M10 aplicadas;
- migrations M03/M04/M06 recuperadas;
- M08/M09/M10 com versões normalizadas;
- dry-run remoto aprovado.

## Cloudflare Pages

Configuração:

- production branch: `main`
- framework preset: `None`
- build command: `npm run build`
- output directory: `dist`
- root directory: vazio

Variáveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Não registrar valores de chave neste documento.

## Supabase Auth

Configuração concluída:

- Site URL: `https://inventario-ti-9z1.pages.dev`
- Redirect URL de produção permitida
- `auth.invite_redirect_url`: `https://inventario-ti-9z1.pages.dev`

## Headers e PWA

Validações aprovadas:

- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Robots-Tag`
- `Content-Security-Policy`
- CSP com Supabase da Instância 2
- CSP sem Supabase original
- `manifest.webmanifest`
- `sw.js`
- rotas SPA
- refresh direto em rota interna

## Smoke técnico

Aprovado:

- home HTTP 200;
- `/login`;
- `/dashboard`;
- `/patrimonio`;
- `/estoque`;
- `/auditorias`;
- `/manutencoes`;
- `/alertas`;
- `/relatorios`;
- `/configuracoes`;
- bundle publicado aponta para Supabase 2;
- bundle publicado não contém o Supabase original.

## Smoke manual autenticado

Aprovado:

- login administrativo;
- Visão geral;
- Relatórios;
- Configurações;
- `Ctrl+F5` em `/configuracoes`;
- sessão preservada;
- sem 404 de SPA.

## Google Drive

Integração aprovada:

Supabase Auth
→ RBAC
→ Edge Function
→ Google Apps Script
→ Google Drive.

Root folder ID:

`1COGqF8q93BSwWkhQKPayF337HpzAIkxk`

Pastas-base:

- Ativos
- Auditorias
- Estoque
- Documentos Gerais

## Edge Functions

Publicadas:

- drive-health
- evidence-upload
- evidence-file
- evidence-revoke
- admin-users
- agent-admin
- agent-ingest

## Segurança

Confirmado:

- `.env.local` não versionado;
- nenhum shared secret registrado em documentação;
- nenhum service_role no frontend;
- nenhum segredo administrativo no agente;
- CSP normalizada para a Instância 2.

## Próxima etapa

O go-live web está concluído.

Próxima etapa obrigatória para finalizar a duplicação integral:

`AGENTE WINDOWS — BUILD + INSTALADOR + TESTE DA INSTÂNCIA 2`

O agente deve operar exclusivamente contra:

`https://yresuszqnakdxupewtsf.supabase.co`