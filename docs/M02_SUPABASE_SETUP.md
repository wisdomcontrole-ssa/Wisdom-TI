# Wisdom TI — M02 Supabase

1. Crie um projeto Supabase para o Wisdom TI.
2. No PowerShell, copie a migration:

```powershell
Set-Location "C:\Projetos\TI Wisdom\wisdom-ti"
Get-Content -Raw ".\supabase\migrations\20260813_190000_m02_foundation.sql" | Set-Clipboard
```

3. Abra o SQL Editor do Supabase, cole e execute.
4. Depois da migration, crie o primeiro usuário em Authentication > Users. O primeiro usuário recebe o papel Administrador automaticamente.
5. Obtenha no Supabase o Project URL e a Publishable key.
6. Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& "C:\Projetos\TI Wisdom\wisdom-ti\scripts\CONFIGURAR_SUPABASE_M02.ps1"
```

7. Cole apenas Project URL e Publishable key quando solicitado.
8. Pare o Vite com Ctrl+C e inicie novamente:

```powershell
& "C:\Projetos\TI Wisdom\INICIAR_WISDOM_TI.cmd"
```

9. Testes:
- deve aparecer Login;
- autentique com o primeiro usuário;
- nome e papel devem aparecer no cabeçalho;
- Usuários deve mostrar o usuário real do Supabase;
- logout deve retornar ao Login;
- abrir /usuarios sem sessão deve redirecionar para /login.

Nunca coloque service_role, secret key ou senha do banco no frontend.
