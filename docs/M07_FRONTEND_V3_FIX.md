# M07 Frontend V3

Correções em relação ao V2:

- `MaintenancePage` usa bootstrap assíncrono interno ao `useEffect`;
- `AssetLifecyclePanel` usa bootstrap assíncrono com cancelamento lógico;
- `MaintenanceDetailPage` usa bootstrap assíncrono com cancelamento lógico;
- erro de operação de estoque preserva a exceção original via `cause`;
- mantém todas as correções de navegação e TypeScript do V2.

Nenhuma alteração de banco é necessária.