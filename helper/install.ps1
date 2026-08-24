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

Write-Host "Otomatik Erisim yardimci kurulumu" -ForegroundColor Cyan
Write-Host "- Yalniz yerel bilgisayarda calisan iki hizmet kurulur."
Write-Host "- Chrome'da secilen hedefler 127.0.0.1:1080 gecidine yonlendirilir."
Write-Host "- CIHAZDAKI TUM DNS SORGULARI sistem genelinde Cloudflare ve Google DoH hizmetlerine sifreli gonderilir."
Write-Host "- Bu saglayicilar sorgulanan alan adini ve kaynak IP adresini gorebilir; kendi gizlilik kosullari gecerlidir."
Write-Host "- Kurumsal/yonetilen bir cihazda yonetici izni olmadan kurmayin. helper\uninstall.cmd degisiklikleri geri alir."
Write-Host ""

$serviceName = "SelectiveAccessByeDPI"
$dnsServiceName = "SelectiveAccessDns"
$dnsTaskName = "SelectiveAccessDns"
$dnsRuleComment = "SelectiveAccess managed encrypted DNS"
$installDirectory = Join-Path $env:ProgramData "SelectiveAccess"
$targetExecutable = Join-Path $installDirectory "ciadpi.exe"
$targetDnsExecutable = Join-Path $installDirectory "dnsproxy.exe"
$sourceExecutable = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "bin\ciadpi.exe"))
$sourceDnsExecutable = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "bin\dnsproxy.exe"))

if (-not (Test-Path -LiteralPath $sourceExecutable -PathType Leaf)) {
    throw "Eklenti yardimci paketindeki ciadpi.exe bulunamadi: $sourceExecutable"
}
if (-not (Test-Path -LiteralPath $sourceDnsExecutable -PathType Leaf)) {
    throw "Eklenti yardimci paketindeki dnsproxy.exe bulunamadi: $sourceDnsExecutable"
}

$foreignDefaultRules = Get-DnsClientNrptRule | Where-Object {
    $_.Namespace -contains "." -and $_.Comment -ne $dnsRuleComment
}
if ($foreignDefaultRules) {
    throw "Baska bir sistem geneli DNS/NRPT kurali bulundu. Ag politikasini bozmamak icin kurulum hicbir degisiklik yapmadan durduruldu."
}

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null

$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -ne "Stopped") {
        Stop-Service -Name $serviceName -Force
        $existing.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(10))
    }
    & sc.exe delete $serviceName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Eski Windows hizmeti kaldirilamadi (sc.exe kodu: $LASTEXITCODE)."
    }

    # Service Control Manager silme islemini asenkron tamamlayabilir.
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) {
            break
        }
        Start-Sleep -Milliseconds 250
    }

    if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
        throw "Eski Windows hizmeti silinmek uzere isaretli. Birkaç saniye sonra tekrar deneyin."
    }
}

$existingDns = Get-Service -Name $dnsServiceName -ErrorAction SilentlyContinue
if ($existingDns) {
    if ($existingDns.Status -ne "Stopped") {
        Stop-Service -Name $dnsServiceName -Force
        $existingDns.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(10))
    }
    & sc.exe delete $dnsServiceName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Eski sifreli DNS hizmeti kaldirilamadi (sc.exe kodu: $LASTEXITCODE)."
    }
    Start-Sleep -Milliseconds 500
}

Stop-ScheduledTask -TaskName $dnsTaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $dnsTaskName -Confirm:$false -ErrorAction SilentlyContinue
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (-not (Get-NetUDPEndpoint -LocalAddress "127.0.0.2" -LocalPort 53 -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 250
}

Copy-Item -LiteralPath $sourceExecutable -Destination $targetExecutable -Force
Copy-Item -LiteralPath $sourceDnsExecutable -Destination $targetDnsExecutable -Force

Get-DnsClientNrptRule | Where-Object Comment -EQ $dnsRuleComment | Remove-DnsClientNrptRule -Force
$dnsArguments = '-l 127.0.0.2 -p 53 -u https://1.1.1.1/dns-query -u https://8.8.8.8/dns-query --upstream-mode parallel --cache'
$dnsAction = New-ScheduledTaskAction -Execute $targetDnsExecutable -Argument $dnsArguments
$dnsTrigger = New-ScheduledTaskTrigger -AtStartup
$dnsPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$dnsSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $dnsTaskName -Action $dnsAction -Trigger $dnsTrigger -Principal $dnsPrincipal -Settings $dnsSettings | Out-Null
Start-ScheduledTask -TaskName $dnsTaskName

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (Get-NetUDPEndpoint -LocalAddress "127.0.0.2" -LocalPort 53 -ErrorAction SilentlyContinue) { break }
    Start-Sleep -Milliseconds 250
}
if (-not (Get-NetUDPEndpoint -LocalAddress "127.0.0.2" -LocalPort 53 -ErrorAction SilentlyContinue)) {
    throw "Sifreli DNS hizmeti 127.0.0.2:53 adresinde baslatilamadi."
}
# Sadece loopback dinlenir; yerel agdaki diger cihazlar bu SOCKS gecidine erisemez.
$binaryPath = ('"{0}" --ip 127.0.0.1 --port 1080 --no-udp --split 1 --oob 1 --auto r --oob 1 --auto t --fake -1 --tlsrec 1+s --auto s' -f $targetExecutable)
New-Service `
    -Name $serviceName `
    -BinaryPathName $binaryPath `
    -DisplayName "Selective Access ByeDPI" `
    -Description "Secici Erisim icin yalnizca 127.0.0.1:1080 adresinde calisan ByeDPI SOCKS5 gecidi." `
    -StartupType Automatic | Out-Null
Start-Service -Name $serviceName

# Sistem geneli DNS degisikligi, her iki yerel hizmet de basariyla basladiktan sonra en son uygulanir.
Add-DnsClientNrptRule -Namespace "." -NameServers "127.0.0.2" -Comment $dnsRuleComment | Out-Null
Clear-DnsClientCache

$service = Get-Service -Name $serviceName
Write-Host ""
Write-Host "Kurulum tamamlandi." -ForegroundColor Green
Write-Host "Hizmet: $($service.DisplayName) ($($service.Status))"
Write-Host "Gecit:  127.0.0.1:1080"
Write-Host "DNS:    127.0.0.2:53 (sifreli dis baglanti)"
Write-Host ""
Write-Host "Simdi Chrome'da eklentiyi etkinlestirebilirsiniz."
