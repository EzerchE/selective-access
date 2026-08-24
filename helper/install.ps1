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
    Write-Host "Kuruluma devam etmek icin Windows yonetici izni gerekiyor." -ForegroundColor Yellow
    $quotedScript = $PSCommandPath.Replace("'", "''")
    $quotedSid = $ChromeUserSid.Replace("'", "''")
    $quotedLocalAppData = $ChromeLocalAppData.Replace("'", "''")
    $logPath = Join-Path $env:TEMP "SelectiveAccess-install.log"
    $quotedLogPath = $logPath.Replace("'", "''")
    $elevatedCommand = @"
`$installExitCode = 0
Start-Transcript -Path '$quotedLogPath' -Force | Out-Null
try {
    & '$quotedScript' -ChromeUserSid '$quotedSid' -ChromeLocalAppData '$quotedLocalAppData'
}
catch {
    `$installExitCode = 1
    Write-Error (`$_ | Out-String)
}
finally {
    Stop-Transcript | Out-Null
}
exit `$installExitCode
"@
    $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($elevatedCommand))
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand)
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Write-Host "Yonetici kurulumu tamamlanamadi. Tani gunlugu: $logPath" -ForegroundColor Red
        if (Test-Path -LiteralPath $logPath) {
            Get-Content -LiteralPath $logPath -Tail 25
        }
    }
    else {
        Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
    }
    exit $process.ExitCode
}

Write-Host "Otomatik Erisim yardimci kurulumu" -ForegroundColor Cyan
Write-Host "- Chrome'da ogrenilen hedefler 127.0.0.1:1080 gecidine yonlendirilir."
Write-Host "- Mevcut sistem, ag ve DNS ayarlari varsayilan olarak aynen kalir."
Write-Host "- Yalniz yerel DNS'in cozemedigi ve alternatif DNS'te dogrulanan hedefler icin alan adina ozel sifreli DNS kurali uygulanir."
Write-Host "- Genel DNS kurali, ag bagdastiricisi DNS degisikligi veya tum sorgulari dis saglayiciya yonlendirme yapilmaz."
Write-Host ""

$serviceName = "SelectiveAccessByeDPI"
$oldDnsServiceName = "SelectiveAccessDns"
$dnsTaskName = "SelectiveAccessDns"
$dnsSyncTaskName = "SelectiveAccessDnsSync"
$oldRuleComment = "SelectiveAccess managed encrypted DNS"
$dnsRuleComment = "SelectiveAccess managed fallback DNS"
$nativeHostName = "com.ezerche.selective_access"
$installDirectory = Join-Path $env:ProgramData "SelectiveAccess"
$targetExecutable = Join-Path $installDirectory "ciadpi.exe"
$targetDnsExecutable = Join-Path $installDirectory "dnsproxy.exe"
$targetNativeHost = Join-Path $installDirectory "SelectiveAccessDnsHost.exe"
$targetNativeManifest = Join-Path $installDirectory "$nativeHostName.json"
$targetSyncScript = Join-Path $installDirectory "sync-dns.ps1"
$sourceExecutable = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "bin\ciadpi.exe"))
$sourceDnsExecutable = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "bin\dnsproxy.exe"))
$sourceNativeHost = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "native\SelectiveAccessDnsHost.cs"))
$sourceSyncScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "sync-dns.ps1"))
$extensionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$dataDirectory = Join-Path $ChromeLocalAppData "SelectiveAccess"
$desiredFile = Join-Path $dataDirectory "dns-domains.txt"
$resultFile = Join-Path $dataDirectory "dns-result.txt"
$expectedHashes = @{
    $sourceExecutable = "EB53CEEEB981CC6735AC24BB1E51E725280B86630E80FDF19DDC4EE4A5B54EF4"
    $sourceDnsExecutable = "09461CCE5C1DC0D7D1673FB3DEF0DBD014924D1481479D12CEBECB7BA93E8B2B"
}

foreach ($path in @($sourceExecutable, $sourceDnsExecutable, $sourceNativeHost, $sourceSyncScript)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Kurulum dosyasi bulunamadi: $path"
    }
}
foreach ($entry in $expectedHashes.GetEnumerator()) {
    $actual = (Get-FileHash -LiteralPath $entry.Key -Algorithm SHA256).Hash
    if ($actual -ne $entry.Value) {
        throw "Yardimci ikili guvenlik dogrulamasindan gecemedi: $($entry.Key)"
    }
}

$extensionIds = @()
$chromeUserData = Join-Path $ChromeLocalAppData "Google\Chrome\User Data"
if (Test-Path -LiteralPath $chromeUserData) {
    $preferenceFiles = Get-ChildItem -LiteralPath $chromeUserData -Filter "Secure Preferences" -File -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $preferenceFiles) {
        try {
            $preferences = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
            foreach ($entry in $preferences.extensions.settings.PSObject.Properties) {
                $configuredPath = [string]$entry.Value.path
                if (-not $configuredPath) { continue }
                try { $configuredPath = [IO.Path]::GetFullPath($configuredPath) } catch { continue }
                if ($configuredPath.TrimEnd('\') -ieq $extensionRoot.TrimEnd('\') -and $entry.Name -match '^[a-p]{32}$') {
                    $extensionIds += $entry.Name
                }
            }
        }
        catch { }
    }
}
$extensionIds = @($extensionIds | Sort-Object -Unique)
if ($extensionIds.Count -eq 0) {
    throw "Chrome eklenti kimligi bulunamadi. Once chrome://extensions uzerinden bu klasoru yukleyin, sonra kurulumu yeniden calistirin."
}

$csc = @(
    (Join-Path $env:WINDIR "target.example\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $env:WINDIR "target.example\Framework\v4.0.30319\csc.exe")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $csc) { throw ".NET Framework C# derleyicisi bulunamadi." }

$registryPath = "Registry::HKEY_USERS\$ChromeUserSid\Software\Google\Chrome\NativeMessagingHosts\$nativeHostName"
$installed = $false
try {
    New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null

    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existing) {
        if ($existing.Status -ne "Stopped") { Stop-Service -Name $serviceName -Force }
        & sc.exe delete $serviceName | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Eski Windows hizmeti kaldirilamadi (sc.exe kodu: $LASTEXITCODE)." }
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            if (-not (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Milliseconds 250
        }
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

    Copy-Item -LiteralPath $sourceExecutable -Destination $targetExecutable -Force
    Copy-Item -LiteralPath $sourceDnsExecutable -Destination $targetDnsExecutable -Force
    Copy-Item -LiteralPath $sourceSyncScript -Destination $targetSyncScript -Force

    & $csc /nologo /target:exe /optimize+ /out:$targetNativeHost /reference:System.Web.Extensions.dll $sourceNativeHost
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $targetNativeHost)) {
        throw "Chrome yerel DNS koprusu derlenemedi."
    }

    $nativeManifest = [ordered]@{
        name = $nativeHostName
        description = "Otomatik Erisim secici DNS koprusu"
        path = $targetNativeHost
        type = "stdio"
        allowed_origins = @($extensionIds | ForEach-Object { "chrome-extension://$_/" })
    }
    $nativeManifestJson = $nativeManifest | ConvertTo-Json -Depth 4
    [IO.File]::WriteAllText($targetNativeManifest, $nativeManifestJson, (New-Object Text.UTF8Encoding($false)))
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -Path $registryPath -Value $targetNativeManifest

    $dnsArguments = '-l 127.0.0.2 -p 53 -u https://1.1.1.1/dns-query -u https://8.8.8.8/dns-query --upstream-mode parallel --cache'
    $dnsAction = New-ScheduledTaskAction -Execute $targetDnsExecutable -Argument $dnsArguments
    $dnsPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $dnsSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $dnsTaskName -Action $dnsAction -Principal $dnsPrincipal -Settings $dnsSettings -Description "Yalniz secici DNS hedefleri varken calisan yerel DoH cozumleyicisi." | Out-Null

    $syncArguments = ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -DesiredFile "{1}" -ResultFile "{2}"' -f $targetSyncScript, $desiredFile, $resultFile)
    $syncAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $syncArguments
    $syncPrincipal = New-ScheduledTaskPrincipal -UserId $ChromeUserSid -LogonType Interactive -RunLevel Highest
    $syncSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1) -MultipleInstances Queue -Hidden
    Register-ScheduledTask -TaskName $dnsSyncTaskName -Action $syncAction -Principal $syncPrincipal -Settings $syncSettings -Description "Otomatik Erisim alan adina ozel DNS kurallarini esler." | Out-Null

    $binaryPath = ('"{0}" --ip 127.0.0.1 --port 1080 --no-udp --split 1 --oob 1 --auto r --oob 1 --auto t --fake -1 --tlsrec 1+s --auto s' -f $targetExecutable)
    New-Service -Name $serviceName -BinaryPathName $binaryPath -DisplayName "Selective Access ByeDPI" -Description "Yalniz 127.0.0.1:1080 adresinde calisan secici SOCKS5 gecidi." -StartupType Automatic | Out-Null
    Start-Service -Name $serviceName

    Set-Content -LiteralPath $desiredFile -Value ([Guid]::NewGuid().ToString("N")) -Encoding utf8
    Remove-Item -LiteralPath $resultFile -Force -ErrorAction SilentlyContinue
    Clear-DnsClientCache
    $installed = $true
}
finally {
    if (-not $installed) {
        Stop-ScheduledTask -TaskName $dnsTaskName -ErrorAction SilentlyContinue
        Stop-ScheduledTask -TaskName $dnsSyncTaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $dnsTaskName -Confirm:$false -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $dnsSyncTaskName -Confirm:$false -ErrorAction SilentlyContinue
        Get-DnsClientNrptRule | Where-Object {
            $_.Comment -eq $oldRuleComment -or $_.Comment -eq $dnsRuleComment
        } | Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue
        $partialService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($partialService) {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            & sc.exe delete $serviceName | Out-Null
        }
        Remove-Item -Path $registryPath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$service = Get-Service -Name $serviceName
Write-Host ""
Write-Host "Kurulum tamamlandi." -ForegroundColor Green
Write-Host "Hizmet: $($service.DisplayName) ($($service.Status))"
Write-Host "Gecit:  127.0.0.1:1080"
Write-Host "DNS:    Mevcut sistem ve ag DNS'i varsayilan; alternatif DNS yalniz dogrulanan hedeflerde ve ihtiyac varken calisir."
Write-Host "Chrome: Eklentiyi chrome://extensions sayfasindan bir kez yenileyin."
