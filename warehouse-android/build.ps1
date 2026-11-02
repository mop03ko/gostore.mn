param([string]$ToolRoot = (Join-Path $PSScriptRoot '..\tmp\tooling\android'))
$ErrorActionPreference='Stop'
$ToolRoot=(Resolve-Path -LiteralPath $ToolRoot).Path
$workspace=Split-Path $PSScriptRoot
$gradleRoot=Join-Path $workspace 'tmp\tooling\gradle'
$gradle=Join-Path $gradleRoot 'gradle-8.11.1\bin\gradle.bat'
function Run([string]$exe,[string[]]$arguments){ & $exe @arguments; if($LASTEXITCODE -ne 0){throw "Build failed: $exe ($LASTEXITCODE)"} }
if(!(Test-Path -LiteralPath $gradle)){
 New-Item -ItemType Directory -Force -Path $gradleRoot | Out-Null
 $archive=Join-Path $gradleRoot 'gradle-8.11.1-bin.zip'
 Run 'curl.exe' @('-fsSL','--retry','2','-o',$archive,'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip')
 $expected=(& curl.exe -fsSL 'https://services.gradle.org/distributions/gradle-8.11.1-bin.zip.sha256').Trim()
 if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Gradle checksum mismatch'}
 Expand-Archive -LiteralPath $archive -DestinationPath $gradleRoot
}
$jdk=(Get-ChildItem -LiteralPath (Join-Path $ToolRoot 'jdk') -Directory | Select-Object -First 1).FullName
$sdk=Join-Path $ToolRoot 'sdk'
New-Item -ItemType Directory -Force -Path "$sdk\platforms","$sdk\build-tools" | Out-Null
if(!(Test-Path -LiteralPath "$sdk\platforms\android-35")){Copy-Item -LiteralPath "$ToolRoot\platform\android-35" -Destination "$sdk\platforms\android-35" -Recurse}
if(!(Test-Path -LiteralPath "$sdk\build-tools\35.0.0")){
 $bt=(Get-ChildItem -LiteralPath (Join-Path $ToolRoot 'build-tools') -Filter 'aapt2.exe' -Recurse | Select-Object -First 1).DirectoryName
 Copy-Item -LiteralPath $bt -Destination "$sdk\build-tools\35.0.0" -Recurse
}
if(!(Test-Path -LiteralPath "$sdk\platform-tools") -and (Test-Path -LiteralPath "$ToolRoot\adb\platform-tools")){Copy-Item -LiteralPath "$ToolRoot\adb\platform-tools" -Destination "$sdk\platform-tools" -Recurse}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'local.properties'),'sdk.dir='+$sdk.Replace('\','/').Replace(':','\:')+"`n",[Text.UTF8Encoding]::new($false))
$client=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'google-services.json') -Raw | ConvertFrom-Json
if($client.project_info.project_id -ne 'gostore-warehouse' -or $client.client[0].client_info.android_client_info.package_name -ne 'mn.gostore.warehouse'){throw 'Firebase project/package mismatch'}
foreach($privateFile in @('warehouse-release.p12','keystore-password.txt')){if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot "signing\$privateFile"))){throw 'Restore the existing release signing key and password before building an update.'}}
$previousJava=$env:JAVA_HOME;$previousGradle=$env:GRADLE_USER_HOME;$previousDebug=$env:DEBUG
try{
 $env:JAVA_HOME=$jdk;$env:GRADLE_USER_HOME=Join-Path $workspace 'tmp\tooling\gradle-user';$env:DEBUG=$null
 $test=Join-Path $PSScriptRoot 'build\navigation-test';New-Item -ItemType Directory -Force -Path $test | Out-Null
 Run "$jdk\bin\javac.exe" @('-encoding','UTF-8','-d',$test,"$PSScriptRoot\src\mn\gostore\warehouse\NavigationPolicy.java","$PSScriptRoot\tests\NavigationPolicyTest.java")
 Run "$jdk\bin\java.exe" @('-cp',$test,'NavigationPolicyTest')
 Run $gradle @('-p',$PSScriptRoot,'assembleRelease','testReleaseUnitTest','lintRelease','--console=plain')
 $output=Join-Path $workspace 'output\android';New-Item -ItemType Directory -Force -Path $output | Out-Null
 $apk=Join-Path $output 'GOStore-Erenhot-1.1.0.apk'
 Copy-Item -LiteralPath "$PSScriptRoot\build\outputs\apk\release\GOStoreWarehouse-release.apk" -Destination $apk -Force
 Run "$jdk\bin\java.exe" @('-jar',"$sdk\build-tools\35.0.0\lib\apksigner.jar",'verify','--verbose','--print-certs',$apk)
 Run "$sdk\build-tools\35.0.0\zipalign.exe" @('-c','-p','4',$apk)
 $hash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
 [IO.File]::WriteAllText("$apk.sha256","$hash  $([IO.Path]::GetFileName($apk))`n",[Text.UTF8Encoding]::new($false))
 Copy-Item -LiteralPath "$PSScriptRoot\INSTALL.txt" -Destination (Join-Path $output 'INSTALL.txt') -Force
 Write-Output "APK: $apk"
 Write-Output "SHA256: $hash"
}finally{$env:JAVA_HOME=$previousJava;$env:GRADLE_USER_HOME=$previousGradle;$env:DEBUG=$previousDebug}
