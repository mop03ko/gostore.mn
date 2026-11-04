'use strict';
// Shared browser estimate. The server independently recalculates before saving a charge.
(function(root){
 const n=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:9});
 function calculate(weight,volume,r){
  const w=Number(weight),v=Number(volume),p=r?.cargo_tariff,fx=Number(r?.cny_rate);
  if(!p||p.version!==2||![w,v,fx].every(Number.isFinite)||w<0.001||w>10000||v<=0||v>1000||fx<=0)return null;
  if(!['small_weight_limit_kg','small_volume_limit_m3','light_limit_kg','light_mnt','small_per_kg_mnt','large_per_m3_cny','large_per_tonne_cny'].every(k=>Number.isFinite(Number(p[k]))&&Number(p[k])>0))return null;
  const large=w>=p.small_weight_limit_kg||v>p.small_volume_limit_m3,wc=w*p.large_per_tonne_cny/1000,vc=v*p.large_per_m3_cny,basis=large?(wc>=vc?'weight':'volume'):(w<=p.light_limit_kg?'light':'weight');
  const cny=large?Math.max(wc,vc):null,amount=Math.ceil(Number((large?cny*fx:basis==='light'?p.light_mnt:w*p.small_per_kg_mnt).toFixed(8)));
  return amount<=100000000?{method:'auto',category:large?'large':'small',basis,weight_kg:w,volume_m3:v,weight_cny:large?wc:null,volume_cny:large?vc:null,amount_cny:cny,amount_mnt:amount,rates:r}:null;
 }
 function description(q,zh=false){
  if(!q)return '';
  if(q.method!=='auto')return (q.method==='volume'?'m³':'kg')+' · '+n(q.measure);
  const p=q.rates.cargo_tariff,kind=q.category==='large'?(zh?'大货':'Том ачаа'):(zh?'小包裹':'Жижиг илгээмж');
  const formula=q.category==='large'?'max('+n(q.weight_kg)+' kg × '+n(p.large_per_tonne_cny)+'/1000, '+n(q.volume_m3)+' m³ × '+n(p.large_per_m3_cny)+') = ¥'+n(q.amount_cny)+' × '+n(q.rates.cny_rate)+' ₮':q.basis==='light'?'≤ '+n(p.light_limit_kg)+' kg = '+n(p.light_mnt)+' ₮':n(q.weight_kg)+' kg × '+n(p.small_per_kg_mnt)+' ₮';
  return kind+' · '+n(q.weight_kg)+' kg · '+n(q.volume_m3)+' m³ · '+formula;
 }
 function tariff(r,zh=false){
  const p=r?.cargo_tariff;if(!p)return '';
  return zh?'小包裹：重量 < '+n(p.small_weight_limit_kg)+' kg 且体积 ≤ '+n(p.small_volume_limit_m3)+' m³；≤ '+n(p.light_limit_kg)+' kg：'+n(p.light_mnt)+' ₮，超过按实际重量 × '+n(p.small_per_kg_mnt)+' ₮/kg。大货：重量 ≥ '+n(p.small_weight_limit_kg)+' kg 或体积 > '+n(p.small_volume_limit_m3)+' m³，取 '+n(p.large_per_m3_cny)+' 元/m³ 和 '+n(p.large_per_tonne_cny)+' 元/吨计算结果中的较高金额。两种运费不叠加。':'Жижиг илгээмж: '+n(p.small_weight_limit_kg)+' кг-аас доош, '+n(p.small_volume_limit_m3)+' м³-ээс ихгүй. '+n(p.light_limit_kg)+' кг хүртэл '+n(p.light_mnt)+' ₮; түүнээс дээш бодит жин × '+n(p.small_per_kg_mnt)+' ₮/кг. Том ачаа: '+n(p.small_weight_limit_kg)+' кг хүрсэн эсвэл '+n(p.small_volume_limit_m3)+' м³-ээс давсан үед '+n(p.large_per_m3_cny)+' ¥/м³, '+n(p.large_per_tonne_cny)+' ¥/тонны тооцооны их дүнг авна. Хоёр тарифыг давхар нэмэхгүй.';
 }
 const api={calculate,description,tariff};root.GOStoreCargo=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
