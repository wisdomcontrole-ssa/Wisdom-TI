# M06 — Google Drive via Apps Script

## Arquitetura oficial

React
→ Supabase Auth / RBAC
→ Supabase Edge Function
→ Google Apps Script Web App
→ DriveApp
→ Google Drive

Não usa:

- Google Cloud Service Account;
- GOOGLE_SERVICE_ACCOUNT_JSON_B64;
- Drive API direta no backend.

## Supabase Secrets

- GOOGLE_APPS_SCRIPT_URL
- GOOGLE_APPS_SCRIPT_SHARED_SECRET

## Apps Script Properties

- WISDOM_SHARED_SECRET
- WISDOM_ROOT_FOLDER_ID

## Segurança

O Web App precisa aceitar chamada sem login Google, pois quem o chama é a Edge Function do Supabase.

A autenticação da ponte é feita por um segredo aleatório de alta entropia:

- gerado localmente;
- salvo no Supabase Secrets;
- salvo em Script Properties;
- nunca enviado ao navegador;
- nunca commitado no Git;
- nunca registrado no MASTER_CONTEXT.

## Limite operacional M06

Upload pela ponte Apps Script:

- máximo 5 MB por arquivo no backend;
- frontend deverá comprimir fotos antes do envio;
- JPEG/PNG/WEBP/HEIC/HEIF/PDF.

## Estrutura do Drive

Wisdom TI/
├── Ativos/
├── Auditorias/
├── Estoque/
└── Documentos Gerais/

As subpastas por código são criadas sob demanda.
