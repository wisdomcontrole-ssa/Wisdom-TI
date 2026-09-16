using System.Diagnostics;

namespace WisdomTI.Agent;

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
}