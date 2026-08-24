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
Write-Host "- Iki hizmet kurulur; SOCKS5 gecidi varsayilan olarak yalniz bu bilgisayarda calisir."
Write-Host "- Isterseniz gecidi guvenilir yerel agdaki diger cihazlarla paylasabilirsiniz."
Write-Host "- CIHAZDAKI TUM DNS SORGULARI sistem genelinde Cloudflare ve Google DoH hizmetlerine sifreli gonderilir."
Write-Host "- Bu saglayicilar sorgulanan alan adini ve kaynak IP adresini gorebilir; kendi gizlilik kosullari gecerlidir."
Write-Host "- Kurumsal/yonetilen bir cihazda yonetici izni olmadan kurmayin. helper\uninstall.cmd degisiklikleri geri alir."
Write-Host ""
$confirmation = Read-Host "Bu degisiklikleri anladiniz ve kuruluma devam etmek istiyor musunuz? [EVET/hayir]"
if ($confirmation -cne "EVET") {
    Write-Host "Kurulum kullanici tarafindan iptal edildi. Hicbir degisiklik yapilmadi." -ForegroundColor Yellow
    exit 2
}

function Test-PrivateIPv4Address([string]$Value) {
    try {
        $address = [Net.IPAddress]::Parse($Value)
        if ($address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { return $false }
        $bytes = $address.GetAddressBytes()
        return $bytes[0] -eq 10 -or
            ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
            ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
    } catch {
        return $false
    }
}

$gatewayListenAddress = "127.0.0.1"
$shareChoice = Read-Host "Gecidi yerel agdaki diger cihazlarla paylasmak istiyor musunuz? [EVET/hayir]"
if ($shareChoice -ceq "EVET") {
    $privateAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
        $_.IPAddress -ne "127.0.0.1" -and (Test-PrivateIPv4Address $_.IPAddress)
    } | Select-Object -ExpandProperty IPAddress -Unique
    if (-not $privateAddresses) {
        throw "Bu bilgisayarda paylasima uygun ozel bir IPv4 adresi bulunamadi."
    }
    Write-Host "Paylasima uygun adresler: $($privateAddresses -join ', ')"
    $defaultAddress = $privateAddresses | Select-Object -First 1
    $selectedAddress = Read-Host "Gecidin dinleyecegi yerel ag adresi [$defaultAddress]"
    if ([string]::IsNullOrWhiteSpace($selectedAddress)) { $selectedAddress = $defaultAddress }
    if (-not (Test-PrivateIPv4Address $selectedAddress)) {
        throw "Yalniz 10.x.x.x, 172.16-31.x.x veya 192.168.x.x ozel IPv4 adresleri kullanilabilir."
    }
    if (-not (Get-NetIPAddress -AddressFamily IPv4 -IPAddress $selectedAddress -ErrorAction SilentlyContinue)) {
        throw "Secilen adres bu bilgisayarin etkin ag arabirimlerinde bulunamadi: $selectedAddress"
    }
    $gatewayListenAddress = $selectedAddress
}

$serviceName = "SelectiveAccessByeDPI"
$dnsServiceName = "SelectiveAccessDns"
$dnsTaskName = "SelectiveAccessDns"
$dnsRuleComment = "SelectiveAccess managed encrypted DNS"
$firewallRuleName = "Selective Access LAN Gateway"
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
$binaryPath = ('"{0}" --ip {1} --port 1080 --no-udp --split 1 --oob 1 --auto r --oob 1 --auto t --fake -1 --tlsrec 1+s --auto s' -f $targetExecutable, $gatewayListenAddress)
New-Service `
    -Name $serviceName `
    -BinaryPathName $binaryPath `
    -DisplayName "Selective Access ByeDPI" `
    -Description "Secici Erisim icin $($gatewayListenAddress):1080 adresinde calisan ByeDPI SOCKS5 gecidi." `
    -StartupType Automatic | Out-Null
Start-Service -Name $serviceName

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (Get-NetTCPConnection -State Listen -LocalAddress $gatewayListenAddress -LocalPort 1080 -ErrorAction SilentlyContinue) { break }
    Start-Sleep -Milliseconds 250
}
if (-not (Get-NetTCPConnection -State Listen -LocalAddress $gatewayListenAddress -LocalPort 1080 -ErrorAction SilentlyContinue)) {
    throw "SOCKS5 gecidi $($gatewayListenAddress):1080 adresinde dinlemeye baslamadi."
}

Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($gatewayListenAddress -ne "127.0.0.1") {
    New-NetFirewallRule `
        -DisplayName $firewallRuleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalAddress $gatewayListenAddress `
        -LocalPort 1080 `
        -RemoteAddress LocalSubnet `
        -Profile Any | Out-Null
}

# Sistem geneli DNS degisikligi, her iki yerel hizmet de basariyla basladiktan sonra en son uygulanir.
Add-DnsClientNrptRule -Namespace "." -NameServers "127.0.0.2" -Comment $dnsRuleComment | Out-Null
Clear-DnsClientCache

$service = Get-Service -Name $serviceName
Write-Host ""
Write-Host "Kurulum tamamlandi." -ForegroundColor Green
Write-Host "Hizmet: $($service.DisplayName) ($($service.Status))"
Write-Host "Gecit:  $($gatewayListenAddress):1080"
if ($gatewayListenAddress -ne "127.0.0.1") {
    Write-Host "Erisim: Yalniz Windows tarafindan ayni ozel yerel alt agda kabul edilen cihazlar"
}
Write-Host "DNS:    127.0.0.2:53 (sifreli dis baglanti)"
Write-Host ""
Write-Host "Simdi Chrome'da eklentiyi etkinlestirebilirsiniz."
