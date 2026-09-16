using System.Diagnostics;
using System.Security.Principal;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace InventarioTI.Agent;

internal static class Program
{
    internal const string AgentVersion = "2.0.1";
    internal const string ProtocolVersion = "1";

    private static readonly Regex ActivationPattern = new(
        @"(?:AG|WT)-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [STAThread]
    private static async Task<int> Main(string[] args)
    {
        var paths = AgentPaths.Create();
        var log = new AgentLog(paths.LogPath);

        try
        {
            if (HasArg(args, "--scheduled") ||
                HasArg(args, "--once") ||
                IsInstalledExecutable(paths))
            {
                using var semaphore =
                    new Semaphore(
                        initialCount: 1,
                        maximumCount: 1,
                        name:
                            @"Global\InventarioTI.Agent.Endpoint");

                if (!semaphore.WaitOne(0))
                {
                    log.Write(
                        "Outra execução do agente já está ativa.");
                    return 0;
                }

                try
                {
                    return await RunAgentCycleAsync(
                        paths,
                        log);
                }
                finally
                {
                    semaphore.Release();
                }
            }

            var activationCode =
                GetArgValue(args, "--activate") ??
                ReadActivationFromExecutableName();

            if (string.IsNullOrWhiteSpace(activationCode))
            {
                NativeUi.Show(
                    "Inventário TI Agent",
                    "Este instalador não possui um código de ativação.\n\n" +
                    "Baixe o instalador diretamente pela ficha do patrimônio no sistema.");
                return 2;
            }

            if (!IsAdministrator())
            {
                NativeUi.Show(
                    "Inventário TI Agent",
                    "A instalação precisa ser executada como administrador.");
                return 3;
            }

            return await AgentInstaller.InstallAsync(
                activationCode,
                paths,
                log);
        }
        catch (Exception ex)
        {
            log.Write($"FATAL: {ex}");

            if (!HasArg(args, "--scheduled"))
            {
                NativeUi.Show(
                    "Inventário TI Agent",
                    "Não foi possível concluir a operação.\n\n" +
                    ex.Message);
            }

            return 1;
        }
    }

    private static async Task<int> RunAgentCycleAsync(
        AgentPaths paths,
        AgentLog log)
    {
        if (!File.Exists(paths.ConfigPath))
        {
            log.Write("Configuração não encontrada.");
            return 4;
        }

        var config = JsonSerializer.Deserialize(
            await File.ReadAllTextAsync(paths.ConfigPath),
            AgentJsonContext.Default.AgentConfig)
            ?? throw new InvalidOperationException(
                "Configuração do agente inválida.");

        ValidateConfig(config);

        var backend = new AgentBackendClient(config, log);

        RemoteCommand? command = null;

        try
        {
            command = await backend.PollCommandAsync();
        }
        catch (Exception ex)
        {
            log.Write($"Falha ao consultar comandos: {ex.Message}");
        }

        var state = await AgentStateStore.LoadAsync(paths.StatePath);

        async Task<InventoryUploadResult> CollectAndUploadAsync()
        {
            var inventory =
                await InventoryCollector.CollectAsync(log);

            var payload = new AgentPayload
            {
                ProtocolVersion = ProtocolVersion,
                AgentVersion = AgentVersion,
                CollectedAt = DateTimeOffset.UtcNow,
                Machine = inventory.Machine,
                Os = inventory.Os,
                Hardware = inventory.Hardware,
                Disks = inventory.Disks,
                Software = inventory.Software,
                Health = inventory.Health,
            };

            await backend.UploadInventoryAsync(payload);

            state.LastInventoryAt =
                DateTimeOffset.UtcNow;
            await AgentStateStore.SaveAsync(
                paths.StatePath,
                state);

            return new InventoryUploadResult
            {
                SoftwareCount =
                    inventory.Software.Count,
                LogicalDiskCount =
                    inventory.Disks.Count,
            };
        }

        if (command is not null)
        {
            log.Write(
                $"Executando comando {command.Id}: {command.CommandType}");

            CommandExecutionResult result;

            try
            {
                result =
                    await RemoteCommandExecutor.ExecuteAsync(
                        command,
                        CollectAndUploadAsync,
                        log);
            }
            catch (Exception ex)
            {
                result = new CommandExecutionResult
                {
                    Success = false,
                    ExitCode = -1,
                    Summary =
                        "A ação remota falhou.",
                    Output = Limit(ex.ToString(), 12000),
                    DurationMs = 0,
                };
            }

            try
            {
                await backend.CompleteCommandAsync(
                    command.Id,
                    result);
            }
            catch (Exception ex)
            {
                log.Write(
                    $"Falha ao concluir comando no servidor: {ex.Message}");
            }
        }

        var inventoryDue =
            state.LastInventoryAt is null ||
            DateTimeOffset.UtcNow -
                state.LastInventoryAt.Value >=
                TimeSpan.FromMinutes(15);

        if (inventoryDue &&
            command?.CommandType is not
                ("collect_inventory" or
                 "collect_diagnostics"))
        {
            try
            {
                await CollectAndUploadAsync();
            }
            catch (Exception ex)
            {
                log.Write(
                    $"Falha na coleta periódica: {ex}");
                return 5;
            }
        }

        return 0;
    }

    private static void ValidateConfig(
        AgentConfig config)
    {
        if (!Uri.TryCreate(
                config.ProjectUrl,
                UriKind.Absolute,
                out var projectUri) ||
            projectUri.Scheme !=
                Uri.UriSchemeHttps)
        {
            throw new InvalidOperationException(
                "URL do projeto inválida.");
        }

        if (string.IsNullOrWhiteSpace(
                config.PublishableKey))
        {
            throw new InvalidOperationException(
                "Chave publicável ausente.");
        }

        if (string.IsNullOrWhiteSpace(
                config.AgentToken) ||
            !(
                config.AgentToken.StartsWith(
                    "wti_",
                    StringComparison.Ordinal) ||
                config.AgentToken.StartsWith(
                    "agt_",
                    StringComparison.Ordinal)
            ))
        {
            throw new InvalidOperationException(
                "Credencial do agente inválida.");
        }
    }

    private static bool IsInstalledExecutable(
        AgentPaths paths)
    {
        var current =
            Path.GetFullPath(
                Environment.ProcessPath ??
                string.Empty);

        return string.Equals(
            current,
            Path.GetFullPath(
                paths.InstalledExePath),
            StringComparison.OrdinalIgnoreCase);
    }

    private static string? ReadActivationFromExecutableName()
    {
        var fileName =
            Path.GetFileNameWithoutExtension(
                Environment.ProcessPath ??
                string.Empty);

        var match =
            ActivationPattern.Match(fileName);

        return match.Success
            ? match.Value.ToUpperInvariant()
            : null;
    }

    private static bool HasArg(
        string[] args,
        string value)
        => args.Any(
            item => string.Equals(
                item,
                value,
                StringComparison.OrdinalIgnoreCase));

    private static string? GetArgValue(
        string[] args,
        string name)
    {
        for (var index = 0;
             index < args.Length - 1;
             index++)
        {
            if (string.Equals(
                    args[index],
                    name,
                    StringComparison.OrdinalIgnoreCase))
            {
                return args[index + 1];
            }
        }

        return null;
    }

    private static bool IsAdministrator()
    {
        using var identity =
            WindowsIdentity.GetCurrent();

        var principal =
            new WindowsPrincipal(identity);

        return principal.IsInRole(
            WindowsBuiltInRole.Administrator);
    }

    internal static string MachineGuid()
        => Convert.ToString(
               Registry.GetValue(
                   @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography",
                   "MachineGuid",
                   null))
           ?.Trim()
           ?? string.Empty;

    internal static string Limit(
        string? text,
        int max)
    {
        var value = text ?? string.Empty;
        return value.Length <= max
            ? value
            : value[..max];
    }
}

internal sealed class AgentPaths
{
    public required string Root { get; init; }
    public required string InstalledExePath { get; init; }
    public required string ConfigPath { get; init; }
    public required string StatePath { get; init; }
    public required string LogPath { get; init; }

    public static AgentPaths Create()
    {
        var root = Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.CommonApplicationData),
            "InventarioTI",
            "Agent");

        return new AgentPaths
        {
            Root = root,
            InstalledExePath =
                Path.Combine(
                    root,
                    "InventarioTI.Agent.exe"),
            ConfigPath =
                Path.Combine(
                    root,
                    "agent.json"),
            StatePath =
                Path.Combine(
                    root,
                    "state.json"),
            LogPath =
                Path.Combine(
                    root,
                    "logs",
                    "agent.log"),
        };
    }
}

internal sealed class AgentLog
{
    private readonly string _path;

    public AgentLog(string path)
    {
        _path = path;

        Directory.CreateDirectory(
            Path.GetDirectoryName(path)!);

        try
        {
            if (File.Exists(_path) &&
                new FileInfo(_path).Length >
                    5_000_000)
            {
                File.Move(
                    _path,
                    Path.Combine(
                        Path.GetDirectoryName(_path)!,
                        $"agent-{DateTime.UtcNow:yyyyMMddHHmmss}.log"),
                    overwrite: true);
            }
        }
        catch
        {
            // Logging must never block the agent.
        }
    }

    public void Write(string message)
    {
        try
        {
            File.AppendAllText(
                _path,
                $"{DateTimeOffset.Now:O} {message}{Environment.NewLine}");
        }
        catch
        {
            // Logging must never block the agent.
        }
    }
}
