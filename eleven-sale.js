'use strict';
(() => {
  const active = () => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return parts.find(part => part.type === 'month').value === '11' && Number(parts.find(part => part.type === 'day').value) <= 11;
  };
  const hub = document.getElementById('home-hub');
  if (!hub || !/^\/(?:index\.html)?$/.test(location.pathname) || !active()) return;
  const collection = new URLSearchParams(location.search).get('sale') === '11.11';
  const hero = hub.querySelector('.hero-banner');
  const originalHero = hero?.innerHTML;
  if (hero) {
    hero.classList.add('eleven-hero');
    hero.innerHTML = '<a class="eleven-hero-link" href="/?sale=11.11" aria-label="11.11-ийн хямдрал, купоны бүх сонголтыг үзэх"><div class="eleven-hero-copy"><span class="eleven-hero-label">GOSTORE · 11.11</span><h1>Хүссэнээ<br>хямдралтай.</h1><p>Хямдрал, купонтой барааны<br>сонголтоо нээгээрэй.</p><span class="eleven-hero-cta">Хямдралуудыг үзэх <span aria-hidden="true">↗</span></span></div><div class="eleven-hero-art" aria-hidden="true"><strong>11.11</strong><span class="eleven-hero-orbit"></span><img class="eleven-hero-headphones" src="/assets/hero-headphones.webp?v=5a89ac5775" width="330" height="220" alt="" fetchpriority="high"><img class="eleven-hero-bag" src="/assets/hero-bag.webp?v=1d3094dc10" width="300" height="450" alt=""><span class="eleven-hero-ticket">КУПОН<br><b>+</b> ХЯМДРАЛ</span></div></a>';
  }
  if (collection) {
    document.documentElement.classList.add('eleven-sale-view');
    document.title = '11.11 — Хямдрал, купоны сонголт · GOStore';
  }
  // index.html already holds an empty #eleven-sale right after the hub, sized by CSS while the
  // campaign is active, so filling it later does not push the catalog down (layout shift).
  const section = document.getElementById('eleven-sale') || document.createElement('section');
  section.id = 'eleven-sale';
  section.className = 'eleven-sale page-width';
  section.setAttribute('aria-labelledby', 'eleven-sale-title');
  const heading = collection ? 'h1' : 'h2';
  section.innerHTML = (collection ? '<a class="eleven-sale-back" href="/">← Нүүр хуудас</a>' : '') + '<div class="eleven-sale-heading"><span class="eleven-sale-mark" aria-hidden="true">11.11</span><div><p class="eleven-sale-eyebrow">11.11-ИЙН СОНГОЛТ</p><' + heading + ' id="eleven-sale-title">Хямдрал, купонтой бараа</' + heading + '><p>Таалагдсан барааныхаа саналыг шалгаарай.</p></div>' + (collection ? '' : '<a class="eleven-sale-link" href="/?sale=11.11">Бүх сонголтыг үзэх →</a>') + '</div><p class="eleven-sale-note">Нийлүүлэгчээс ирсэн хүчинтэй хямдрал, купоны сонголт. Купон, урамшуулал нь нөхцөлтэй. Эцсийн үнэ, хүргэлтийг захиалах үед шалгана.</p><div id="eleven-sale-products" aria-busy="true"></div><p class="eleven-sale-status" role="status">Хямдралын мэдээлэл ачаалж байна…</p><button type="button" class="eleven-sale-retry" hidden>Дараагийн бараанууд</button>';
  if (!section.isConnected) hub.after(section);
  const target = section.querySelector('#eleven-sale-products');
  const status = section.querySelector('.eleven-sale-status');
  const next = section.querySelector('button');
  const cacheKey = 'gostore-eleven-offers-v4';
  let busy = false, page = 1, rows = [], more = false, stale = false, expiryTimer;
  const valid = product => {
    if (!product || !/^tb-\d{5,20}$/.test(product.id) || product.sellable === false || window.productPolicyBlocked?.(product)) return false;
    const now = Date.now() / 1000, amount = product.mnt || product.approx_mnt;
    const discount = product.card_discount, offers = product.offers;
    return amount > 0 && ((discount?.expires > now && discount.current_mnt === amount && discount.was_mnt > amount) || (offers?.expires > now && (offers.coupon_mnt > 0 && offers.coupon_mnt < amount || offers.promotions?.some(promotion => promotion.name))));
  };
  function render() {
    clearTimeout(expiryTimer);
    if (!active()) {
      if (hero) { hero.classList.remove('eleven-hero'); hero.innerHTML = originalHero; }
      if (collection) {
        section.innerHTML = '<h1>11.11-ийн сонголт дууссан</h1><a class="eleven-sale-link" href="/">Дэлгүүр рүү очих →</a>';
      } else section.remove();
      return;
    }
    section.classList.add('eleven-loaded');
    const seen = new Set();
    const all = rows.filter(product => valid(product) && !seen.has(product.id) && seen.add(product.id));
    const items = collection ? all : all.slice(0, 8);
    target.setAttribute('aria-busy', 'false');
    target.innerHTML = items.length ? '<div class="eleven-sale-grid">' + items.map(product => '<a class="eleven-sale-card" href="/v/' + encodeURIComponent(product.id) + '">' + supplierDiscountBadge(product, product.mnt || product.approx_mnt) + (product.image ? '<img src="' + esc(product.image) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '<div class="eleven-sale-placeholder" aria-hidden="true">GOStore</div>') + '<div class="eleven-sale-card-body"><h3>' + esc(product.name) + '</h3><strong>' + (product.mnt ? '' : '≈ ') + money(product.mnt || product.approx_mnt) + '</strong>' + supplierPromotionHtml(product, product.mnt || product.approx_mnt) + '<small class="eleven-sale-details">Үнэ, нөхцөл харах →</small></div></a>').join('') + '</div>' : '<p class="eleven-sale-empty">Одоогоор хүчинтэй хямдралын мэдээлэл олдсонгүй. <a href="/#supplier-catalog">Бүх барааг үзэх →</a></p>';
    status.textContent = collection && items.length ? items.length + ' бараа харагдаж байна' : '';
    if (stale && !items.length) target.innerHTML = '<p class="eleven-sale-empty">Хямдралын шинэ мэдээлэл түр хязгаарлагдсан байна. Дараа дахин ачаална уу.</p>';
    next.hidden = !collection || !more;
    next.textContent = 'Дараагийн бараанууд';
    const end = Date.parse(new Date().getFullYear() + '-11-12T00:00:00+08:00');
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
  function start() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey));
      if (cached && Date.now() - cached.at >= 0 && Date.now() - cached.at < 60000 && Array.isArray(cached.products)) {
        rows = cached.products; more = cached.more === true; stale = cached.stale === true; page = 2; render(); return;
      }
    } catch {}
    void load();
  }
  if (collection || !('IntersectionObserver' in window)) start();
  else {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: '400px' });
    observer.observe(section);
  }
})();
