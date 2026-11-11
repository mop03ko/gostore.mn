#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'A macOS host with Xcode is required.'; exit 1; }
[[ "${BUILD_NUMBER:-}" =~ ^[1-9][0-9]*$ ]] || { echo 'BUILD_NUMBER must be a positive integer.'; exit 1; }
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
python3 scripts/ios-mac-credentials.py prepare
export GOSTORE_PROFILE_UUID
GOSTORE_PROFILE_UUID="$(cat "$RUNNER_TEMP/gostore-ios-signing/profile-uuid")"
# Secret values are only needed by the signing/import and upload helper.
unset GOSTORE_IOS_SIGNING
cd gostoremn
node <<'NODE'
const fs = require('node:fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
if (app.expo.ios.bundleIdentifier !== 'mn.gostore.app') throw Error('Wrong app');
app.expo.ios.buildNumber = process.env.BUILD_NUMBER;
app.expo.ios.appleTeamId = '8P6PVVWKUB';
app.expo.updates.requestHeaders = { 'expo-channel-name': 'production' };
app.expo.plugins.push('../scripts/ios-mac-signing.cjs');
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
NODE
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
workspace="$(find "$repo/gostoremn/ios" -maxdepth 1 -name '*.xcworkspace' -print -quit)"
[[ -n "$workspace" ]] || { echo 'Missing generated Xcode workspace'; exit 1; }
scheme="$(basename "$workspace" .xcworkspace)"
mkdir -p "$repo/output/ios-mac"
xcodebuild -version
set -o pipefail
xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$RUNNER_TEMP/gostore.xcarchive" \
  archive | tee "$RUNNER_TEMP/gostore-xcode.log" | xcbeautify
xcodebuild -exportArchive -archivePath "$RUNNER_TEMP/gostore.xcarchive" \
  -exportOptionsPlist "$RUNNER_TEMP/gostore-ios-signing/ExportOptions.plist" \
  -exportPath "$repo/output/ios-mac"
cd "$repo"
python3 scripts/ios-mac-credentials.py verify
