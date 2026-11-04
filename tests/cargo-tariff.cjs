const assert=require('node:assert/strict'),fs=require('node:fs'),{spawnSync}=require('node:child_process'),C=require('../cargo-tariff.js');
const p=spawnSync('tmp/tooling/php/php.exe',['-r',"require 'server/cargo-tariff.php'; echo json_encode(cargo_tariff_policy());"],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
const rates={cny_rate:550,cargo_tariff:JSON.parse(p.stdout)};
for(const c of require('./cargo-tariff-cases.json')){const q=C.calculate(c.w,c.v,rates);assert.equal(q.category,c.category);assert.equal(q.basis,c.basis);assert.equal(q.amount_mnt,c.amount,JSON.stringify(c));}
for(const [w,v] of [[null,.1],[1,null],[0,1],[1,0],[-1,1],[Infinity,1],[1,NaN],[10001,1],[1,1001]])assert.equal(C.calculate(w,v,rates),null);
assert.equal(C.calculate(1,.1,{}),null);assert.equal(C.calculate(1000,.1,{...rates,cny_rate:600}).amount_mnt,780000);
console.log('PASS shared cargo preview: thresholds, both bulk bases, fractional kg, missing measurements and FX.');
