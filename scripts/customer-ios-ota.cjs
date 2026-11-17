// Reproduce the config of the public Mac-built iOS 1.0.2 (20), then verify its
// fingerprint. No runtime override, signing credentials, prebuild or native build.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const buildCommit = '4fff9935556edb14c68fccfd17458ccf85910edf';
const expectedRuntime = '646e611a39796fd0c8cb87ef08a4ea35cc51abba';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git(['status', '--porcelain', '--', 'gostoremn'])) throw Error('Commit the reviewed customer app before preparing its OTA.');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--publish')) throw Error('Usage: node scripts/customer-ios-ota.cjs [--publish]');
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
const stage = fs.mkdtempSync(path.join(root, 'tmp/customer-ios-ota-'));
for (const relative of git(['ls-files', 'gostoremn']).split('\n')) {
  const target = path.resolve(stage, relative);
  if (!target.startsWith(stage + path.sep)) throw Error('Unsafe staged path');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, relative), target);
}
fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });
fs.writeFileSync(path.join(stage, 'scripts/ios-mac-signing.cjs'), execFileSync('git', ['show', `${buildCommit}:scripts/ios-mac-signing.cjs`], { cwd: root }));
const project = path.join(stage, 'gostoremn');
fs.symlinkSync(path.join(root, 'gostoremn/node_modules'), path.join(project, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const configPath = path.join(project, 'app.json');
const app = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (app.expo.ios.bundleIdentifier !== 'mn.gostore.app' || app.expo.version !== '1.0.2') throw Error('Release identity changed; reassess the installed iOS runtime.');
app.expo.ios.buildNumber = '20';
app.expo.ios.appleTeamId = '8P6PVVWKUB';
app.expo.updates.requestHeaders = { 'expo-channel-name': 'production' };
app.expo.plugins.push('../scripts/ios-mac-signing.cjs');
fs.writeFileSync(configPath, JSON.stringify(app, null, 2) + '\n');
const env = { ...process.env, EXPO_PUBLIC_API_ORIGIN: 'https://gostore.mn', GOSTORE_PROFILE_UUID: 'config-evaluation-only' };
const fingerprint = JSON.parse(execFileSync(process.execPath, [path.join(project, 'node_modules/expo-updates/bin/cli.js'), 'fingerprint:generate', '--platform', 'ios'], { cwd: project, env, encoding: 'utf8' }));
fs.writeFileSync(path.join(stage, 'fingerprint.json'), JSON.stringify(fingerprint, null, 2));
if (fingerprint.hash !== expectedRuntime) throw Error(`Native runtime differs: ${fingerprint.hash}; expected ${expectedRuntime}. Do not publish to build 20.`);
console.log(JSON.stringify({ project, commit: git(['rev-parse', 'HEAD']), runtime: fingerprint.hash, compatibleBuild: 'iOS 1.0.2 (20)' }));
if (args.includes('--publish')) {
  // Fixed CLI arguments only. On Windows npx is a cmd shim.
  const command = 'npx eas-cli@latest update --channel production --platform ios --environment production --message "Swipe categories and verified home deals" --non-interactive';
  const result = spawnSync(command, { cwd: project, env, shell: true, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
