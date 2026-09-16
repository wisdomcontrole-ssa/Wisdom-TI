using System.Diagnostics;
using System.Text.Json;
using Microsoft.Win32;

namespace InventarioTI.Agent;

internal static class RemoteCommandExecutor
{
    public static async Task<CommandExecutionResult>
        ExecuteAsync(
            RemoteCommand command,
            Func<Task<InventoryUploadResult>>
                collectAndUpload,
            AgentLog log)
    {
        var watch = Stopwatch.StartNew();

        try
        {
            return command.CommandType switch
            {
                "collect_inventory" =>
                    await CollectAsync(
                        "Inventário atualizado.",
                        collectAndUpload,
                        watch),

                "collect_diagnostics" =>
                    await CollectDiagnosticsAsync(
                        collectAndUpload,
                        watch),

                "sfc_verify" =>
                    await RunToolAsync(
                        "sfc.exe",
                        ["/verifyonly"],
                        "Verificação SFC concluída.",
                        watch,
                        TimeSpan.FromMinutes(20)),

                "sfc_scannow" =>
                    await RunToolAsync(
                        "sfc.exe",
                        ["/scannow"],
                        "Reparo SFC concluído.",
                        watch,
                        TimeSpan.FromMinutes(45)),

                "dism_scanhealth" =>
                    await RunToolAsync(
                        "dism.exe",
                        [
                            "/Online",
                            "/Cleanup-Image",
                            "/ScanHealth",
                            "/NoRestart",
                        ],
                        "Verificação DISM concluída.",
                        watch,
                        TimeSpan.FromMinutes(45)),

                "dism_restorehealth" =>
                    await RunToolAsync(
                        "dism.exe",
                        [
                            "/Online",
                            "/Cleanup-Image",
                            "/RestoreHealth",
                            "/NoRestart",
                        ],
                        "Reparo DISM concluído.",
                        watch,
                        TimeSpan.FromMinutes(90)),

                "flush_dns" =>
                    await RunToolAsync(
                        "ipconfig.exe",
                        ["/flushdns"],
                        "Cache DNS limpo.",
                        watch,
                        TimeSpan.FromMinutes(2)),

                "cleanup_temp" =>
                    await CleanupTempAsync(watch),

                "optimize_system_drive" =>
                    await OptimizeSystemDriveAsync(
                        watch),

                "uninstall_software" =>
                    await UninstallSoftwareAsync(
                        command,
                        collectAndUpload,
                        watch),

                _ =>
                    new CommandExecutionResult
                    {
                        Success = false,
                        ExitCode = -3,
                        Summary =
                            "Comando não suportado por esta versão do agente.",
                        Output =
                            command.CommandType,
                        DurationMs =
                            watch.ElapsedMilliseconds,
                    },
            };
        }
        catch (Exception ex)
        {
            log.Write(
                $"Comando {command.CommandType} falhou: {ex}");

            return new CommandExecutionResult
            {
                Success = false,
                ExitCode = -1,
                Summary =
                    "A ação remota falhou.",
                Output =
                    Program.Limit(
                        ex.ToString(),
                        12000),
                DurationMs =
                    watch.ElapsedMilliseconds,
            };
        }
    }

    private static async Task<CommandExecutionResult>
        CollectAsync(
            string summary,
            Func<Task<InventoryUploadResult>>
                collectAndUpload,
            Stopwatch watch)
    {
        var uploaded =
            await collectAndUpload();

        return new CommandExecutionResult
        {
            Success = true,
            ExitCode = 0,
            Summary = summary,
            Output =
                $"Programas: {uploaded.SoftwareCount}; " +
                $"volumes: {uploaded.LogicalDiskCount}.",
            DurationMs =
                watch.ElapsedMilliseconds,
        };
    }

    private static async Task<CommandExecutionResult>
        CollectDiagnosticsAsync(
            Func<Task<InventoryUploadResult>>
                collectAndUpload,
            Stopwatch watch)
    {
        var uploaded =
            await collectAndUpload();

        var dism =
            await AgentInstaller.RunProcessAsync(
                "dism.exe",
                [
                    "/Online",
                    "/Cleanup-Image",
                    "/CheckHealth",
                    "/NoRestart",
                ],
                TimeSpan.FromMinutes(10));

        return new CommandExecutionResult
        {
            Success =
                dism.ExitCode == 0,
            ExitCode =
                dism.ExitCode,
            Summary =
                "Diagnóstico atualizado e integridade rápida do Windows verificada.",
            Output =
                Program.Limit(
                    string.Join(
                        Environment.NewLine,
                        $"Programas: {uploaded.SoftwareCount}; volumes: {uploaded.LogicalDiskCount}.",
                        dism.Output,
                        dism.Error),
                    12000),
            DurationMs =
                watch.ElapsedMilliseconds,
        };
    }

    private static async Task<CommandExecutionResult>
        RunToolAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            string summary,
            Stopwatch watch,
            TimeSpan timeout)
    {
        var result =
            await AgentInstaller.RunProcessAsync(
                fileName,
                arguments,
                timeout);

        return new CommandExecutionResult
        {
            Success = result.ExitCode == 0,
            ExitCode = result.ExitCode,
            Summary = summary,
            Output =
                Program.Limit(
                    string.Join(
                        Environment.NewLine,
                        result.Output,
                        result.Error),
                    12000),
            DurationMs =
                watch.ElapsedMilliseconds,
        };
    }

    private static Task<CommandExecutionResult>
        CleanupTempAsync(
            Stopwatch watch)
    {
        long deletedBytes = 0;
        var deletedFiles = 0;
        var cutoff =
            DateTime.UtcNow.AddDays(-14);

        var targets =
            new HashSet<string>(
                StringComparer.OrdinalIgnoreCase)
            {
                Path.GetTempPath(),
                Path.Combine(
                    Environment.GetFolderPath(
                        Environment.SpecialFolder.Windows),
                    "Temp"),
            };

        foreach (var target in targets)
        {
            if (!Directory.Exists(target))
            {
                continue;
            }

            foreach (var file in Directory.EnumerateFiles(
                         target,
                         "*",
                         SearchOption.TopDirectoryOnly))
            {
                try
                {
                    var info =
                        new FileInfo(file);

                    if (info.LastWriteTimeUtc >
                        cutoff)
                    {
                        continue;
                    }

                    var length = info.Length;
                    info.Delete();
                    deletedBytes += length;
                    deletedFiles++;
                }
                catch
                {
                    // Arquivos em uso são ignorados.
                }
            }
        }

        return Task.FromResult(
            new CommandExecutionResult
            {
                Success = true,
                ExitCode = 0,
                Summary =
                    "Limpeza segura de temporários concluída.",
                Output =
                    $"{deletedFiles} arquivos antigos removidos; " +
                    $"{deletedBytes / 1024d / 1024d:N1} MB liberados.",
                DurationMs =
                    watch.ElapsedMilliseconds,
            });
    }

    private static async Task<CommandExecutionResult>
        OptimizeSystemDriveAsync(
            Stopwatch watch)
    {
        var drive =
            Environment.GetEnvironmentVariable(
                "SystemDrive")
            ?.TrimEnd(':', '\\');

        if (string.IsNullOrWhiteSpace(
                drive))
        {
            drive = "C";
        }

        var script =
            $"Optimize-Volume -DriveLetter {drive} -Verbose -ErrorAction Stop | Out-String";

        var encoded =
            Convert.ToBase64String(
                System.Text.Encoding.Unicode.GetBytes(
                    script));

        var shell = Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.System),
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe");

        var result =
            await AgentInstaller.RunProcessAsync(
                File.Exists(shell)
                    ? shell
                    : "powershell.exe",
                [
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-EncodedCommand",
                    encoded,
                ],
                TimeSpan.FromMinutes(45));

        return new CommandExecutionResult
        {
            Success = result.ExitCode == 0,
            ExitCode = result.ExitCode,
            Summary =
                "Otimização do volume do sistema concluída.",
            Output =
                Program.Limit(
                    string.Join(
                        Environment.NewLine,
                        result.Output,
                        result.Error),
                    12000),
            DurationMs =
                watch.ElapsedMilliseconds,
        };
    }
    private static readonly HashSet<string>
        BlockedExecutables =
            new(
                StringComparer.OrdinalIgnoreCase)
            {
                "cmd.exe",
                "powershell.exe",
                "pwsh.exe",
                "wscript.exe",
                "cscript.exe",
                "mshta.exe",
                "rundll32.exe",
            };

    private static async Task<CommandExecutionResult>
        UninstallSoftwareAsync(
            RemoteCommand command,
            Func<Task<InventoryUploadResult>>
                collectAndUpload,
            Stopwatch watch)
    {
        var softwareId =
            RequiredParameter(
                command.Parameters,
                "software_id");
        var expectedName =
            RequiredParameter(
                command.Parameters,
                "expected_name");

        var separator =
            softwareId.IndexOf('|');

        if (separator <= 0 ||
            separator >= softwareId.Length - 1)
        {
            throw new InvalidOperationException(
                "Identificador de desinstalação inválido.");
        }

        var rootCode =
            softwareId[..separator];
        var keyName =
            softwareId[(separator + 1)..];

        if (keyName.Contains('\\') ||
            keyName.Contains('/') ||
            keyName.Contains("..",
                StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Identificador de software recusado.");
        }

        var (
            hive,
            registryPath,
            view
        ) = ResolveUninstallKey(
            rootCode,
            keyName);

        using var baseKey =
            RegistryKey.OpenBaseKey(
                hive,
                view);
        using var key =
            baseKey.OpenSubKey(
                registryPath,
                writable: false)
            ?? throw new InvalidOperationException(
                "O programa não está mais registrado para desinstalação.");

        var displayName =
            Convert.ToString(
                key.GetValue(
                    "DisplayName"))
            ?.Trim();

        if (string.IsNullOrWhiteSpace(
                displayName) ||
            !string.Equals(
                displayName,
                expectedName.Trim(),
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "O programa registrado não corresponde à solicitação.");
        }

        var windowsInstaller =
            Convert.ToInt32(
                key.GetValue(
                    "WindowsInstaller",
                    0)) == 1;

        ProcessResult result;

        if (windowsInstaller &&
            Guid.TryParse(
                keyName.Trim(
                    '{',
                    '}'),
                out _))
        {
            result =
                await AgentInstaller.RunProcessAsync(
                    "msiexec.exe",
                    [
                        "/x",
                        keyName,
                        "/qn",
                        "/norestart",
                    ],
                    TimeSpan.FromMinutes(30));
        }
        else
        {
            var quiet =
                Convert.ToString(
                    key.GetValue(
                        "QuietUninstallString"))
                ?.Trim();

            if (string.IsNullOrWhiteSpace(
                    quiet))
            {
                throw new InvalidOperationException(
                    "Este programa não oferece desinstalação silenciosa segura.");
            }

            var (
                executable,
                arguments
            ) = SplitExecutable(
                Environment
                    .ExpandEnvironmentVariables(
                        quiet));

            if (!Path.IsPathRooted(
                    executable) ||
                !string.Equals(
                    Path.GetExtension(
                        executable),
                    ".exe",
                    StringComparison
                        .OrdinalIgnoreCase) ||
                !File.Exists(executable))
            {
                throw new InvalidOperationException(
                    "Executável de desinstalação inválido.");
            }

            if (BlockedExecutables.Contains(
                    Path.GetFileName(
                        executable)))
            {
                throw new InvalidOperationException(
                    "Interpretadores e comandos genéricos não são permitidos.");
            }

            result =
                await AgentInstaller
                    .RunProcessRawAsync(
                        executable,
                        arguments,
                        TimeSpan.FromMinutes(
                            30));
        }

        var successCodes =
            new HashSet<int>
            {
                0,
                1605,
                1614,
                1641,
                3010,
            };

        var success =
            successCodes.Contains(
                result.ExitCode);

        if (success)
        {
            try
            {
                await collectAndUpload();
            }
            catch
            {
                // A desinstalação não deve ser marcada
                // como falha apenas porque a coleta
                // posterior não foi concluída.
            }
        }

        return new CommandExecutionResult
        {
            Success = success,
            ExitCode = result.ExitCode,
            Summary = success
                ? $"Desinstalação de {displayName} concluída."
                : $"A desinstalação de {displayName} retornou erro.",
            Output =
                Program.Limit(
                    string.Join(
                        Environment.NewLine,
                        result.Output,
                        result.Error),
                    12000),
            DurationMs =
                watch.ElapsedMilliseconds,
        };
    }

    private static string RequiredParameter(
        JsonElement parameters,
        string name)
    {
        if (parameters.ValueKind !=
                JsonValueKind.Object ||
            !parameters.TryGetProperty(
                name,
                out var value) ||
            value.ValueKind !=
                JsonValueKind.String)
        {
            throw new InvalidOperationException(
                $"Parâmetro {name} ausente.");
        }

        var clean =
            value.GetString()?.Trim();

        if (string.IsNullOrWhiteSpace(
                clean) ||
            clean.Length > 500)
        {
            throw new InvalidOperationException(
                $"Parâmetro {name} inválido.");
        }

        return clean;
    }

    private static (
        RegistryHive Hive,
        string Path,
        RegistryView View
    ) ResolveUninstallKey(
        string rootCode,
        string keyName)
    {
        return rootCode switch
        {
            "HKLM64" =>
                (
                    RegistryHive.LocalMachine,
                    $@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{keyName}",
                    RegistryView.Registry64
                ),
            "HKLM32" =>
                (
                    RegistryHive.LocalMachine,
                    $@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{keyName}",
                    RegistryView.Registry32
                ),
            "HKCU" =>
                (
                    RegistryHive.CurrentUser,
                    $@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{keyName}",
                    RegistryView.Default
                ),
            _ =>
                throw new InvalidOperationException(
                    "Origem do software inválida."),
        };
    }

    private static (
        string Executable,
        string Arguments
    ) SplitExecutable(
        string commandLine)
    {
        var value =
            commandLine.Trim();

        if (value.Length == 0)
        {
            throw new InvalidOperationException(
                "Comando de desinstalação vazio.");
        }

        if (value[0] == '"')
        {
            var closing =
                value.IndexOf(
                    '"',
                    1);

            if (closing <= 1)
            {
                throw new InvalidOperationException(
                    "Comando de desinstalação inválido.");
            }

            return (
                value[1..closing],
                value[(closing + 1)..]
                    .Trim()
            );
        }

        var exeMarker =
            value.IndexOf(
                ".exe",
                StringComparison
                    .OrdinalIgnoreCase);

        if (exeMarker < 1)
        {
            throw new InvalidOperationException(
                "Executável de desinstalação não identificado.");
        }

        var end =
            exeMarker + 4;

        return (
            value[..end].Trim(),
            value[end..].Trim()
        );
    }

}
