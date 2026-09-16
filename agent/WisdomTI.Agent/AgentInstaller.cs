using System.Diagnostics;
using System.Reflection;
using System.Text.Json;

namespace WisdomTI.Agent;

internal static class AgentInstaller
{
    private const string EndpointTask =
        "Wisdom TI Agent - Endpoint";
    private const string StartupTask =
        "Wisdom TI Agent - Endpoint Startup";

    public static async Task<int> InstallAsync(
        string activationCode,
        AgentPaths paths,
        AgentLog log)
    {
        var instance =
            LoadInstanceConfig();

        if (!Uri.TryCreate(
                instance.ProjectUrl,
                UriKind.Absolute,
                out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            string.IsNullOrWhiteSpace(
                instance.PublishableKey))
        {
            throw new InvalidOperationException(
                "O instalador não contém a configuração da instância.");
        }

        var machineGuid =
            Program.MachineGuid();

        if (string.IsNullOrWhiteSpace(
                machineGuid))
        {
            throw new InvalidOperationException(
                "Não foi possível identificar o Windows desta máquina.");
        }

        var hostname =
            Environment.MachineName;

        var claim =
            await AgentBackendClient.ClaimActivationAsync(
                instance,
                activationCode,
                machineGuid,
                hostname);

        if (string.IsNullOrWhiteSpace(
                claim.AgentToken))
        {
            throw new InvalidOperationException(
                "O servidor não retornou a credencial definitiva.");
        }

        Directory.CreateDirectory(paths.Root);
        Directory.CreateDirectory(
            Path.GetDirectoryName(
                paths.LogPath)!);

        var currentExe =
            Environment.ProcessPath
            ?? throw new InvalidOperationException(
                "Executável atual não identificado.");

        if (!string.Equals(
                Path.GetFullPath(currentExe),
                Path.GetFullPath(
                    paths.InstalledExePath),
                StringComparison.OrdinalIgnoreCase))
        {
            File.Copy(
                currentExe,
                paths.InstalledExePath,
                overwrite: true);
        }

        var config = new AgentConfig
        {
            ProjectUrl =
                instance.ProjectUrl.TrimEnd('/'),
            PublishableKey =
                instance.PublishableKey,
            AgentToken =
                claim.AgentToken,
        };

        await File.WriteAllTextAsync(
            paths.ConfigPath,
            JsonSerializer.Serialize(
                config,
                AgentJsonContext.Default.AgentConfig));

        await ProtectFolderAsync(paths.Root);

        await DeleteTaskAsync(
            "Wisdom TI Agent - Startup");
        await DeleteTaskAsync(
            "Wisdom TI Agent - Heartbeat");
        await DeleteTaskAsync(
            EndpointTask);
        await DeleteTaskAsync(
            StartupTask);

        var taskCommand =
            $"\"{paths.InstalledExePath}\" --scheduled";

        await RunRequiredAsync(
            "schtasks.exe",
            [
                "/Create",
                "/TN", EndpointTask,
                "/TR", taskCommand,
                "/SC", "MINUTE",
                "/MO", "1",
                "/RU", "SYSTEM",
                "/RL", "HIGHEST",
                "/F",
            ],
            "Não foi possível criar a tarefa periódica.");

        await RunRequiredAsync(
            "schtasks.exe",
            [
                "/Create",
                "/TN", StartupTask,
                "/TR", taskCommand,
                "/SC", "ONSTART",
                "/RU", "SYSTEM",
                "/RL", "HIGHEST",
                "/F",
            ],
            "Não foi possível criar a tarefa de inicialização.");

        var firstRun =
            await RunProcessAsync(
                paths.InstalledExePath,
                ["--once"],
                timeout:
                    TimeSpan.FromMinutes(5));

        if (firstRun.ExitCode != 0)
        {
            log.Write(
                $"Primeira coleta retornou {firstRun.ExitCode}: {firstRun.Error}");

            NativeUi.Show(
                "Wisdom TI Agent",
                "O agente foi instalado e será executado automaticamente, " +
                "mas a primeira coleta não foi concluída.\n\n" +
                $"Patrimônio: {claim.AssetCode}\n" +
                "A equipe de TI poderá verificar o log do agente.");
            return 0;
        }

        NativeUi.Show(
            "Wisdom TI Agent",
            "Instalação concluída com sucesso.\n\n" +
            $"Patrimônio: {claim.AssetCode}\n" +
            "O inventário e os diagnósticos serão enviados automaticamente.");

        return 0;
    }

    private static InstanceConfig LoadInstanceConfig()
    {
        using var stream =
            Assembly.GetExecutingAssembly()
                .GetManifestResourceStream(
                    "WisdomTI.Agent.InstanceConfig.json")
            ?? throw new InvalidOperationException(
                "Configuração da instância ausente no instalador.");

        return JsonSerializer.Deserialize(
                   stream,
                   AgentJsonContext.Default.InstanceConfig)
               ?? throw new InvalidOperationException(
                   "Configuração da instância inválida.");
    }

    private static async Task ProtectFolderAsync(
        string root)
    {
        await RunRequiredAsync(
            "icacls.exe",
            [
                root,
                "/inheritance:r",
                "/grant:r",
                "*S-1-5-18:(OI)(CI)F",
                "*S-1-5-32-544:(OI)(CI)F",
            ],
            "Não foi possível proteger a pasta do agente.");
    }

    private static async Task DeleteTaskAsync(
        string task)
    {
        _ = await RunProcessAsync(
            "schtasks.exe",
            ["/Delete", "/TN", task, "/F"],
            timeout:
                TimeSpan.FromSeconds(30));
    }

    internal static async Task<ProcessResult>
        RunProcessAsync(
            string fileName,
            IReadOnlyList<string> arguments,
            TimeSpan? timeout = null)
    {
        var start =
            new ProcessStartInfo
            {
                FileName = fileName,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };

        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }

        using var process =
            Process.Start(start)
            ?? throw new InvalidOperationException(
                $"Não foi possível iniciar {fileName}.");

        using var cts =
            new CancellationTokenSource(
                timeout ??
                TimeSpan.FromMinutes(15));

        var stdoutTask =
            process.StandardOutput.ReadToEndAsync();
        var stderrTask =
            process.StandardError.ReadToEndAsync();

        try
        {
            await process.WaitForExitAsync(
                cts.Token);
        }
        catch (OperationCanceledException)
        {
            try
            {
                process.Kill(
                    entireProcessTree: true);
            }
            catch
            {
                // Best effort.
            }

            return new ProcessResult
            {
                ExitCode = -2,
                Output = await stdoutTask,
                Error =
                    "Tempo limite excedido.",
            };
        }

        return new ProcessResult
        {
            ExitCode = process.ExitCode,
            Output = await stdoutTask,
            Error = await stderrTask,
        };
    }

    private static async Task RunRequiredAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        string message)
    {
        var result =
            await RunProcessAsync(
                fileName,
                arguments,
                TimeSpan.FromMinutes(2));

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"{message}\n\n" +
                Program.Limit(
                    result.Error,
                    2000));
        }
    }
}

internal sealed class ProcessResult
{
    public int ExitCode { get; set; }
    public string Output { get; set; } = "";
    public string Error { get; set; } = "";
}