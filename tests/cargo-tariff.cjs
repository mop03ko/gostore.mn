const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),C=require('../cargo-tariff.js');
// The server tariff runs in PHP with the same inputs as the browser estimate.
function php(code){
  const file=path.join(os.tmpdir(),'gostore-cargo-'+process.pid+'.php');
  fs.writeFileSync(file,"<?php declare(strict_types=1); function fail(string $m,int $c=400): never {throw new RuntimeException($m,$c);} require "+JSON.stringify(path.resolve('server/cargo-tariff.php'))+"; "+code);
  try{const p=spawnSync('tmp/tooling/php/php.exe',[file],{encoding:'utf8'});assert.equal(p.status,0,p.stderr+p.stdout);return JSON.parse(p.stdout);}finally{fs.rmSync(file,{force:true});}
}
const rates={cny_rate:550,cargo_tariff:php('echo json_encode(cargo_tariff_policy());')};
assert.equal(rates.cargo_tariff.version,3);
// Version 3: 1,000 ₮ for each started 0.5 kg; the browser estimate and the server agree on every case.
const cases=require('./cargo-tariff-cases.json');
const server=php('$r=json_decode('+JSON.stringify(JSON.stringify(rates))+',true);echo json_encode(array_map(fn($c)=>cargo_tariff_calculate((float)$c[0],(float)$c[1],$r)["amount_mnt"],json_decode('+JSON.stringify(JSON.stringify(cases.map(c=>[c.w,c.v])))+',true)));');
cases.forEach((c,i)=>{const q=C.calculate(c.w,c.v,rates);assert.equal(q.category,c.category);assert.equal(q.basis,c.basis);assert.equal(q.amount_mnt,c.amount,JSON.stringify(c));assert.equal(server[i],c.amount,'server '+JSON.stringify(c));});
for(const [w,v] of [[null,.1],[1,null],[0,1],[1,0],[-1,1],[Infinity,1],[1,NaN],[10001,1],[1,1001]])assert.equal(C.calculate(w,v,rates),null);
assert.equal(C.calculate(1,.1,{}),null);assert.equal(C.calculate(1000,.1,{...rates,cny_rate:600}).amount_mnt,780000);
// Descriptions name the steps; the published tariff text states the new rule.
assert.match(C.description(C.calculate(1.2,.1,rates)),/3 × 0\.5 kg × 1,000 ₮/);
assert.match(C.tariff(rates),/эхэлсэн 0\.5 кг тутамд 1,000 ₮/);assert.match(C.tariff(rates,true),/每 0\.5 kg/);
// Quotes saved with version 2 keep their original price, in the browser and on the server.
const v2={cny_rate:550,cargo_tariff:{version:2,small_weight_limit_kg:70,small_volume_limit_m3:1,light_limit_kg:1,light_mnt:1000,small_per_kg_mnt:2000,large_per_m3_cny:390,large_per_tonne_cny:1300}};
for(const [w,amount] of [[0.8,1000],[1.001,2002],[2,4000]]){
  assert.equal(C.calculate(w,.1,v2).amount_mnt,amount);
  assert.equal(php('$r=json_decode('+JSON.stringify(JSON.stringify(v2))+',true);echo json_encode(cargo_tariff_calculate('+w+',0.1,$r)["amount_mnt"]);'),amount,'server v2 '+w);
}
console.log('PASS shared cargo preview: 0.5 kg steps (browser = server), thresholds, both bulk bases, version 2 quotes, missing measurements and FX.');
