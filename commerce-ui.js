'use strict';
// Shared customer-facing policy copy. Amounts remain server-authoritative at checkout.
window.commerceUI = (() => {
  const settings = () => window.storeServer?.shipping || {};
  const paymentText = (s = settings()) => {
    if(s.catalog_provider==='taoworld')return 'Одоо: барааны үнэ, Хятад доторх хүргэлт, үйлчилгээний хураамж. Хятад доторх хүргэлтийг төлбөр тооцох үед шалгана. Дараа: олон улсын карго, сонгосон бол УБ хүргэлт. Дараах төлбөрийг Улаанбаатарт ирэхэд бодит дүнгээр тооцно.';
    const domestic = Number(s.domestic_default_cny) > 0;
    return `Одоо: барааны үнэ, үйлчилгээний хураамж${domestic ? ', Хятад доторх хүргэлтийн урьдчилсан дүн' : ''}. Дараа: ${domestic ? '' : 'Хятад доторх хүргэлт, '}олон улсын карго, сонгосон бол УБ хүргэлт. Дараах төлбөрийг Улаанбаатарт ирэхэд бодит дүнгээр тооцно.`;
  };
  const timingText = () => 'Ирэх өдөр одоогоор баталгаажаагүй. Нийлүүлэгчийн илгээлт, хил, тээврээс хамаарна. Явцыг Миний захиалгууд хэсгээс хянана.';
  // A SKU may be one piece, a pair or a pack. Do not infer a pack size from a title.
  const unit = 'ш';
  const unitHelp = 'Тоо нь сонгосон хувилбарын ширхэг. Багцын бүрдлийг сонголтын нэр, үзүүлэлтээс шалгана уу.';
  const number = n => Number(n).toLocaleString('en-US',{maximumFractionDigits:4});
  // Customer prices only: supplier cost, account identifiers and purchase proofs are never used here.
  // Checkout calls the upfront amount «Одоо төлөх» like the cart; order history names it as the first payment.
  function calculationHtml(q, items = [], title = 'Тооцооны дэлгэрэнгүй', totalLabel = 'Одоо төлөх') {
    const b=q?.breakdown,inputs=q?.inputs||q,r=q?.rates||q;
    if(!b||!r||!(Number(r.cny_rate)>0)||![inputs.goods_cny,inputs.domestic_cny,r.service_percent,r.service_fee_mnt].every(n=>n!==null&&n!==''&&Number.isFinite(Number(n))))return '';
    const row=(label,formula,amount)=>`<div class="calculation-row"><div><span>${label}</span>${formula?`<small>${formula}</small>`:''}</div><strong>${amount}</strong></div>`;
    const lines=items.filter(i=>Number(i.unit_cny)>0&&Number(i.qty)>0).map(i=>`<li><span>${esc(i.name||i.id)}<small>${esc(i.variant||'')}</small></span><strong>¥${number(i.unit_cny)} × ${number(i.qty)} = ¥${number(i.goods_cny??Math.round(i.unit_cny*i.qty*100)/100)}</strong></li>`).join('');
    return `<section class="customer-calculation"><h3>${esc(title)}</h3>${lines?`<ul class="calculation-items">${lines}</ul>`:''}<p class="calculation-rate">Хэрэглэсэн ханш: 1 CNY = ${money(r.cny_rate)}</p>${row('Барааны нийт үнэ',`¥${number(inputs.goods_cny)} × ${number(r.cny_rate)} ₮`,money(b.goods_mnt))}${row(`Хятад доторх хүргэлт${inputs.vendors?` · ${number(inputs.vendors)} дэлгүүр`:''}`,q.domestic_later?'Эрээн агуулах хүртэлх бодит дүнг дараа тооцно':`¥${number(inputs.domestic_cny)} × ${number(r.cny_rate)} ₮ · Эрээн агуулах хүртэл`,q.domestic_later?'Дараа тооцно':money(b.domestic_mnt))}${row('Үйлчилгээний хураамж',`${money(b.goods_mnt)} × ${number(r.service_percent)}% + ${money(r.service_fee_mnt)}`,money(b.service_mnt))}${row(esc(totalLabel),'Бараа + одоо тооцсон Хятад хүргэлт + үйлчилгээ',money(q.total))}<p class="calculation-note">Төгрөгт шилжүүлсэн дүн болон хувийн хураамжийг бүхэл төгрөг рүү дээш тоймлоно.</p><div class="commerce-later"><strong>Дараа төлөх зардал</strong><p>${q.domestic_later?'Хятад доторх хүргэлт. ':''}Олон улсын карго: агуулахын бодит жин эсвэл эзлэхүүн, тарифаар тооцно. УБ хүргэлт сонговол төлбөрийг тусад нь нэмнэ. Эдгээр дүн эхний төлбөрт ороогүй.</p><a href="/help#delivery">Каргоны тариф, тооцоолуур →</a></div></section>`;
  }
  function estimate(items, s = settings()) {
    const rate = Number(s.cny_rate);
    if (!(rate > 0) || !items.length || items.some(i => !(Number(i.cny) > 0) || !Number.isInteger(i.qty))) return null;
    const goodsCny = Math.round(items.reduce((sum, i) => sum + Number(i.cny) * i.qty, 0) * 100) / 100;
    const goods = Math.ceil(Number((goodsCny * rate).toFixed(8)));
    const service = Math.ceil(Number((goods * (Number(s.service_percent) || 0) / 100).toFixed(8))) + (Number(s.service_fee_mnt) || 0);
    // Older carts lack seller IDs: leave the domestic amount unknown until the server quote.
    const native=s.catalog_provider==='taoworld',domesticLater = !native&&!(Number(s.domestic_default_cny) > 0);
    const sellersKnown = items.every(i => typeof i.vendor_id === 'string');
    const vendors = new Set(items.map(i => i.vendor_id ? 'v:' + i.vendor_id : 'p:' + i.id)).size;
    const domestic = native?null:domesticLater ? 0 : sellersKnown ? Math.ceil(Number((vendors * Number(s.domestic_default_cny) * rate).toFixed(8))) : null;
    return {goods, service, domestic, domesticLater, total: domestic === null ? null : goods + service + domestic};
  }
  function estimateHtml(items, s = settings()) {
    const q = estimate(items, s);
    const value = n => n === null || n === undefined ? 'Захиалга үргэлжлүүлэхэд шалгана' : money(n);
    const formula=q?`<p class="calculation-note">Ханш: 1 CNY = ${money(s.cny_rate)}<br>Бараа: ¥${number(Math.round(items.reduce((sum,i)=>sum+Number(i.cny)*i.qty,0)*100)/100)} × ${number(s.cny_rate)} ₮ = ${money(q.goods)}<br>Үйлчилгээ: ${money(q.goods)} × ${number(Number(s.service_percent)||0)}% + ${money(Number(s.service_fee_mnt)||0)} = ${money(q.service)}</p>`:'';
    return `<dl class="commerce-estimate"><div><dt>Барааны дүн</dt><dd>${value(q?.goods)}</dd></div><div><dt>Үйлчилгээний хураамж</dt><dd>${value(q?.service)}</dd></div><div><dt>Хятад доторх хүргэлт</dt><dd>${q?.domesticLater ? 'Дараа · бодит дүнгээр' : value(q?.domestic)}</dd></div><div class="total"><dt>Одоо төлөх · урьдчилсан</dt><dd>${value(q?.total)}</dd></div></dl>${formula}<p class="account-hint">Үнэ, үлдэгдлийг захиалгын дараагийн алхамд дахин шалгана.</p><div class="commerce-later"><strong>Дараа төлөх</strong><p>${q?.domesticLater ? 'Хятад доторх хүргэлт, ' : ''}олон улсын карго, сонгосон бол УБ хүргэлт. Эцсийн нийт зардалд эдгээр төлбөр нэмэгдэнэ.</p><a href="/help#delivery">Каргоны тариф, тооцоолуур →</a></div>`;
  }
  function calculator(s = settings()) {
    if(settings().cargo_tariff)s=settings();
    if (!s.cargo_tariff) return '';
    const rates={cny_rate:s.cny_rate,cargo_tariff:s.cargo_tariff};
    return `<details class="commerce-calculator" data-cargo-rates="${esc(JSON.stringify(rates))}"><summary>Жин, эзлэхүүнээр карго тооцоолох</summary><p>Эрээн → Улаанбаатар тээврийн урьдчилсан зардал. Нийт жин болон савласан эзлэхүүн хоёул хэрэгтэй. Эцсийн төлбөрийг агуулах бодитоор хэмжиж батална.</p><p>${esc(GOStoreCargo.tariff(s))}</p><label class="field">Нийт жин · кг<input data-cargo-weight type="number" min="0.001" max="10000" step="any" inputmode="decimal" placeholder="Жишээ: 1.5"></label><label class="field">Эзлэхүүн оруулах хэлбэр<select data-cargo-method><option value="dimensions">Урт × өргөн × өндөр · см</option><option value="volume">Нийт эзлэхүүн · м³</option></select></label><label class="field" data-cargo-direct hidden>Нийт эзлэхүүн · м³<input data-cargo-measure type="number" min="0.000000001" max="1000" step="any" inputmode="decimal"></label><div class="cargo-dimensions">${[['length','Урт · см'],['width','Өргөн · см'],['height','Өндөр · см'],['packages','Ижил хэмжээтэй савлагааны тоо']].map(([k,label])=>`<label class="field">${label}<input data-cargo-${k} type="number" inputmode="decimal" min="${k==='packages'?1:0.1}" max="${k==='packages'?10000:1000}" step="${k==='packages'?1:'any'}" ${k==='packages'?'value="1"':''}></label>`).join('')}<small>Савлагааны тоогоор зөвхөн эзлэхүүнийг үржүүлнэ. Дээр нийт жингээ оруулна.</small></div><output data-cargo-estimate aria-live="polite">Жин болон эзлэхүүнээ оруулна уу.</output><small>Барааны үнэ, үйлчилгээ, Эрээн хүртэлх болон УБ хүргэлт энэ дүнд ороогүй.</small></details>`;
  }
  function cargoEstimate(method, values, s) {
    let volume=Number(values.measure);
    if(method==='dimensions'){
      const [l,w,h,count]=['length','width','height','packages'].map(k=>Number(values[k]));
      if(![l,w,h].every(v=>Number.isFinite(v)&&v>=0.1&&v<=1000)||!Number.isInteger(count)||count<1||count>10000)return null;
      volume=Number((l*w*h*count/1000000).toFixed(9));
    }else if(method!=='volume')return null;
    const q=GOStoreCargo.calculate(values.weight,volume,s);
    return q?{...q,measure:volume,amount:q.amount_mnt,formula:GOStoreCargo.description(q)}:null;
  }
  function updateCalculator(e) {
    const box=e.target.closest('.commerce-calculator');if(!box)return;
    const s=JSON.parse(box.dataset.cargoRates),method=box.querySelector('[data-cargo-method]').value;
    box.querySelector('[data-cargo-direct]').hidden=method==='dimensions';box.querySelector('.cargo-dimensions').hidden=method!=='dimensions';
    const values=Object.fromEntries(['weight','measure','length','width','height','packages'].map(k=>[k,box.querySelector(`[data-cargo-${k}]`).value])),q=cargoEstimate(method,values,s);
    box.querySelector('output').textContent=q?`${q.formula}\nКаргоны урьдчилсан дүн: ${money(q.amount)}`:'Нийт жин болон эзлэхүүнээ зөв оруулна уу. Савлагааны тоо бүхэл байна.';
  }
  document.addEventListener('input',updateCalculator);document.addEventListener('change',updateCalculator);
  const calculationTitle='Захиалах үеийн тооцоо';
  return {paymentText, timingText, unit, unitHelp, estimate, estimateHtml, calculator, cargoEstimate, calculationHtml, calculationTitle};
})();
