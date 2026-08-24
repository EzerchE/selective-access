param(
    [Parameter(Mandatory = $true)][string]$DesiredFile,
    [Parameter(Mandatory = $true)][string]$ResultFile
)

$ErrorActionPreference = "Stop"
$dnsTaskName = "SelectiveAccessDns"
$oldRuleComment = "SelectiveAccess managed encrypted DNS"
$ruleComment = "SelectiveAccess managed fallback DNS"
$requestId = "unknown"

function Write-SyncResult([bool]$Ok, [string]$Message) {
    $directory = Split-Path -Parent $ResultFile
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $lines = @($requestId, $(if ($Ok) { "ok=1" } else { "ok=0" }))
    if ($Message) { $lines += $Message.Replace("`r", " ").Replace("`n", " ") }
    Set-Content -LiteralPath $ResultFile -Value $lines -Encoding utf8
}

try {
    if (-not (Test-Path -LiteralPath $DesiredFile -PathType Leaf)) {
        throw "Seçici DNS hedef dosyası bulunamadı."
    }
    $lines = @(Get-Content -LiteralPath $DesiredFile -Encoding utf8)
    if ($lines.Count -lt 1 -or $lines[0] -notmatch '^[a-f0-9]{32}$') {
        throw "Seçici DNS isteği geçersiz."
    }
    $requestId = $lines[0]
    $domains = @($lines | Select-Object -Skip 1 | ForEach-Object {
        $domain = $_.Trim().Trim('.').ToLowerInvariant()
        if ($domain -match '^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$') { $domain }
    } | Sort-Object -Unique | Select-Object -First 500)

    Get-DnsClientNrptRule | Where-Object {
        $_.Comment -eq $oldRuleComment -or $_.Comment -eq $ruleComment
    } | Remove-DnsClientNrptRule -Force

    if ($domains.Count -eq 0) {
        Stop-ScheduledTask -TaskName $dnsTaskName -ErrorAction SilentlyContinue
        Clear-DnsClientCache
        Write-SyncResult $true ""
        exit 0
    }

    Start-ScheduledTask -TaskName $dnsTaskName
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Get-NetUDPEndpoint -LocalAddress "127.0.0.2" -LocalPort 53 -ErrorAction SilentlyContinue) { break }
        Start-Sleep -Milliseconds 200
    }
    if (-not (Get-NetUDPEndpoint -LocalAddress "127.0.0.2" -LocalPort 53 -ErrorAction SilentlyContinue)) {
        throw "Seçici DNS çözücüsü başlatılamadı."
    }

    foreach ($domain in $domains) {
        $foreignRule = Get-DnsClientNrptRule | Where-Object {
            $_.Namespace -contains $domain -and $_.Comment -ne $ruleComment
        } | Select-Object -First 1
        if ($foreignRule) {
            throw "Bu alan adı için başka bir DNS ilkesi zaten var: $domain"
        }
        Add-DnsClientNrptRule -Namespace $domain -NameServers "127.0.0.2" -Comment $ruleComment | Out-Null
    }
    Clear-DnsClientCache
    Write-SyncResult $true ""
}
catch {
    Write-SyncResult $false $_.Exception.Message
    exit 1
}
