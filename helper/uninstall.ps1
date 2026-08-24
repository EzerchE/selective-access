param(
    [string]$ChromeUserSid,
    [string]$ChromeLocalAppData
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $ChromeUserSid) { $ChromeUserSid = $identity.User.Value }
if (-not $ChromeLocalAppData) { $ChromeLocalAppData = $env:LOCALAPPDATA }
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    $arguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath),
        "-ChromeUserSid", ('"{0}"' -f $ChromeUserSid),
        "-ChromeLocalAppData", ('"{0}"' -f $ChromeLocalAppData)
    )
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait -PassThru
    exit $process.ExitCode
}

$serviceName = "SelectiveAccessByeDPI"
$oldDnsServiceName = "SelectiveAccessDns"
$dnsTaskName = "SelectiveAccessDns"
$dnsSyncTaskName = "SelectiveAccessDnsSync"
$oldRuleComment = "SelectiveAccess managed encrypted DNS"
$dnsRuleComment = "SelectiveAccess managed fallback DNS"
$nativeHostName = "com.ezerche.selective_access"
$installDirectory = Join-Path $env:ProgramData "SelectiveAccess"
$dataDirectory = Join-Path $ChromeLocalAppData "SelectiveAccess"
$registryPath = "Registry::HKEY_USERS\$ChromeUserSid\Software\Google\Chrome\NativeMessagingHosts\$nativeHostName"

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -ne "Stopped") { Stop-Service -Name $serviceName -Force }
    & sc.exe delete $serviceName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Windows hizmeti kaldirilamadi (sc.exe kodu: $LASTEXITCODE)." }
}

$oldDnsService = Get-Service -Name $oldDnsServiceName -ErrorAction SilentlyContinue
if ($oldDnsService) {
    if ($oldDnsService.Status -ne "Stopped") { Stop-Service -Name $oldDnsServiceName -Force }
    & sc.exe delete $oldDnsServiceName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Eski DNS hizmeti kaldirilamadi (sc.exe kodu: $LASTEXITCODE)." }
}

Stop-ScheduledTask -TaskName $dnsTaskName -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName $dnsSyncTaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $dnsTaskName -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $dnsSyncTaskName -Confirm:$false -ErrorAction SilentlyContinue

Get-DnsClientNrptRule | Where-Object {
    $_.Comment -eq $oldRuleComment -or $_.Comment -eq $dnsRuleComment
} | Remove-DnsClientNrptRule -Force
Clear-DnsClientCache

Remove-Item -Path $registryPath -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $installDirectory) {
    Remove-Item -LiteralPath $installDirectory -Recurse -Force
}
if (Test-Path -LiteralPath $dataDirectory) {
    Remove-Item -LiteralPath $dataDirectory -Recurse -Force
}

Write-Host "Otomatik Erisim yerel gecidi ve yalniz ona ait secici DNS kurallari kaldirildi." -ForegroundColor Green
