// Capture the existing release-configured simulator app; no signing keys needed.
// Only the public, isolated demo is used. No staff account or production writes.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', timeout: 240000 }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
async function main() {
  if (process.platform !== 'darwin') throw Error('Requires a Mac simulator runner');
  const out = path.resolve('output/warehouse-ipad');
  fs.mkdirSync(out, { recursive: true });
  const root = path.join(process.env.RUNNER_TEMP, 'warehouse-simulator');
  const app = run('find', [root, '-name', '*.app', '-type', 'd', '-prune']).split('\n').find(p => {
    try { return run('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleIdentifier', path.join(p, 'Info.plist')]) === 'mn.gostore.ubwarehouse'; } catch { return false; }
  });
  if (!app) throw Error('Expected warehouse simulator app missing');
  const types = JSON.parse(sim('list', 'devicetypes', '--json')).devicetypes;
  const type = types.filter(t => /iPad Pro.*13-inch/.test(t.name)).at(-1);
  const runtimes = JSON.parse(sim('list', 'runtimes', '--json')).runtimes;
  const runtime = runtimes.filter(r => r.isAvailable && /iOS/.test(r.name)
    && !/iPhone\d/.test(r.identifier)
    && (!r.supportedDeviceTypes || r.supportedDeviceTypes.some(d => d.identifier === type?.identifier))).at(-1);
  if (!type || !runtime) throw Error('13-inch iPad simulator/runtime unavailable');
  const udid = sim('create', 'GOStore warehouse screenshots', type.identifier, runtime.identifier);
  fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify({ device: type.name, runtime: runtime.name, udid, bundle: 'mn.gostore.ubwarehouse', sourceBuild: '9383c3e2-d3c8-4f27-8b43-269613009c1b', capturedAt: new Date().toISOString() }, null, 2));
  try {
    sim('boot', udid);
    sim('bootstatus', udid, '-b');
    sim('status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100');
    sim('install', udid, app);
    sim('launch', udid, 'mn.gostore.ubwarehouse');
    await new Promise(resolve => setTimeout(resolve, 15000));
    sim('io', udid, 'screenshot', path.join(out, 'ipad-login.png'));
    const flow = path.join(out, 'demo.yaml');
    fs.writeFileSync(flow, 'appId: mn.gostore.ubwarehouse\n---\n- extendedWaitUntil:\n    visible: ".*Try demo.*"\n    timeout: 60000\n- tapOn: ".*Try demo.*"\n- extendedWaitUntil:\n    visible: ".*GS-DEMO.*"\n    timeout: 60000\n- takeScreenshot: ipad-dashboard\n');
    execFileSync('maestro', ['--device', udid, 'test', '--test-output-dir', out, flow], { stdio: 'inherit', timeout: 600000 });
    sim('io', udid, 'screenshot', path.join(out, 'ipad-demo.png'));
  } finally {
    try { sim('io', udid, 'screenshot', path.join(out, 'ipad-final.png')); } catch {}
    try { sim('shutdown', udid); } catch {}
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
