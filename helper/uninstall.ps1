$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    $arguments = @(
        "-NoProfile"
        "-ExecutionPolicy"
        "Bypass"
        "-File"
        ('"{0}"' -f $PSCommandPath)
    )
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait -PassThru
    exit $process.ExitCode
}

$serviceName = "SelectiveAccessByeDPI"
$dnsServiceName = "SelectiveAccessDns"
$dnsTaskName = "SelectiveAccessDns"
$dnsRuleComment = "SelectiveAccess managed encrypted DNS"
$firewallRuleName = "Selective Access LAN Gateway"
$installDirectory = Join-Path $env:ProgramData "SelectiveAccess"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -ne "Stopped") {
        Stop-Service -Name $serviceName -Force
        $service.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(10))
    }
    & sc.exe delete $serviceName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Windows hizmeti kaldirilamadi (sc.exe kodu: $LASTEXITCODE)."
    }
}

Get-DnsClientNrptRule | Where-Object Comment -EQ $dnsRuleComment | Remove-DnsClientNrptRule -Force
Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Clear-DnsClientCache

$dnsService = Get-Service -Name $dnsServiceName -ErrorAction SilentlyContinue
if ($dnsService) {
    if ($dnsService.Status -ne "Stopped") {
        Stop-Service -Name $dnsServiceName -Force
        $dnsService.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(10))
    }
    & sc.exe delete $dnsServiceName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Sifreli DNS hizmeti kaldirilamadi (sc.exe kodu: $LASTEXITCODE)."
    }
}

Stop-ScheduledTask -TaskName $dnsTaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $dnsTaskName -Confirm:$false -ErrorAction SilentlyContinue

if (Test-Path -LiteralPath $installDirectory) {
    Remove-Item -LiteralPath $installDirectory -Recurse -Force
}

Write-Host "Secici Erisim yerel gecidi kaldirildi." -ForegroundColor Green
