# Inventário TI — M10 — Cloudflare Pages

## Build

Framework preset:

Vite

Build command:

`npm.cmd run build`

Output:

`dist`

## Variáveis de ambiente

Cadastrar no Cloudflare Pages, sem expor em Git:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Nunca cadastrar no frontend:

- service_role;
- secret key;
- senha de banco;
- secrets do Google Apps Script.

## SPA

`public/_redirects` contém:

`/* /index.html 200`

Isso preserva rotas React como:

- `/patrimonio/:assetId`
- `/ativo/:assetCode`
- `/manutencoes/:id`

## PWA

O manifest usa a identidade genérica:

`Inventário TI`

A identidade da instituição é dinâmica e carregada do Supabase.

## Smoke test de produção

Após publicar:

1. abrir `/login`;
2. confirmar logo/nome institucional;
3. login;
4. dashboard;
5. patrimônio;
6. QR `/ativo/{codigo}`;
7. estoque;
8. auditorias;
9. manutenções;
10. alertas;
11. relatórios;
12. configurações;
13. recarregar uma rota interna diretamente;
14. validar PWA;
15. validar câmera/QR em HTTPS.
