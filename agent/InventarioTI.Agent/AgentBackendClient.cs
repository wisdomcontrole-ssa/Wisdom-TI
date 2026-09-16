using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace InventarioTI.Agent;

internal sealed class AgentBackendClient
{
    private readonly AgentConfig _config;
    private readonly AgentLog _log;
    private readonly HttpClient _client;

    public AgentBackendClient(
        AgentConfig config,
        AgentLog log)
    {
        _config = config;
        _log = log;

        _client = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(15),
        };

        _client.DefaultRequestHeaders.UserAgent.ParseAdd(
            $"InventarioTI-Agent/{Program.AgentVersion}");
    }

    public async Task UploadInventoryAsync(
        AgentPayload payload)
    {
        var endpoint =
            $"{_config.ProjectUrl.TrimEnd('/')}/functions/v1/agent-ingest";

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                endpoint);

        request.Headers.Add(
            "x-wisdom-agent-token",
            _config.AgentToken);

        var json =
            JsonSerializer.Serialize(
                payload,
                AgentJsonContext.Default.AgentPayload);

        request.Content = new StringContent(
            json,
            Encoding.UTF8,
            "application/json");

        using var response =
            await _client.SendAsync(request);

        var responseText =
            await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Inventário recusado HTTP {(int)response.StatusCode}: " +
                Program.Limit(
                    responseText,
                    1600));
        }

        _log.Write(
            $"Inventário enviado: {Program.Limit(responseText, 800)}");
    }

    public async Task<RemoteCommand?> PollCommandAsync()
    {
        var request = new PollCommandRequest
        {
            Token = _config.AgentToken,
            AgentVersion = Program.AgentVersion,
            MachineGuid = Program.MachineGuid(),
        };

        var text = await PostRpcAsync(
            "agent_poll_command",
            request,
            AgentJsonContext.Default.PollCommandRequest);

        if (string.IsNullOrWhiteSpace(text) ||
            text.Trim() == "null")
        {
            return null;
        }

        return JsonSerializer.Deserialize(
            text,
            AgentJsonContext.Default.RemoteCommand);
    }

    public async Task CompleteCommandAsync(
        string commandId,
        CommandExecutionResult result)
    {
        var request = new CompleteCommandRequest
        {
            Token = _config.AgentToken,
            CommandId = commandId,
            Success = result.Success,
            Result = result,
        };

        _ = await PostRpcAsync(
            "agent_complete_command",
            request,
            AgentJsonContext.Default.CompleteCommandRequest);
    }

    private async Task<string> PostRpcAsync<T>(
        string rpc,
        T body,
        JsonTypeInfo<T> jsonType)
    {
        var endpoint =
            $"{_config.ProjectUrl.TrimEnd('/')}/rest/v1/rpc/{rpc}";

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                endpoint);

        request.Headers.Add(
            "apikey",
            _config.PublishableKey);

        var json =
            JsonSerializer.Serialize(
                body,
                jsonType);

        request.Content = new StringContent(
            json,
            Encoding.UTF8,
            "application/json");

        using var response =
            await _client.SendAsync(request);

        var responseText =
            await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"RPC {rpc} falhou HTTP {(int)response.StatusCode}: " +
                Program.Limit(
                    responseText,
                    1800));
        }

        return responseText;
    }

    public static async Task<ClaimActivationResult>
        ClaimActivationAsync(
            InstanceConfig instance,
            string code,
            string machineGuid,
            string hostname)
    {
        using var client = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(60),
        };

        var endpoint =
            $"{instance.ProjectUrl.TrimEnd('/')}/rest/v1/rpc/claim_agent_activation";

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                endpoint);

        request.Headers.Add(
            "apikey",
            instance.PublishableKey);

        var body =
            new ClaimActivationRequest
            {
                Code = code.Trim().ToUpperInvariant(),
                MachineGuid = machineGuid,
                Hostname = hostname,
            };

        request.Content = new StringContent(
            JsonSerializer.Serialize(
                body,
                AgentJsonContext.Default.ClaimActivationRequest),
            Encoding.UTF8,
            "application/json");

        using var response =
            await client.SendAsync(request);

        var text =
            await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                "Não foi possível ativar este equipamento. " +
                Program.Limit(text, 1600));
        }

        return JsonSerializer.Deserialize(
                   text,
                   AgentJsonContext.Default.ClaimActivationResult)
               ?? throw new InvalidOperationException(
                   "Resposta de ativação inválida.");
    }
}

internal static class AgentStateStore
{
    public static async Task<AgentState> LoadAsync(
        string path)
    {
        try
        {
            if (!File.Exists(path))
            {
                return new AgentState();
            }

            return JsonSerializer.Deserialize(
                       await File.ReadAllTextAsync(path),
                       AgentJsonContext.Default.AgentState)
                   ?? new AgentState();
        }
        catch
        {
            return new AgentState();
        }
    }

    public static async Task SaveAsync(
        string path,
        AgentState state)
    {
        Directory.CreateDirectory(
            Path.GetDirectoryName(path)!);

        await File.WriteAllTextAsync(
            path,
            JsonSerializer.Serialize(
                state,
                AgentJsonContext.Default.AgentState));
    }
}
