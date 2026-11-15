#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'A Mac with Xcode is required'; exit 1; }
[[ "${BUILD_NUMBER:-}" =~ ^[1-9][0-9]*$ ]] || exit 1
repo="$(cd "$(dirname "$0")/.." && pwd)"
export GOSTORE_IOS_APP_DIR=staff-ios APP_VARIANT=warehouse
cd "$repo"
python3 scripts/ios-mac-credentials.py prepare
export GOSTORE_PROFILE_UUID
GOSTORE_PROFILE_UUID="$(cat "$RUNNER_TEMP/gostore-ios-signing/profile-uuid")"
unset GOSTORE_IOS_SIGNING
cd staff-ios
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
workspace="$(find "$repo/staff-ios/ios" -maxdepth 1 -name '*.xcworkspace' -print -quit)"
[[ -n "$workspace" ]] || exit 1
scheme="$(basename "$workspace" .xcworkspace)"
mkdir -p "$repo/output/ios-mac"
xcodebuild -version
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$RUNNER_TEMP/gostore.xcarchive" \
  archive | tee "$RUNNER_TEMP/gostore-xcode.log" | xcbeautify
xcodebuild -exportArchive -archivePath "$RUNNER_TEMP/gostore.xcarchive" \
  -exportOptionsPlist "$RUNNER_TEMP/gostore-ios-signing/ExportOptions.plist" \
  -exportPath "$repo/output/ios-mac"
cd "$repo"
python3 scripts/ios-mac-credentials.py verify
