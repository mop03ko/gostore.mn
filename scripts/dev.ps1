$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$phpExecutable = Join-Path $projectRoot 'tmp/tooling/php/php.exe'
$env:GOSTORE_DATA_DIR = Join-Path $projectRoot 'tmp/local-data'
Set-Location -LiteralPath $projectRoot
if (Test-Path -LiteralPath $phpExecutable) {
    & $phpExecutable -d "extension_dir=$projectRoot/tmp/tooling/php/ext" -d extension=pdo_sqlite -d extension=mbstring -d extension=curl -d extension=gd -S 127.0.0.1:3000 scripts/router.php
} else {
    php -S 127.0.0.1:3000 scripts/router.php
}
