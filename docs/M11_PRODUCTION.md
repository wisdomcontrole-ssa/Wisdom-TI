# Inventário TI — M11 — Produção

## Estratégia Cloudflare

Usar Cloudflare Pages com Git Integration ao repositório GitHub:

`wisdomcontrole-ssa/Wisdom-TI`

Branch de produção:

`main`

A integração Git é a estratégia oficial deste projeto.

Não criar um projeto Pages separado por Direct Upload antes da integração Git.

## Configuração Pages

Framework:

`Vite`

Build command:

`npm run build`

Build output:

`dist`

Root directory:

raiz do repositório.

## Variáveis de produção

Cadastrar em Production e Preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Os valores devem corresponder ao projeto Supabase oficial:

`dqfbzsneaamihfphjfcj`

Nunca cadastrar no frontend:

- service_role;
- secret key;
- senha PostgreSQL;
- GOOGLE_APPS_SCRIPT_SHARED_SECRET;
- outros secrets backend.

## SPA

`public/_redirects`:

`/* /index.html 200`

## Headers

`public/_headers` adiciona:

- CSP;
- clickjacking protection;
- nosniff;
- Referrer Policy;
- Permissions Policy;
- noindex;
- cache imutável para assets com hash;
- no-cache para manifest/service worker.

## Aplicativo interno

O projeto usa:

- meta robots noindex;
- robots.txt bloqueando crawlers;
- X-Robots-Tag.

Isso reduz indexação acidental, mas não substitui autenticação.

## PWA

O service worker:

- é gerado pelo vite-plugin-pwa;
- usa atualização automática;
- remove caches obsoletos;
- não cria cache runtime para chamadas autenticadas do Supabase.

Quando offline, o shell pode permanecer disponível, porém operações de dados devem ser consideradas indisponíveis.

## Smoke test

Após o primeiro deploy:

`.\scripts\VALIDAR_CLOUDFLARE_PROD.ps1 -BaseUrl "https://SEU-PROJETO.pages.dev"`

Depois testar manualmente:

- login;
- branding;
- dashboard;
- patrimônio;
- estoque;
- auditorias;
- manutenção;
- alertas;
- relatórios;
- usuários;
- logs;
- configurações;
- QR/câmera;
- etiqueta;
- agente Windows.

## Domínio

Adicionar domínio customizado somente depois do smoke test no `pages.dev`.

Depois repetir o smoke test no domínio definitivo.

## M11 ainda pendente depois deste macrobloco

- criar/conectar projeto Pages;
- primeiro deploy;
- validar ambiente real;
- domínio;
- hardening backend final;
- backup/restore;
- assinatura e distribuição do agente.
