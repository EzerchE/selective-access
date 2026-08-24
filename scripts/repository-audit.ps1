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
    'C:\\Users\\[^\\\s]+'
)

foreach ($file in $tracked | Where-Object { $_.Extension -notmatch '^\.(?:png|jpg|jpeg|gif|ico|exe)$' }) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            throw "Olası hassas veri bulundu: $($file.FullName)"
        }
    }
}

# Ürün anlatımında uygunsuz konumlandırmaya yol açabilecek örnekleri engeller.
# Yasaklı terimlerin kendileri ve geri döndürülebilir kodlamaları depoda tutulmaz.
$unsuitableTermHashes = @(
    '7c5cb471aa8029a526d5a7423ff4b8d8a3ee1587ec9d1337ee0cff4d41ca0582',
    '4d9128c239659d26be113a172390894cde5f0718d2eec4e2186673b0e775f4e4',
    'b5d9c4172f29c5b797383a1012d3cbb843430c0c22f013423c644a55622f5c0d',
    'd516dbecbf6a8cb4d28185bdd60f8faf9c0ceb8e8eabfb987206795e87281310',
    'c6603565c5159fbe846a53e991829d452a1546d41150c0d3c73ddbd7f476ee0d',
    '0033728f0fbc83a0f0226d91bb063540d6d0158c0bbfa1620ae5b95b10f82932'
)

function Get-TextSha256([string]$Value) {
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
        return ([BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

foreach ($file in $tracked | Where-Object { $_.Extension -notmatch '^\.(?:png|jpg|jpeg|gif|ico|exe)$' }) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($token in [regex]::Matches($content, '[A-Za-z0-9.-]+')) {
        if ($unsuitableTermHashes -contains (Get-TextSha256 $token.Value)) {
            throw "Ürün konumlandırmasına uygun olmayan alan adı/ifade örneği bulundu: $($file.FullName)"
        }
    }
}

# Kamuya açık belgelerin taşınabilir ve ürün odaklı kalmasını sağlar.
$documentationOnlyTermsBase64 = @(
    'Z29vZC1kcGk=',
    'c3BsaXR3aXJl',
    'ZmlsZWNyeXB0'
)
$documentationPatterns = @('[A-Za-z]:\\') + ($documentationOnlyTermsBase64 | ForEach-Object {
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_))
})

foreach ($file in $tracked | Where-Object { $_.Extension -eq '.md' }) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $documentationPatterns) {
        if ($content -match $pattern) {
            throw "Kamuya açık belgede bağlama özgü gereksiz ayrıntı bulundu: $($file.FullName)"
        }
    }
}

Write-Host "Depo denetimi başarılı." -ForegroundColor Green
