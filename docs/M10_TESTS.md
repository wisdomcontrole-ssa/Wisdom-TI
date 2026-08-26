# Inventário TI — M10 — Testes

## 1. Banco

Aplicar:

`supabase/sql-history/M10_SUPABASE.sql`

Validar:

- `reports.view`;
- bucket `institution-branding`;
- `get_public_branding()`;
- `get_dashboard_summary()`;
- `get_operational_report(text)`.

## 2. Branding

Administração → Configurações:

1. alterar nome da instituição;
2. enviar PNG;
3. atualizar a tela.

Esperado:

- logo na configuração;
- logo no menu;
- nome institucional no topo;
- login personalizado após logout;
- nenhum secret exposto.

Remover logo e confirmar fallback `Inventário TI`.

## 3. Etiqueta

Abrir ativo → QR patrimonial → Imprimir etiqueta.

Esperado:

- logo quando configurada;
- nome da instituição;
- Inventário TI;
- código patrimonial;
- QR;
- tipo/modelo;
- serial quando houver.

## 4. Dashboard

Esperado:

- ativos;
- estoque;
- manutenções;
- auditorias;
- alertas;
- agentes;
- saúde operacional;
- alertas recentes;
- manutenções recentes.

Os dados devem corresponder ao banco real.

## 5. Relatórios

Abrir `/relatorios`.

Testar:

- Patrimônio;
- Estoque;
- Auditorias;
- Manutenções;
- Alertas;
- Agentes;
- busca;
- exportar CSV.

## 6. Permissões

- usuário sem `settings.manage` não envia/remove logo;
- usuário sem `reports.view` não entra em `/relatorios`;
- backend também bloqueia as operações.

## 7. Build

`npm.cmd run build`

`npm.cmd run lint`

Esperado:

- 0 erros;
- warnings antigos não bloqueantes podem permanecer.

## 8. Regressão

Validar rapidamente:

- M03 patrimônio;
- M04 estoque;
- M05 auditoria;
- M06 evidências;
- M07 manutenção;
- M08 usuários/logs/configurações;
- M09 agente/alertas.

## Critério

Responder:

`M10 FUNCIONAL OK`

somente após branding + etiqueta + dashboard + relatórios + regressão passarem.
