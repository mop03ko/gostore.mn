param([string]$ToolRoot = (Join-Path $PSScriptRoot '..\tmp\tooling\android'))
$ErrorActionPreference = 'Stop'
$ToolRoot = (Resolve-Path -LiteralPath $ToolRoot).Path
$jdk = (Get-ChildItem -LiteralPath (Join-Path $ToolRoot 'jdk') -Directory | Select-Object -First 1).FullName
$platform = (Get-ChildItem -LiteralPath (Join-Path $ToolRoot 'platform') -Filter 'android.jar' -Recurse | Select-Object -First 1).FullName
$aapt = (Get-ChildItem -LiteralPath (Join-Path $ToolRoot 'build-tools') -Filter 'aapt2.exe' -Recurse | Select-Object -First 1).FullName
$bt = Split-Path $aapt
$build = Join-Path $PSScriptRoot ('build\' + [guid]::NewGuid().ToString('N'))
$output = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\output\android'))
$signing = Join-Path $PSScriptRoot 'signing'
foreach ($path in @($build, "$build\classes", "$build\dex", "$build\generated", "$build\test", $output, $signing)) { New-Item -ItemType Directory -Force -Path $path | Out-Null }
function Run([string]$exe, [string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "Build command failed: $exe ($LASTEXITCODE)" }
}
Run "$jdk\bin\javac.exe" @('-encoding','UTF-8','-d',"$build\test","$PSScriptRoot\src\mn\gostore\warehouse\NavigationPolicy.java","$PSScriptRoot\tests\NavigationPolicyTest.java")
Run "$jdk\bin\java.exe" @('-cp',"$build\test",'NavigationPolicyTest')
Run $aapt @('compile','--dir',"$PSScriptRoot\res",'-o',"$build\resources.zip")
Run $aapt @('link','-o',"$build\resources.apk",'-I',$platform,'--manifest',"$PSScriptRoot\AndroidManifest.xml",'--java',"$build\generated",'--auto-add-overlay',"$build\resources.zip")
$sources = @(Get-ChildItem "$PSScriptRoot\src","$build\generated" -Filter '*.java' -Recurse | ForEach-Object FullName)
Run "$jdk\bin\javac.exe" (@('-encoding','UTF-8','--release','8','-classpath',$platform,'-d',"$build\classes") + $sources)
Run "$jdk\bin\jar.exe" @('cf',"$build\classes.jar",'-C',"$build\classes",'.')
Run "$jdk\bin\java.exe" @('-cp',"$bt\lib\d8.jar",'com.android.tools.r8.D8','--release','--min-api','26','--lib',$platform,'--output',"$build\dex","$build\classes.jar")
Copy-Item -LiteralPath "$build\resources.apk" -Destination "$build\unsigned.apk" -Force
Run "$jdk\bin\jar.exe" @('uf',"$build\unsigned.apk",'-C',"$build\dex",'classes.dex')
Run "$bt\zipalign.exe" @('-f','-p','4',"$build\unsigned.apk","$build\aligned.apk")
# Stable private release key: never in Git, the APK, or the user download folder.
$key = Join-Path $signing 'warehouse-release.p12'
$passwordPath = Join-Path $signing 'keystore-password.txt'
if (!(Test-Path -LiteralPath $key)) {
    if (Test-Path -LiteralPath $passwordPath) { throw 'Signing password exists without key; restore the key before building updates.' }
    $bytes = New-Object byte[] 36
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose()
    [IO.File]::WriteAllText($passwordPath, [Convert]::ToBase64String($bytes), [Text.UTF8Encoding]::new($false))
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $signing /inheritance:r /grant:r "${owner}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict signing directory permissions' }
    Run "$jdk\bin\keytool.exe" @('-genkeypair','-keystore',$key,'-storetype','PKCS12','-storepass:file',$passwordPath,'-alias','warehouse','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=GOStore Warehouse, O=GOStore, C=MN')
}
if (!(Test-Path -LiteralPath $passwordPath)) { throw 'Missing signing password file; restore it rather than replacing the key.' }
$apk = Join-Path $output 'GOStore-Erenhot-1.0.0.apk'
Run "$jdk\bin\java.exe" @('-jar',"$bt\lib\apksigner.jar",'sign','--ks',$key,'--ks-key-alias','warehouse','--ks-pass',"file:$passwordPath",'--v4-signing-enabled','false','--out',$apk,"$build\aligned.apk")
Run "$jdk\bin\java.exe" @('-jar',"$bt\lib\apksigner.jar",'verify','--verbose','--print-certs',$apk)
Run "$bt\zipalign.exe" @('-c','-p','4',$apk)
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$apk.sha256", "$hash  $([IO.Path]::GetFileName($apk))`n", [Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'INSTALL.txt') -Destination (Join-Path $output 'INSTALL.txt') -Force
Write-Output "APK: $apk"
Write-Output "SHA256: $hash"
