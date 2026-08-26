using System.Diagnostics;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WisdomTI.Agent;

internal static class Program
{
    private const string AgentVersion = "1.0.0";
    private const string ProtocolVersion = "1";

    private static async Task<int> Main(string[] args)
    {
        var configPath = GetConfigPath(args);
        var log = new AgentLog();

        try
        {
            log.Write("Agent start.");

            if (!File.Exists(configPath))
            {
                throw new InvalidOperationException(
                    $"Config not found: {configPath}");
            }

            var configJson = await File.ReadAllTextAsync(configPath);
            var config = JsonSerializer.Deserialize<AgentConfig>(
                configJson,
                JsonOptions.Default)
                ?? throw new InvalidOperationException("Invalid agent config.");

            ValidateConfig(config);

            var inventory = await InventoryCollector.CollectAsync(log);

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
                Health = new Dictionary<string, object?>
                {
                    ["collector"] = "powershell-cim",
                    ["software_count"] = inventory.Software.Count,
                    ["disk_count"] = inventory.Disks.Count,
                },
            };

            using var client = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(60),
            };

            client.DefaultRequestHeaders.UserAgent.ParseAdd(
                $"WisdomTI-Agent/{AgentVersion}");
            client.DefaultRequestHeaders.Add(
                "x-wisdom-agent-token",
                config.AgentToken);

            var endpoint =
                $"{config.ProjectUrl.TrimEnd('/')}/functions/v1/agent-ingest";

            using var response = await client.PostAsJsonAsync(
                endpoint,
                payload,
                JsonOptions.Default);

            var responseText = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                log.Write(
                    $"Upload failed HTTP {(int)response.StatusCode}: {Limit(responseText, 1200)}");
                return 2;
            }

            log.Write($"Upload OK: {Limit(responseText, 1000)}");
            return 0;
        }
        catch (Exception ex)
        {
            log.Write($"ERROR: {ex}");
            return 1;
        }
    }

    private static string GetConfigPath(string[] args)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (string.Equals(
                args[i],
                "--config",
                StringComparison.OrdinalIgnoreCase))
            {
                return args[i + 1];
            }
        }

        var root = Environment.GetFolderPath(
            Environment.SpecialFolder.CommonApplicationData);

        return Path.Combine(
            root,
            "WisdomTI",
            "Agent",
            "agent.json");
    }

    private static void ValidateConfig(AgentConfig config)
    {
        if (!Uri.TryCreate(
            config.ProjectUrl,
            UriKind.Absolute,
            out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps)
        {
            throw new InvalidOperationException(
                "ProjectUrl must use HTTPS.");
        }

        if (string.IsNullOrWhiteSpace(config.AgentToken) ||
            !config.AgentToken.StartsWith(
                "wti_",
                StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Agent token invalid.");
        }
    }

    private static string Limit(string text, int max)
        => text.Length <= max ? text : text[..max];
}

internal sealed class AgentConfig
{
    [JsonPropertyName("project_url")]
    public string ProjectUrl { get; set; } = "";

    [JsonPropertyName("agent_token")]
    public string AgentToken { get; set; } = "";
}

internal sealed class AgentPayload
{
    [JsonPropertyName("protocol_version")]
    public string ProtocolVersion { get; set; } = "";

    [JsonPropertyName("agent_version")]
    public string AgentVersion { get; set; } = "";

    [JsonPropertyName("collected_at")]
    public DateTimeOffset CollectedAt { get; set; }

    [JsonPropertyName("machine")]
    public MachineInfo Machine { get; set; } = new();

    [JsonPropertyName("os")]
    public OsInfo Os { get; set; } = new();

    [JsonPropertyName("hardware")]
    public HardwareInfo Hardware { get; set; } = new();

    [JsonPropertyName("disks")]
    public List<DiskInfo> Disks { get; set; } = [];

    [JsonPropertyName("software")]
    public List<SoftwareInfo> Software { get; set; } = [];

    [JsonPropertyName("health")]
    public Dictionary<string, object?> Health { get; set; } = [];
}

internal sealed class InventoryResult
{
    [JsonPropertyName("machine")]
    public MachineInfo Machine { get; set; } = new();

    [JsonPropertyName("os")]
    public OsInfo Os { get; set; } = new();

    [JsonPropertyName("hardware")]
    public HardwareInfo Hardware { get; set; } = new();

    [JsonPropertyName("disks")]
    public List<DiskInfo> Disks { get; set; } = [];

    [JsonPropertyName("software")]
    public List<SoftwareInfo> Software { get; set; } = [];
}

internal sealed class MachineInfo
{
    [JsonPropertyName("machine_guid")]
    public string? MachineGuid { get; set; }

    [JsonPropertyName("hostname")]
    public string? Hostname { get; set; }

    [JsonPropertyName("manufacturer")]
    public string? Manufacturer { get; set; }

    [JsonPropertyName("model")]
    public string? Model { get; set; }

    [JsonPropertyName("serial_number")]
    public string? SerialNumber { get; set; }
}

internal sealed class OsInfo
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("version")]
    public string? Version { get; set; }

    [JsonPropertyName("build")]
    public string? Build { get; set; }

    [JsonPropertyName("architecture")]
    public string? Architecture { get; set; }

    [JsonPropertyName("last_boot_utc")]
    public string? LastBootUtc { get; set; }
}

internal sealed class HardwareInfo
{
    [JsonPropertyName("cpu_name")]
    public string? CpuName { get; set; }

    [JsonPropertyName("cpu_cores")]
    public int? CpuCores { get; set; }

    [JsonPropertyName("logical_processors")]
    public int? LogicalProcessors { get; set; }

    [JsonPropertyName("ram_bytes")]
    public long? RamBytes { get; set; }
}

internal sealed class DiskInfo
{
    [JsonPropertyName("device_id")]
    public string? DeviceId { get; set; }

    [JsonPropertyName("label")]
    public string? Label { get; set; }

    [JsonPropertyName("size_bytes")]
    public long? SizeBytes { get; set; }

    [JsonPropertyName("free_bytes")]
    public long? FreeBytes { get; set; }

    [JsonPropertyName("system_drive")]
    public bool SystemDrive { get; set; }
}

internal sealed class SoftwareInfo
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("version")]
    public string? Version { get; set; }

    [JsonPropertyName("publisher")]
    public string? Publisher { get; set; }
}

internal sealed class AgentLog
{
    private readonly string _path;

    public AgentLog()
    {
        var root = Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.CommonApplicationData),
            "WisdomTI",
            "Agent",
            "logs");

        Directory.CreateDirectory(root);
        _path = Path.Combine(root, "agent.log");

        try
        {
            if (File.Exists(_path) &&
                new FileInfo(_path).Length > 5_000_000)
            {
                File.Move(
                    _path,
                    Path.Combine(
                        root,
                        $"agent-{DateTime.UtcNow:yyyyMMddHHmmss}.log"),
                    overwrite: true);
            }
        }
        catch
        {
            // Logging must not prevent inventory.
        }
    }

    public void Write(string message)
    {
        try
        {
            File.AppendAllText(
                _path,
                $"{DateTimeOffset.Now:O} {message}{Environment.NewLine}",
                Encoding.UTF8);
        }
        catch
        {
            // Do not fail the agent because of logging.
        }
    }
}

internal static class InventoryCollector
{
    private const string Script = """
$ErrorActionPreference = 'Stop'

$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem
$guid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid
$systemDrive = $env:SystemDrive

$disks = @(
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
        ForEach-Object {
            [pscustomobject]@{
                device_id = $_.DeviceID
                label = $_.VolumeName
                size_bytes = [int64]$_.Size
                free_bytes = [int64]$_.FreeSpace
                system_drive = ($_.DeviceID -eq $systemDrive)
            }
        }
)

$softwareRows = New-Object System.Collections.Generic.List[object]
$paths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

foreach ($path in $paths) {
    Get-ItemProperty $path -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName } |
        ForEach-Object {
            $softwareRows.Add(
                [pscustomobject]@{
                    name = [string]$_.DisplayName
                    version = [string]$_.DisplayVersion
                    publisher = [string]$_.Publisher
                }
            )
        }
}

$software = @(
    $softwareRows |
        Sort-Object name, version, publisher -Unique |
        Select-Object -First 2000
)

$result = [pscustomobject]@{
    machine = [pscustomobject]@{
        machine_guid = [string]$guid
        hostname = [string]$env:COMPUTERNAME
        manufacturer = [string]$cs.Manufacturer
        model = [string]$cs.Model
        serial_number = [string]$bios.SerialNumber
    }
    os = [pscustomobject]@{
        name = [string]$os.Caption
        version = [string]$os.Version
        build = [string]$os.BuildNumber
        architecture = [string]$os.OSArchitecture
        last_boot_utc = ([DateTime]$os.LastBootUpTime).ToUniversalTime().ToString('o')
    }
    hardware = [pscustomobject]@{
        cpu_name = [string]$cpu.Name
        cpu_cores = [int]$cpu.NumberOfCores
        logical_processors = [int]$cpu.NumberOfLogicalProcessors
        ram_bytes = [int64]$cs.TotalPhysicalMemory
    }
    disks = $disks
    software = $software
}

$result | ConvertTo-Json -Depth 7 -Compress
""";

    public static async Task<InventoryResult> CollectAsync(AgentLog log)
    {
        var shell = Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.System),
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe");

        if (!File.Exists(shell))
        {
            shell = "powershell.exe";
        }

        var encoded = Convert.ToBase64String(
            Encoding.Unicode.GetBytes(Script));

        var start = new ProcessStartInfo
        {
            FileName = shell,
            Arguments =
                $"-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand {encoded}",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = Process.Start(start)
            ?? throw new InvalidOperationException(
                "Could not start Windows PowerShell.");

        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            log.Write($"Collector stderr: {stderr}");
            throw new InvalidOperationException(
                $"Inventory collector failed with exit code {process.ExitCode}.");
        }

        if (string.IsNullOrWhiteSpace(stdout))
        {
            throw new InvalidOperationException(
                "Inventory collector returned empty JSON.");
        }

        return JsonSerializer.Deserialize<InventoryResult>(
            stdout,
            JsonOptions.Default)
            ?? throw new InvalidOperationException(
                "Inventory JSON could not be parsed.");
    }
}

internal static class JsonOptions
{
    public static readonly JsonSerializerOptions Default = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition =
            JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };
}
