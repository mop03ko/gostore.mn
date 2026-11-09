'use strict';
(() => {
  const dateActive = () => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return parts.find(part => part.type === 'month').value === '11' && Number(parts.find(part => part.type === 'day').value) <= 11;
  };
  // The admin can end the campaign early or extend it to a date (Сайтын тохиргоо). Until that answer
  // arrives the date rule applies, so the section still appears without waiting for the server.
  let override = null, until = '', rerender = null;
  const active = () => override === null ? dateActive() : override;
  const hub = document.getElementById('home-hub');
  // The collection is /11-11 (older links: /?sale=11.11); after the campaign it sends visitors home.
  const collection = /^\/11-11\/?$/.test(location.pathname) || (/^\/(?:index\.html)?$/.test(location.pathname) && new URLSearchParams(location.search).get('sale') === '11.11');
  const eligible = Boolean(hub) && (collection || /^\/(?:index\.html)?$/.test(location.pathname) || document.documentElement.classList.contains('listing-view'));
  const startedByDate = dateActive();
  fetch('/api/index.php?action=campaign', { credentials: 'omit' }).then(r => r.ok ? r.json() : null).catch(() => null).then(d => {
    // Auto mode (active: null) keeps the date rule; only an explicit on/off from the admin overrides it.
    const c = d?.eleven?.mode !== 'auto' && typeof d?.eleven?.active === 'boolean' ? d.eleven : null;
    if (!c) { if (collection && !startedByDate) location.replace('/'); return; }
    override = c.active; until = c.until || '';
    if (c.active && !startedByDate && eligible) boot();
    else if (!c.active && collection && !startedByDate) location.replace('/');
    else rerender?.();
  });
  if (startedByDate && eligible) boot();
  function boot() {
  if (collection && location.pathname !== '/11-11') history.replaceState(null, '', '/11-11');
  const hero = hub.querySelector('.hero-banner');
  const originalHero = hero?.innerHTML;
  if (hero) {
    hero.classList.add('eleven-hero');
    hero.innerHTML = '<a class="eleven-hero-link" href="/11-11" aria-label="11.11-ийн хямдралтай бүх барааг үзэх"><div class="eleven-hero-copy"><span class="eleven-hero-label">GOSTORE · 11.11</span><h1>Хүссэнээ<br>хямдралтай.</h1><p>Бодит хямдралтай барааны<br>сонголтоо нээгээрэй.</p><span class="eleven-hero-cta">Хямдралуудыг үзэх <span aria-hidden="true">↗</span></span></div><div class="eleven-hero-art" aria-hidden="true"><strong>11.11</strong><span class="eleven-hero-orbit"></span><img class="eleven-hero-headphones" src="/assets/hero-headphones.webp?v=5a89ac5775" width="330" height="220" alt="" fetchpriority="high"><img class="eleven-hero-bag" src="/assets/hero-bag.webp?v=1d3094dc10" width="300" height="450" alt=""><span class="eleven-hero-ticket">БОДИТ<br><b>−%</b> ХЯМДРАЛ</span></div></a>';
  }
  if (collection) {
    document.documentElement.classList.add('eleven-sale-view');
    document.title = '11.11 — Хямдралын сонголт · GOStore';
  }
  // index.html already holds an empty #eleven-sale right after the hub, sized by CSS while the
  // campaign is active, so filling it later does not push the catalog down (layout shift).
  const section = document.getElementById('eleven-sale') || document.createElement('section');
  section.id = 'eleven-sale';
  section.className = 'eleven-sale page-width';
  section.setAttribute('aria-labelledby', 'eleven-sale-title');
  const heading = collection ? 'h1' : 'h2';
  section.innerHTML = (collection ? '<a class="eleven-sale-back" href="/">← Нүүр хуудас</a>' : '') + '<div class="eleven-sale-heading"><span class="eleven-sale-mark" aria-hidden="true">11.11</span><div><p class="eleven-sale-eyebrow">11.11-ИЙН СОНГОЛТ</p><' + heading + ' id="eleven-sale-title">Хямдралтай бараа</' + heading + '><p>Таалагдсан барааныхаа саналыг шалгаарай.</p></div>' + (collection ? '' : '<a class="eleven-sale-link" href="/11-11">Бүх сонголтыг үзэх →</a>') + '</div><p class="eleven-sale-note">Сүүлийн 24 цагт шалгагдсан, бодит үнэ нь буурсан бараа. Эцсийн үнэ, хүргэлтийг захиалах үед шалгана.</p><div id="eleven-sale-products" aria-busy="true"></div><p class="eleven-sale-status" role="status">Хямдралын мэдээлэл ачаалж байна…</p><button type="button" class="eleven-sale-retry" hidden>Дараагийн бараанууд</button>';
  if (!section.isConnected) hub.after(section);
  const target = section.querySelector('#eleven-sale-products');
  const status = section.querySelector('.eleven-sale-status');
  const next = section.querySelector('button');
  const cacheKey = 'gostore-eleven-offers-v5';
  let busy = false, page = 1, rows = [], more = false, stale = false, expiryTimer;
  const valid = product => {
    if (!product || !/^tb-\d{5,20}$/.test(product.id) || product.sellable === false || window.productPolicyBlocked?.(product)) return false;
    const now = Date.now() / 1000, amount = product.mnt || product.approx_mnt;
    const discount = product.card_discount;
    // Only a real price cut for the shown price qualifies; coupons and conditional promotions do not.
    return amount > 0 && discount?.expires > now && discount.current_mnt === amount && discount.was_mnt > amount;
  };
  function render() {
    clearTimeout(expiryTimer);
    if (!active()) {
      document.documentElement.classList.remove('eleven-active');
      if (hero) { hero.classList.remove('eleven-hero'); hero.innerHTML = originalHero; }
      if (collection) {
        section.innerHTML = '<h1>11.11-ийн сонголт дууссан</h1><a class="eleven-sale-link" href="/">Дэлгүүр рүү очих →</a>';
      } else section.remove();
      return;
    }
    section.classList.add('eleven-loaded');
    const seen = new Set();
    const all = rows.filter(product => valid(product) && !seen.has(product.id) && seen.add(product.id));
    const items = collection ? all : all.slice(0, 12);
    target.setAttribute('aria-busy', 'false');
    target.innerHTML = items.length ? '<div class="eleven-sale-grid">' + items.map(product => '<a class="eleven-sale-card" href="/v/' + encodeURIComponent(product.id) + '">' + supplierDiscountBadge(product, product.mnt || product.approx_mnt) + (product.image ? '<img src="' + esc(product.image) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '<div class="eleven-sale-placeholder" aria-hidden="true">GOStore</div>') + '<div class="eleven-sale-card-body"><h3>' + esc(product.name) + '</h3><strong>' + (product.mnt ? '' : '≈ ') + money(product.mnt || product.approx_mnt) + '</strong>' + supplierPromotionHtml(product, product.mnt || product.approx_mnt) + '<small class="eleven-sale-details">Үнэ, нөхцөл харах →</small></div></a>').join('') + '</div>' : '<p class="eleven-sale-empty">Одоогоор хүчинтэй хямдралын мэдээлэл олдсонгүй. <a href="/products">Бүх барааг үзэх →</a></p>';
    status.textContent = collection && items.length ? items.length + ' бараа харагдаж байна' : '';
    if (stale && !items.length) target.innerHTML = '<p class="eleven-sale-empty">Хямдралын шинэ мэдээлэл түр хязгаарлагдсан байна. Дараа дахин ачаална уу.</p>';
    next.hidden = !collection || !more;
    next.textContent = 'Дараагийн бараанууд';
    const end = override === true && /^\d{4}-\d{2}-\d{2}$/.test(until) ? Date.parse(until + 'T23:59:59+08:00') + 1000 : Date.parse(new Date().getFullYear() + '-11-12T00:00:00+08:00');
    const expires = items.flatMap(product => [product.card_discount?.expires, product.offers?.expires]).filter(time => time * 1000 > Date.now()).map(time => time * 1000);
    expiryTimer = setTimeout(render, Math.max(100, Math.min(end, Date.now() + 86400000, ...expires) - Date.now() + 50));
  }
  async function load() {
    if (busy) return;
    busy = true;
    next.disabled = true;
    target.setAttribute('aria-busy', 'true');
    status.textContent = 'Хямдралын мэдээлэл ачаалж байна…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('/api/index.php?action=supplier-deals&page=' + page, { credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw Error('Unavailable');
      const data = await response.json();
      if (!Array.isArray(data.products)) throw Error('Invalid offers');
      if (page === 1) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), products: data.products, more: data.more === true, stale: data.stale === true })); } catch {}
      }
      rows.push(...data.products);
      more = data.more === true;
      stale = data.stale === true;
      page++;
      render();
    } catch {
      section.classList.add('eleven-loaded');
      target.setAttribute('aria-busy', 'false');
      status.textContent = 'Хямдралын мэдээлэл түр боломжгүй байна.';
      next.hidden = false;
      next.textContent = 'Дахин ачаалах';
    } finally { clearTimeout(timeout); busy = false; next.disabled = false; }
  }
  next.onclick = load;
  rerender = () => { if (section.classList.contains('eleven-loaded') || !active()) render(); };
  function start() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey));
      if (cached && Date.now() - cached.at >= 0 && Date.now() - cached.at < 60000 && Array.isArray(cached.products)) {
        rows = cached.products; more = cached.more === true; stale = cached.stale === true; page = 2; render(); return;
      }
    } catch {}
    void load();
  }
  if (collection || typeof IntersectionObserver !== 'function') start();
  else {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: '400px' });
    observer.observe(section);
  }
  }
})();
