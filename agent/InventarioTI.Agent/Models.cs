using System.Text.Json;
using System.Text.Json.Serialization;

namespace InventarioTI.Agent;

internal sealed class AgentConfig
{
    [JsonPropertyName("project_url")]
    public string ProjectUrl { get; set; } = "";

    [JsonPropertyName("publishable_key")]
    public string PublishableKey { get; set; } = "";

    [JsonPropertyName("agent_token")]
    public string AgentToken { get; set; } = "";
}

internal sealed class InstanceConfig
{
    [JsonPropertyName("project_url")]
    public string ProjectUrl { get; set; } = "";

    [JsonPropertyName("publishable_key")]
    public string PublishableKey { get; set; } = "";
}

internal sealed class AgentState
{
    [JsonPropertyName("last_inventory_at")]
    public DateTimeOffset? LastInventoryAt { get; set; }
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
    public JsonElement Health { get; set; }
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

    [JsonPropertyName("health")]
    public JsonElement Health { get; set; }
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

    [JsonPropertyName("uninstall_id")]
    public string? UninstallId { get; set; }

    [JsonPropertyName("uninstall_scope")]
    public string? UninstallScope { get; set; }

    [JsonPropertyName("uninstall_method")]
    public string? UninstallMethod { get; set; }

    [JsonPropertyName("uninstall_eligible")]
    public bool UninstallEligible { get; set; }
}

internal sealed class ClaimActivationRequest
{
    [JsonPropertyName("p_code")]
    public string Code { get; set; } = "";

    [JsonPropertyName("p_machine_guid")]
    public string MachineGuid { get; set; } = "";

    [JsonPropertyName("p_hostname")]
    public string Hostname { get; set; } = "";
}

internal sealed class ClaimActivationResult
{
    [JsonPropertyName("agent_id")]
    public string AgentId { get; set; } = "";

    [JsonPropertyName("asset_id")]
    public string AssetId { get; set; } = "";

    [JsonPropertyName("asset_code")]
    public string AssetCode { get; set; } = "";

    [JsonPropertyName("agent_token")]
    public string AgentToken { get; set; } = "";
}

internal sealed class PollCommandRequest
{
    [JsonPropertyName("p_token")]
    public string Token { get; set; } = "";

    [JsonPropertyName("p_agent_version")]
    public string AgentVersion { get; set; } = "";

    [JsonPropertyName("p_machine_guid")]
    public string MachineGuid { get; set; } = "";
}

internal sealed class RemoteCommand
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("command_type")]
    public string CommandType { get; set; } = "";

    [JsonPropertyName("parameters")]
    public JsonElement Parameters { get; set; }

    [JsonPropertyName("reason")]
    public string? Reason { get; set; }

    [JsonPropertyName("attempt_count")]
    public int AttemptCount { get; set; }
}

internal sealed class CompleteCommandRequest
{
    [JsonPropertyName("p_token")]
    public string Token { get; set; } = "";

    [JsonPropertyName("p_command_id")]
    public string CommandId { get; set; } = "";

    [JsonPropertyName("p_success")]
    public bool Success { get; set; }

    [JsonPropertyName("p_result")]
    public CommandExecutionResult Result { get; set; } = new();
}

internal sealed class CommandExecutionResult
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("exit_code")]
    public int ExitCode { get; set; }

    [JsonPropertyName("summary")]
    public string Summary { get; set; } = "";

    [JsonPropertyName("output")]
    public string Output { get; set; } = "";

    [JsonPropertyName("duration_ms")]
    public long DurationMs { get; set; }
}

internal sealed class InventoryUploadResult
{
    public int SoftwareCount { get; set; }
    public int LogicalDiskCount { get; set; }
}

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition =
        JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(AgentConfig))]
[JsonSerializable(typeof(InstanceConfig))]
[JsonSerializable(typeof(AgentState))]
[JsonSerializable(typeof(AgentPayload))]
[JsonSerializable(typeof(InventoryResult))]
[JsonSerializable(typeof(ClaimActivationRequest))]
[JsonSerializable(typeof(ClaimActivationResult))]
[JsonSerializable(typeof(PollCommandRequest))]
[JsonSerializable(typeof(RemoteCommand))]
[JsonSerializable(typeof(CompleteCommandRequest))]
[JsonSerializable(typeof(CommandExecutionResult))]
internal partial class AgentJsonContext
    : JsonSerializerContext
{
}
