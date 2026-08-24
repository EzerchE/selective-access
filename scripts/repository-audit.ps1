$ErrorActionPreference = "Stop"

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tracked = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
    $_.FullName -notmatch '[\\/](?:\.git|ops|node_modules)[\\/]'
}

$forbiddenFiles = $tracked | Where-Object {
    $_.Name -match '^(?:\.env(?:\..*)?|id_rsa|id_ed25519)$' -or
    $_.Extension -match '^\.(?:pem|key|pfx|p12|log|db|sqlite)$'
}
if ($forbiddenFiles) {
    throw "Yasaklı dosya bulundu: $($forbiddenFiles.FullName -join ', ')"
}

$patterns = @(
    '-----BEGIN [A-Z ]*PRIVATE KEY-----',
    'github_pat_[A-Za-z0-9_]{20,}',
    'gh[opusr]_[A-Za-z0-9]{20,}',
    'AKIA[0-9A-Z]{16}',
    'sk-[A-Za-z0-9_-]{20,}',
    'C:\\Users\\[^\\\s]+',
    '(?<![a-p])[a-p]{32}(?![a-p])',
    '(?<![0-9])(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})(?![0-9])'
)

foreach ($file in $tracked | Where-Object { $_.Extension -notmatch '^\.(?:png|jpg|jpeg|gif|ico|exe)$' }) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            throw "Olası hassas veri bulundu: $($file.FullName)"
        }
    }
}

$requiredLegalFiles = @(
    "LICENSE",
    "PRIVACY.md",
    "RESPONSIBLE_USE.md",
    "THIRD_PARTY_NOTICES.md",
    "helper\bin\BYEDPI_LICENSE.txt",
    "helper\bin\DNSPROXY_LICENSE.txt",
    "helper\native\SelectiveAccessDnsHost.cs",
    "helper\sync-dns.ps1",
    "helper\source\dnsproxy-v0.84.1.tar.gz"
)
foreach ($relativePath in $requiredLegalFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        throw "Gerekli hukuki/lisans dosyasi eksik: $relativePath"
    }
}

$expectedDnsproxySourceHash = "FB99AE07D991BB58277CA857389933CBDC6CBF86F1A1C3EAB8CCD4DF4E333EEC"
$actualDnsproxySourceHash = (Get-FileHash -LiteralPath (Join-Path $root "helper\source\dnsproxy-v0.84.1.tar.gz") -Algorithm SHA256).Hash
if ($actualDnsproxySourceHash -ne $expectedDnsproxySourceHash) {
    throw "dnsproxy kaynak arsivi beklenen surumle eslesmiyor."
}

$expectedBinaryHashes = @{
    "helper\bin\ciadpi.exe" = "EB53CEEEB981CC6735AC24BB1E51E725280B86630E80FDF19DDC4EE4A5B54EF4"
    "helper\bin\dnsproxy.exe" = "09461CCE5C1DC0D7D1673FB3DEF0DBD014924D1481479D12CEBECB7BA93E8B2B"
}
foreach ($entry in $expectedBinaryHashes.GetEnumerator()) {
    $actualHash = (Get-FileHash -LiteralPath (Join-Path $root $entry.Key) -Algorithm SHA256).Hash
    if ($actualHash -ne $entry.Value) {
        throw "Yardimci ikili beklenen surumle eslesmiyor: $($entry.Key)"
    }
}

$installer = Get-Content -LiteralPath (Join-Path $root "helper\install.ps1") -Raw
if ($installer -match 'Add-DnsClientNrptRule\s+-Namespace\s+["'']\.[''\"]') {
    throw "Kurucu sistem geneli DNS/NRPT kurali icermemelidir."
}

$helperScripts = (Get-ChildItem -LiteralPath (Join-Path $root 'helper') -Filter '*.ps1' -File -Recurse | ForEach-Object {
    Get-Content -LiteralPath $_.FullName -Raw
}) -join "`n"
if ($helperScripts -match 'Set-DnsClientServerAddress|netsh(?:\.exe)?\s+[^\r\n]*\bdns\b') {
    throw "Yardimci kullanicinin ag bagdastiricisi DNS ayarini degistirmemelidir."
}

# Kamuya açık belgelerin makineye özgü mutlak yollar içermemesini sağlar.
$documentationPatterns = @('[A-Za-z]:\\')
foreach ($file in $tracked | Where-Object { $_.Extension -eq '.md' }) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $documentationPatterns) {
        if ($content -match $pattern) {
            throw "Kamuya açık belgede bağlama özgü gereksiz ayrıntı bulundu: $($file.FullName)"
        }
    }
}

$manifest = Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$readme = Get-Content -LiteralPath (Join-Path $root 'README.md') -Raw
$versionPattern = 'Güncel sürüm:\s*\*\*' + [regex]::Escape([string]$manifest.version) + '\*\*'
if ($readme -notmatch $versionPattern) {
    throw "README güncel manifest sürümünü belirtmiyor: $($manifest.version)"
}

Write-Host "Depo denetimi başarılı." -ForegroundColor Green
