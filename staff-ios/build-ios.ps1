param([ValidateSet('admin','warehouse')][string]$Variant='admin')
$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
$oldVariant=$env:APP_VARIANT
$oldNoVcs=$env:EAS_NO_VCS
$oldProjectRoot=$env:EAS_PROJECT_ROOT
try {
    $env:APP_VARIANT=$Variant
    # Upload only this standalone app, not the website or its private configuration.
    $env:EAS_NO_VCS='1'
    $env:EAS_PROJECT_ROOT=$PSScriptRoot
    & npx.cmd --yes eas-cli@27.5.0 build --platform ios --profile $Variant --no-wait
    if ($LASTEXITCODE -ne 0) { throw 'iOS build setup did not complete.' }
} finally {
    $env:APP_VARIANT=$oldVariant
    $env:EAS_NO_VCS=$oldNoVcs
    $env:EAS_PROJECT_ROOT=$oldProjectRoot
    Pop-Location
}
