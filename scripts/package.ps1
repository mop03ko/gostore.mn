$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot 'output'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$publicFiles = @('index.html', 'styles.css', 'script.js', 'store-server.js', 'account.js', 'supplier.js', 'cargo.js', 'barcode.js', '.htaccess') | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) }
$publicFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'assets') -File -Recurse | Where-Object { $_.FullName -notlike '*\assets\uploads\*' -or $_.Name -eq '.htaccess' }
$publicFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'admin') -File
$publicFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'warehouse') -File
$publicFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot 'api') -File
$publicFiles += @('.htaccess', 'bootstrap.php', 'qpay.php', 'qpay-http.php', 'customers.php', 'warehouse.php', 'warehouse-batches.php', 'logistics.php', 'freight-payment.php', 'shipping.php', 'supplier.php', 'config.example.php', 'seed.json') | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot "server/$_") -Force }
$archivePath = Join-Path $outputDirectory 'gostore-preview.zip'
$archiveStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($publicFile in $publicFiles) {
        $entryName = $publicFile.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $publicFile.FullName, $entryName) | Out-Null
    }
} finally {
    $archive.Dispose()
    $archiveStream.Dispose()
}
Write-Output 'Created output/gostore-preview.zip (application files; no local config, credentials or database).'
