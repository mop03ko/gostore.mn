$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot 'server/config.local.php'
$phpExecutable = Join-Path $projectRoot 'tmp/tooling/php/php.exe'
if (-not (Test-Path -LiteralPath $phpExecutable)) { $phpExecutable = (Get-Command php -ErrorAction Stop).Source }
$adminEmail = Read-Host 'Admin email'
if ($adminEmail -notmatch '^[a-zA-Z0-9._+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$') { throw 'Invalid email' }
$securePassword = Read-Host 'New admin password (at least 14 characters)' -AsSecureString
$bstrPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstrPointer)
    if ($plainPassword.Length -lt 14) { throw 'Use at least 14 characters' }
    $passwordHash = $plainPassword | & $phpExecutable (Join-Path $PSScriptRoot 'password.php')
    if ($LASTEXITCODE -ne 0 -or $passwordHash -notmatch '^\$2y\$') { throw 'Password hashing failed' }
    $setupPayload = @{ email = $adminEmail; hash = $passwordHash } | ConvertTo-Json -Compress
    $setupPayload | & $phpExecutable (Join-Path $PSScriptRoot 'configure-admin.php') $configPath
    if ($LASTEXITCODE -ne 0) { throw 'Admin setup failed; check the message above.' }
    Write-Output 'Admin config created locally. This file is ignored by Git and excluded from the deployment ZIP. Upload it separately to server/config.local.php using cPanel File Manager.'
} finally {
    $plainPassword = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrPointer)
}
