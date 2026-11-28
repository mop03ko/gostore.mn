const fs=require('node:fs');
const path=require('node:path');
const filename=path.join(__dirname,'../../admin/index.html');
const loader='<script src="workspace-loader.js?v=20261128-shell" defer></script>';
const source=fs.readFileSync(filename,'utf8').replace(/<script src="workspace-loader\.js\?v=[^"]+" defer><\/script>/,'')
  .replace(/admin-extra\.js\?v=[^"]+/, 'admin-extra.js?v=20261128-shell');
const marker='<script src="admin.js?';
if(!source.includes(marker))throw Error('Admin load point missing');
fs.writeFileSync(filename,source.replace(marker,loader+marker));
