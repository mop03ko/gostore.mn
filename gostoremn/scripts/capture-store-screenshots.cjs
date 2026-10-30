// Runs only for the screenshot profile, on the EAS macOS worker after a simulator build.
// Screens show the real app and public live catalog. No account or purchase is created.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', timeout: 180000 }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  if (process.env.GOSTORE_CAPTURE_SCREENSHOTS !== '1') return;
  if (process.platform !== 'darwin' || process.env.EAS_BUILD_PLATFORM !== 'ios') throw Error('Requires an EAS iOS simulator build');
  const roots = [path.resolve('ios/build'), path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData')].filter(fs.existsSync);
  const apps = roots.flatMap(root => run('find', [root, '-name', '*.app', '-type', 'd', '-prune']).split('\n').filter(Boolean));
  const app = apps.find(file => {
    try { return run('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleIdentifier', path.join(file, 'Info.plist')]) === 'mn.gostore.app'; } catch { return false; }
  });
  if (!app) throw Error('Built simulator application not found');
  const devices = JSON.parse(sim('list', 'devices', 'available', '--json')).devices;
  let device = Object.entries(devices).filter(([runtime]) => runtime.includes('iOS')).reverse().flatMap(([, list]) => list).find(d => /iPhone.*Pro Max/.test(d.name));
  if (!device) {
    const types = JSON.parse(sim('list', 'devicetypes', '--json')).devicetypes;
    const type = types.find(d => d.name === 'iPhone 16 Pro Max') || types.filter(d => /iPhone.*Pro Max/.test(d.name)).at(-1);
    const runtime = JSON.parse(sim('list', 'runtimes', '--json')).runtimes.filter(r => r.isAvailable && /iOS/.test(r.name)).at(-1);
    if (!type || !runtime) throw Error('No supported iPhone simulator runtime: ' + JSON.stringify({types:types.map(t=>t.name),runtimes:JSON.parse(sim('list','runtimes','--json')).runtimes.map(r=>r.name)}));
    device = { udid: sim('create', 'GOStore Store Screenshots', type.identifier, runtime.identifier), name: type.name, state: 'Shutdown' };
  }
  console.log('Capturing native screenshots on', device.name);
  if (device.state !== 'Booted') sim('boot', device.udid);
  sim('bootstatus', device.udid, '-b');
  sim('status_bar', device.udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100');
  sim('install', device.udid, app);
  sim('launch', device.udid, 'mn.gostore.app');
  await sleep(30000);
  const dir = path.resolve('store-screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const maestroOutput = path.resolve('store-maestro-output');
  execFileSync('maestro', ['--device', device.udid, 'test', '--test-output-dir', maestroOutput, '.maestro/store-screenshots.yaml'], { stdio: 'inherit', timeout: 600000 });
  const screenshots = run('find', [maestroOutput, '-name', '*.png', '-type', 'f']).split('\n');
  for (const name of ['01-home', '02-categories', '03-product', '04-options', '05-orders', '06-profile']) {
    const file = screenshots.find(f => path.basename(f) === name + '.png');
    if (!file) throw Error('Missing screenshot: ' + name);
    fs.copyFileSync(file, path.join(dir, name + '.png'));
  }
  fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify({ device: device.name, bundleId: 'mn.gostore.app', source: 'native iOS Simulator / live public catalog', capturedAt: new Date().toISOString() }, null, 2));
  sim('shutdown', device.udid);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
