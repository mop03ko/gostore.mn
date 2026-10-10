$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot 'output'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivePath = Join-Path $outputDirectory 'gostore-coming-soon.zip'
$archiveStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $files = @{
        'index.html' = 'coming-soon/index.html'
        'assets/logo.png' = 'assets/logo.png'
        'assets/fonts/fonts.css' = 'assets/fonts/fonts.css'
        'assets/fonts/arimo-variable.ttf' = 'assets/fonts/arimo-variable.ttf'
        'assets/fonts/OFL-Arimo.txt' = 'assets/fonts/OFL-Arimo.txt'
        '.htaccess' = '.htaccess'
    }
    foreach ($entry in $files.GetEnumerator()) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectRoot $entry.Value), $entry.Key) | Out-Null
    }
} finally {
    $archive.Dispose()
    $archiveStream.Dispose()
}
Write-Output "Created $archivePath"
