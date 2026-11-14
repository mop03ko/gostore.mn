// Capture the existing release-configured simulator app; no signing keys needed.
// Only the public, isolated demo is used. No staff account or production writes.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const run = (bin, args) => {
  console.log('Running:', bin, ...args);
  return execFileSync(bin, args, { encoding: 'utf8', timeout: 240000 }).trim();
};
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
    && (!r.supportedDeviceTypes || r.supportedDeviceTypes.some(d => d.identifier === type?.identifier)))
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))[0];
  if (!type || !runtime) throw Error('13-inch iPad simulator/runtime unavailable');
  const devices = JSON.parse(sim('list', 'devices', 'available', '--json')).devices;
  console.log('Available runtimes:', runtimes.filter(r => r.isAvailable).map(r => r.name));
  const existing = (devices[runtime.identifier] || []).find(d => /iPad Pro.*13-inch/.test(d.name));
  const udid = existing?.udid || sim('create', 'GOStore warehouse screenshots', type.identifier, runtime.identifier);
  fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify({ device: type.name, runtime: runtime.name, udid, bundle: 'mn.gostore.ubwarehouse', sourceBuild: '9383c3e2-d3c8-4f27-8b43-269613009c1b', capturedAt: new Date().toISOString() }, null, 2));
  try {
    if (existing?.state !== 'Booted') sim('boot', udid);
    try { sim('bootstatus', udid, '-b'); } catch (error) {
      // Fresh CI simulators sometimes never finish the optional boot-status wait.
      // Continue only if CoreSimulator itself reports the selected device booted.
      const current = JSON.parse(sim('list', 'devices', '--json')).devices;
      if (!Object.values(current).flat().some(d => d.udid === udid && d.state === 'Booted')) throw error;
      console.log('Simulator is booted; checking app installation next.');
    }
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
