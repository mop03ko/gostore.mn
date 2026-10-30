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
    return `<dl class="commerce-estimate"><div><dt>Барааны дүн</dt><dd>${value(q?.goods)}</dd></div><div><dt>Үйлчилгээний хураамж</dt><dd>${value(q?.service)}</dd></div><div><dt>Хятад доторх хүргэлт</dt><dd>${q?.domesticLater ? 'Дараа · бодит дүнгээр' : value(q?.domestic)}</dd></div><div class="total"><dt>Одоо төлөх · урьдчилсан</dt><dd>${value(q?.total)}</dd></div></dl><p class="account-hint">Үнэ, үлдэгдлийг захиалгын дараагийн алхамд дахин шалгана.</p><div class="commerce-later"><strong>Дараа төлөх</strong><p>${q?.domesticLater ? 'Хятад доторх хүргэлт, ' : ''}олон улсын карго, сонгосон бол УБ хүргэлт. Эцсийн нийт зардалд эдгээр төлбөр нэмэгдэнэ.</p><a href="/help#delivery">Каргоны тариф, тооцоолуур →</a></div>`;
  }
  function calculator(s = settings()) {
    if (!(Number(s.weight_step_kg) > 0)) return '';
    return `<details class="commerce-calculator"><summary>Каргоны зардлаа тооцоолох</summary><p>Өөрийн мэдэх жин эсвэл эзлэхүүнийг оруулна уу. Энэ нь урьдчилсан тооцоо; агуулах бодитоор хэмжиж тооцох аргыг баталгаажуулна.</p><label class="field">Тооцох арга<select data-cargo-method><option value="weight">Жин · кг</option><option value="volume">Эзлэхүүн · м³</option></select></label><label class="field">Хэмжээ<input data-cargo-measure type="number" min="0.001" max="100000" step="any" inputmode="decimal" placeholder="Жишээ: 1.5"></label><output data-cargo-estimate aria-live="polite">Хэмжээгээ оруулна уу.</output><small>Бараа, үйлчилгээ, Хятад доторх болон УБ хүргэлт ороогүй.</small></details>`;
  }
  document.addEventListener('input', e => {
    const box = e.target.closest('.commerce-calculator'); if (!box) return;
    const s = settings(), n = Number(box.querySelector('[data-cargo-measure]').value), method = box.querySelector('[data-cargo-method]').value;
    const amount = method === 'weight' ? Math.ceil(Number((n / Number(s.weight_step_kg)).toFixed(9))) * Number(s.weight_step_mnt) : n * Number(n < s.volume_threshold ? s.volume_small_cny : s.volume_large_cny) * Number(s.cny_rate);
    box.querySelector('output').textContent = n > 0 && n <= 100000 && Number.isFinite(amount) ? 'Каргоны урьдчилсан дүн: ' + money(Math.ceil(Number(amount.toFixed(8)))) : '0-ээс их зөв хэмжээ оруулна уу.';
  });
  return {paymentText, timingText, unit, unitHelp, estimate, estimateHtml, calculator};
})();
