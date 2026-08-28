using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace WisdomTI.Agent.Setup;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new SetupForm());
    }
}

internal sealed class SetupForm : Form
{
    private const string ProjectUrl = "https://yresuszqnakdxupewtsf.supabase.co";

    private readonly TextBox _tokenBox = new();
    private readonly Button _installButton = new();
    private readonly CheckBox _showToken = new();
    private readonly Label _statusLabel = new();
    private readonly ProgressBar _progress = new();

    public SetupForm()
    {
        Text = "Wisdom TI Agent";
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(640, 390);
        MinimumSize = new Size(640, 390);
        MaximizeBox = false;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        Font = new Font("Segoe UI", 9F);
        BackColor = Color.White;

        var title = new Label
        {
            Text = "Wisdom TI Agent",
            Font = new Font("Segoe UI", 20F, FontStyle.Bold),
            ForeColor = Color.FromArgb(15, 23, 42),
            AutoSize = true,
            Location = new Point(38, 32),
        };

        var subtitle = new Label
        {
            Text = "Instalação automática do inventário deste computador",
            Font = new Font("Segoe UI", 10F),
            ForeColor = Color.FromArgb(100, 116, 139),
            AutoSize = true,
            Location = new Point(41, 78),
        };

        var info = new Label
        {
            Text = "Cole abaixo o token gerado na ficha do patrimônio. O instalador fará toda a configuração, criará o heartbeat e enviará a primeira coleta.",
            ForeColor = Color.FromArgb(71, 85, 105),
            Location = new Point(41, 118),
            Size = new Size(550, 46),
        };

        var tokenLabel = new Label
        {
            Text = "Token do agente",
            Font = new Font("Segoe UI", 9F, FontStyle.Bold),
            ForeColor = Color.FromArgb(51, 65, 85),
            AutoSize = true,
            Location = new Point(41, 181),
        };

        _tokenBox.Location = new Point(41, 205);
        _tokenBox.Size = new Size(550, 29);
        _tokenBox.UseSystemPasswordChar = true;
        _tokenBox.PlaceholderText = "wti_...";
        _tokenBox.Font = new Font("Consolas", 10F);

        _showToken.Text = "Mostrar token";
        _showToken.AutoSize = true;
        _showToken.Location = new Point(41, 244);
        _showToken.ForeColor = Color.FromArgb(100, 116, 139);
        _showToken.CheckedChanged += (_, _) =>
        {
            _tokenBox.UseSystemPasswordChar = !_showToken.Checked;
        };

        _installButton.Text = "Instalar";
        _installButton.Location = new Point(441, 281);
        _installButton.Size = new Size(150, 42);
        _installButton.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
        _installButton.FlatStyle = FlatStyle.Flat;
        _installButton.BackColor = Color.FromArgb(15, 23, 42);
        _installButton.ForeColor = Color.White;
        _installButton.FlatAppearance.BorderSize = 0;
        _installButton.Click += InstallClicked;

        _progress.Location = new Point(41, 291);
        _progress.Size = new Size(378, 8);
        _progress.Style = ProgressBarStyle.Marquee;
        _progress.MarqueeAnimationSpeed = 24;
        _progress.Visible = false;

        _statusLabel.Location = new Point(41, 317);
        _statusLabel.Size = new Size(550, 42);
        _statusLabel.ForeColor = Color.FromArgb(100, 116, 139);
        _statusLabel.Text = "O Windows poderá solicitar confirmação de administrador.";

        Controls.AddRange([
            title,
            subtitle,
            info,
            tokenLabel,
            _tokenBox,
            _showToken,
            _installButton,
            _progress,
            _statusLabel,
        ]);

        AcceptButton = _installButton;
        Shown += (_, _) => _tokenBox.Focus();
    }

    private async void InstallClicked(object? sender, EventArgs e)
    {
        var token = _tokenBox.Text.Trim();

        if (!Regex.IsMatch(token, @"^wti_[A-Za-z0-9_-]{20,}$"))
        {
            MessageBox.Show(
                this,
                "Cole um token válido gerado pelo Wisdom TI.",
                "Token inválido",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            _tokenBox.Focus();
            return;
        }

        _installButton.Enabled = false;
        _tokenBox.Enabled = false;
        _showToken.Enabled = false;
        _progress.Visible = true;
        _statusLabel.Text = "Instalando e configurando o agente...";

        try
        {
            var result = await AgentInstaller.InstallAsync(
                ProjectUrl,
                token,
                status => BeginInvoke(() => _statusLabel.Text = status));

            _progress.Visible = false;
            _statusLabel.Text = "Instalação concluída. A primeira coleta foi enviada.";

            MessageBox.Show(
                this,
                result,
                "Wisdom TI Agent instalado",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);

            Close();
        }
        catch (Exception ex)
        {
            _progress.Visible = false;
            _statusLabel.Text = "Não foi possível concluir a instalação.";
            _installButton.Enabled = true;
            _tokenBox.Enabled = true;
            _showToken.Enabled = true;

            MessageBox.Show(
                this,
                ex.Message,
                "Falha na instalação",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}

internal static class AgentInstaller
{
    private const string TaskStartup = "Wisdom TI Agent - Startup";
    private const string TaskHeartbeat = "Wisdom TI Agent - Heartbeat";

    public static async Task<string> InstallAsync(
        string projectUrl,
        string token,
        Action<string> status)
    {
        var root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "WisdomTI",
            "Agent");

        var exePath = Path.Combine(root, "WisdomTI.Agent.exe");
        var configPath = Path.Combine(root, "agent.json");
        var logsPath = Path.Combine(root, "logs");

        Directory.CreateDirectory(root);
        Directory.CreateDirectory(logsPath);

        status("Copiando o agente...");
        await ExtractAgentAsync(exePath);

        status("Gravando configuração segura...");
        var config = JsonSerializer.Serialize(
            new
            {
                project_url = projectUrl.TrimEnd('/'),
                agent_token = token,
            });

        await File.WriteAllTextAsync(configPath, config);

        status("Protegendo a configuração...");
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

        var taskCommand = $"\"{exePath}\" --config \"{configPath}\"";

        status("Configurando inicialização automática...");
        await RunIgnoreFailureAsync(
            "schtasks.exe",
            ["/Delete", "/TN", TaskStartup, "/F"]);

        await RunIgnoreFailureAsync(
            "schtasks.exe",
            ["/Delete", "/TN", TaskHeartbeat, "/F"]);

        await RunRequiredAsync(
            "schtasks.exe",
            [
                "/Create",
                "/TN", TaskStartup,
                "/TR", taskCommand,
                "/SC", "ONSTART",
                "/RU", "SYSTEM",
                "/RL", "HIGHEST",
                "/F",
            ],
            "Não foi possível criar a tarefa de inicialização.");

        status("Configurando heartbeat a cada 15 minutos...");
        await RunRequiredAsync(
            "schtasks.exe",
            [
                "/Create",
                "/TN", TaskHeartbeat,
                "/TR", taskCommand,
                "/SC", "MINUTE",
                "/MO", "15",
                "/RU", "SYSTEM",
                "/RL", "HIGHEST",
                "/F",
            ],
            "Não foi possível criar a tarefa de heartbeat.");

        status("Enviando a primeira coleta...");
        var collection = await RunProcessAsync(
            exePath,
            ["--config", configPath]);

        if (collection.ExitCode != 0)
        {
            throw new InvalidOperationException(
                "O agente foi instalado, mas a primeira coleta falhou. " +
                $"Código: {collection.ExitCode}. Consulte {Path.Combine(logsPath, "agent.log")}.");
        }

        return
            "Instalação concluída com sucesso.\n\n" +
            "O inventário foi enviado ao Wisdom TI e o agente continuará " +
            "executando automaticamente a cada 15 minutos.";
    }

    private static async Task ExtractAgentAsync(string destination)
    {
        await using var source = Assembly
            .GetExecutingAssembly()
            .GetManifestResourceStream("WisdomTI.Agent.Payload.exe")
            ?? throw new InvalidOperationException(
                "O instalador não contém o executável do agente.");

        await using var target = File.Create(destination);
        await source.CopyToAsync(target);
    }

    private static async Task RunRequiredAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        string errorMessage)
    {
        var result = await RunProcessAsync(fileName, arguments);

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"{errorMessage}\n\n{Trim(result.Error)}");
        }
    }

    private static async Task RunIgnoreFailureAsync(
        string fileName,
        IReadOnlyList<string> arguments)
    {
        _ = await RunProcessAsync(fileName, arguments);
    }

    private static async Task<ProcessResult> RunProcessAsync(
        string fileName,
        IReadOnlyList<string> arguments)
    {
        var start = new ProcessStartInfo
        {
            FileName = fileName,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }

        using var process = Process.Start(start)
            ?? throw new InvalidOperationException(
                $"Não foi possível iniciar {fileName}.");

        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        return new ProcessResult(
            process.ExitCode,
            await outputTask,
            await errorTask);
    }

    private static string Trim(string text)
    {
        var clean = text.Trim();
        return clean.Length <= 1200 ? clean : clean[..1200];
    }

    private sealed record ProcessResult(
        int ExitCode,
        string Output,
        string Error);
}
