using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace WisdomTI.Agent;

internal static class InventoryCollector
{
    private const string Script = """
$ErrorActionPreference = 'SilentlyContinue'

function MemoryTypeName([int]$Code) {
    switch ($Code) {
        20 { 'DDR' }
        21 { 'DDR2' }
        24 { 'DDR3' }
        26 { 'DDR4' }
        30 { 'LPDDR4' }
        34 { 'DDR5' }
        35 { 'LPDDR5' }
        default { $null }
    }
}

function CountEvents([hashtable]$Filter) {
    try {
        return @(
            Get-WinEvent -FilterHashtable $Filter -ErrorAction Stop |
                Select-Object -First 500
        ).Count
    }
    catch {
        return 0
    }
}

$now = Get-Date
$start7 = $now.AddDays(-7)
$start30 = $now.AddDays(-30)

$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem
$guid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid
$systemDrive = $env:SystemDrive

$logicalDisks = @(
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
        ForEach-Object {
            [pscustomobject]@{
                device_id = [string]$_.DeviceID
                label = [string]$_.VolumeName
                size_bytes = [int64]$_.Size
                free_bytes = [int64]$_.FreeSpace
                system_drive = ($_.DeviceID -eq $systemDrive)
            }
        }
)

$memoryModules = @(
    Get-CimInstance Win32_PhysicalMemory |
        ForEach-Object {
            [pscustomobject]@{
                bank = [string]$_.BankLabel
                slot = [string]$_.DeviceLocator
                manufacturer = [string]$_.Manufacturer
                part_number = ([string]$_.PartNumber).Trim()
                serial_number = ([string]$_.SerialNumber).Trim()
                capacity_bytes = [int64]$_.Capacity
                speed_mhz = [int]$_.Speed
                configured_speed_mhz = [int]$_.ConfiguredClockSpeed
                memory_type = MemoryTypeName ([int]$_.SMBIOSMemoryType)
            }
        }
)

$physicalDisks = @()

if (Get-Command Get-PhysicalDisk -ErrorAction SilentlyContinue) {
    $physicalDisks = @(
        Get-PhysicalDisk |
            ForEach-Object {
                $disk = $_
                $reliability = $null
                try {
                    $reliability = $disk |
                        Get-StorageReliabilityCounter -ErrorAction Stop
                }
                catch {}

                [pscustomobject]@{
                    friendly_name = [string]$disk.FriendlyName
                    model = [string]$disk.Model
                    serial_number = ([string]$disk.SerialNumber).Trim()
                    media_type = [string]$disk.MediaType
                    bus_type = [string]$disk.BusType
                    health_status = [string]$disk.HealthStatus
                    operational_status = (@($disk.OperationalStatus) -join ', ')
                    size_bytes = [int64]$disk.Size
                    temperature_c = if ($reliability) { $reliability.Temperature } else { $null }
                    wear_percent = if ($reliability) { $reliability.Wear } else { $null }
                    read_errors_total = if ($reliability) { $reliability.ReadErrorsTotal } else { $null }
                    write_errors_total = if ($reliability) { $reliability.WriteErrorsTotal } else { $null }
                    power_on_hours = if ($reliability) { $reliability.PowerOnHours } else { $null }
                }
            }
    )
}
else {
    $physicalDisks = @(
        Get-CimInstance Win32_DiskDrive |
            ForEach-Object {
                [pscustomobject]@{
                    friendly_name = [string]$_.Caption
                    model = [string]$_.Model
                    serial_number = ([string]$_.SerialNumber).Trim()
                    media_type = [string]$_.MediaType
                    bus_type = [string]$_.InterfaceType
                    health_status = [string]$_.Status
                    operational_status = [string]$_.Status
                    size_bytes = [int64]$_.Size
                    temperature_c = $null
                    wear_percent = $null
                    read_errors_total = $null
                    write_errors_total = $null
                    power_on_hours = $null
                }
            }
    )
}

$networkAdapters = @(
    Get-CimInstance Win32_NetworkAdapter |
        Where-Object {
            $_.PhysicalAdapter -eq $true -and $_.MACAddress
        } |
        ForEach-Object {
            $name = @(
                [string]$_.Name,
                [string]$_.ProductName,
                [string]$_.NetConnectionID
            ) -join ' '

            [pscustomobject]@{
                name = [string]$_.Name
                product_name = [string]$_.ProductName
                manufacturer = [string]$_.Manufacturer
                mac_address = [string]$_.MACAddress
                connection_id = [string]$_.NetConnectionID
                speed_bps = if ($_.Speed) { [int64]$_.Speed } else { $null }
                status = [string]$_.NetConnectionStatus
                is_wifi = ($name -match '(?i)wi-?fi|wireless|802\.11|wlan')
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

$unexpectedShutdowns = CountEvents @{
    LogName = 'System'
    Id = 41, 6008
    StartTime = $start7
}

$bugchecks = 0
try {
    $bugchecks = @(
        Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            Id = 1001
            StartTime = $start7
        } -ErrorAction Stop |
            Where-Object {
                $_.ProviderName -match 'WER-SystemErrorReporting|BugCheck'
            } |
            Select-Object -First 500
    ).Count
}
catch {}

$wheaErrors = 0
try {
    $wheaErrors = @(
        Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            ProviderName = 'Microsoft-Windows-WHEA-Logger'
            StartTime = $start7
        } -ErrorAction Stop |
            Where-Object {
                $_.Level -le 2
            } |
            Select-Object -First 500
    ).Count
}
catch {}

$memoryErrors = 0
try {
    $memoryErrors = @(
        Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            ProviderName = 'Microsoft-Windows-MemoryDiagnostics-Results'
            StartTime = $start30
        } -ErrorAction Stop |
            Where-Object {
                $_.Level -le 2 -or
                $_.Message -match '(?i)hardware problems|problemas de hardware|errors were detected'
            } |
            Select-Object -First 200
    ).Count
}
catch {}

$appCrashes = CountEvents @{
    LogName = 'Application'
    Id = 1000
    StartTime = $start7
}

$pendingReboot = (
    Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
) -or (
    Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
)

$systemDisk = $logicalDisks |
    Where-Object { $_.system_drive } |
    Select-Object -First 1

$systemFreePercent = $null
if ($systemDisk -and $systemDisk.size_bytes -gt 0) {
    $systemFreePercent = [math]::Round(
        (100.0 * $systemDisk.free_bytes / $systemDisk.size_bytes),
        1
    )
}

$uptimeHours = $null
try {
    $uptimeHours = [math]::Round(
        ((Get-Date) - ([DateTime]$os.LastBootUpTime)).TotalHours,
        1
    )
}
catch {}

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
    disks = $logicalDisks
    software = $software
    health = [pscustomobject]@{
        collector = 'powershell-cim-v2'
        motherboard = [pscustomobject]@{
            manufacturer = [string]$board.Manufacturer
            model = [string]$board.Product
            serial_number = [string]$board.SerialNumber
        }
        memory_modules = $memoryModules
        physical_disks = $physicalDisks
        network_adapters = $networkAdapters
        diagnostics = [pscustomobject]@{
            unexpected_shutdowns_7d = [int]$unexpectedShutdowns
            bugchecks_7d = [int]$bugchecks
            whea_errors_7d = [int]$wheaErrors
            memory_diagnostic_errors_30d = [int]$memoryErrors
            application_crashes_7d = [int]$appCrashes
            system_drive_free_percent = $systemFreePercent
            uptime_hours = $uptimeHours
            pending_reboot = [bool]$pendingReboot
        }
    }
}

$result | ConvertTo-Json -Depth 10 -Compress
""";

    public static async Task<InventoryResult>
        CollectAsync(AgentLog log)
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

        var encoded =
            Convert.ToBase64String(
                Encoding.Unicode.GetBytes(
                    Script));

        var start =
            new ProcessStartInfo
            {
                FileName = shell,
                Arguments =
                    "-NoLogo -NoProfile -NonInteractive " +
                    "-ExecutionPolicy Bypass " +
                    $"-EncodedCommand {encoded}",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

        using var process =
            Process.Start(start)
            ?? throw new InvalidOperationException(
                "Não foi possível iniciar o coletor do Windows.");

        using var cts =
            new CancellationTokenSource(
                TimeSpan.FromMinutes(4));

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

            throw new InvalidOperationException(
                "A coleta de inventário excedeu o tempo limite.");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            log.Write(
                $"Collector stderr: {stderr}");

            throw new InvalidOperationException(
                $"Coletor retornou código {process.ExitCode}.");
        }

        if (string.IsNullOrWhiteSpace(
                stdout))
        {
            throw new InvalidOperationException(
                "O coletor não retornou dados.");
        }

        return JsonSerializer.Deserialize(
                   stdout,
                   AgentJsonContext.Default.InventoryResult)
               ?? throw new InvalidOperationException(
                   "O inventário retornado não pôde ser interpretado.");
    }
}