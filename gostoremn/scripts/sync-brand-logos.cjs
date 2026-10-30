// Bundle the website's exact SVG artwork for offline native rendering.
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../assets/brands');
const destination = path.resolve(__dirname, '../src/lib/brand-logos.json');
const ids = ['nike','adidas','puma','newbalance','uniqlo','zara','hm','thenorthface','sony','xiaomi','lego','ikea'];
const logos = Object.fromEntries(ids.map(id => [id, fs.readFileSync(path.join(source, id + '.svg'), 'utf8').trim()]));
const content = JSON.stringify(logos, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(destination, 'utf8') !== content) throw Error('Native brand logos differ from the website. Run node scripts/sync-brand-logos.cjs.');
  console.log('All 12 mobile logos match the website SVG artwork.');
} else fs.writeFileSync(destination, content);
