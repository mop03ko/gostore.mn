'use strict';
// Product comparison (up to four Taobao items) and header search suggestions.
window.productCompare=(()=>{
  const KEY='gostore-compare-v1',MAX=4;
  const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(p=>p&&/^(?:tb|abb)-[0-9]{5,20}$/.test(p.id)&&!window.productPolicyBlocked(p)).slice(0,MAX):[];}catch{return [];}};
  const write=items=>{try{localStorage.setItem(KEY,JSON.stringify(items));}catch{toast('Хөтөч харьцуулах жагсаалт хадгалах боломжгүй байна.');return false;}sync();return true;};
  const has=id=>read().some(p=>p.id===id);
  function sync(){
    const items=read(),button=document.querySelector('[data-compare-open]');
    if(button){button.hidden=!items.length;button.querySelector('.count').textContent=items.length;}
    document.querySelectorAll('[data-compare-toggle]').forEach(b=>{const on=items.some(p=>p.id===b.dataset.compareToggle);b.setAttribute('aria-pressed',String(on));b.classList.toggle('saved',on);if(b.dataset.labelOn)b.lastChild.textContent=on?b.dataset.labelOn:b.dataset.labelOff;});
  }
  function toggle(b){
    const id=b.dataset.compareToggle,items=read();
    if(items.some(p=>p.id===id)){write(items.filter(p=>p.id!==id));toast('Харьцуулахаас хаслаа');return;}
    if(items.length>=MAX){toast('Нэг удаад '+MAX+' хүртэл бараа харьцуулна.');return;}
    if(write([...items,{id,name:(b.dataset.name||'').slice(0,300),image:/^https:\/\//i.test(b.dataset.image||'')?b.dataset.image:''}]))toast(items.length?'Харьцуулахад нэмлээ · '+(items.length+1)+' бараа':'Харьцуулахад нэмлээ');
  }
  const minCny=p=>{const prices=(p.variants||[]).filter(v=>v.cny>0&&v.stock!==0).map(v=>v.cny);return prices.length?Math.min(...prices):p.cny;};
  async function show(){
    const items=read();
    if(!items.length){openModal('Бараа харьцуулах','<div class="empty-state"><h3>Харьцуулах бараа алга</h3><p>Барааны карт эсвэл дэлгэрэнгүй хуудаснаас «Харьцуулах» товчийг дарна уу.</p></div>');return;}
    openModal('Бараа харьцуулах','<p class="modal-intro">Мэдээлэл ачаалж байна…</p>');
    const loaded=await Promise.all(items.map(p=>supplierApi('supplier-product',{id:p.id}).then(d=>({...d.product,rate:d.shipping?.cny_rate})).catch(()=>({...p,failed:true}))));
    // Attribute rows: the names most products share come first.
    const counts=new Map();for(const p of loaded)for(const name of new Set((p.attributes||[]).map(a=>a.name)))counts.set(name,(counts.get(name)||0)+1);
    const names=[...counts].filter(([,n])=>n>1||loaded.length===1).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([name])=>name);
    const value=(p,name)=>[...new Set((p.attributes||[]).filter(a=>a.name===name).map(a=>a.value))].slice(0,4).join(', ')||'—';
    const price=p=>{const cny=minCny(p);return cny>0&&p.rate?money(Math.ceil(cny*p.rate)):p.mnt>0?money(p.mnt):p.approx_mnt>0?'≈ '+money(p.approx_mnt):'Үнэ шалгах';};
    const rows=[
      ['Үнэ',p=>`<strong>${price(p)}</strong>`],
      ['Зарагдсан',p=>p.sold_count?esc(new Intl.NumberFormat('en-US').format(p.sold_count)):'—'],
      ['Дэлгүүр',p=>esc(p.vendor_name||'—')],
      ['Брэнд',p=>esc(p.brand||'—')],
      ['Байршил',p=>esc((p.location||[]).join(', ')||'—')],
      ['Хувилбар',p=>p.variants?String(p.variants.length):'—'],
      ['Жин',p=>p.weight_kg?esc(p.weight_kg)+' кг':'—'],
      ...names.map(name=>[name,p=>esc(value(p,name))])
    ];
    const head=loaded.map(p=>`<th scope="col"><a href="/v/${esc(p.id.replace(/^abb-/,''))}">${/^https:\/\//i.test(p.image||'')?`<img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">`:''}<span>${esc(p.name)}</span></a><button type="button" class="text-button" data-compare-remove="${esc(p.id)}">Хасах ×</button></th>`).join('');
    openModal('Бараа харьцуулах',`<div class="compare-scroll"><table class="compare-table"><thead><tr><th scope="col"><span class="sr-only">Үзүүлэлт</span></th>${head}</tr></thead><tbody>${rows.map(([label,cell])=>`<tr><th scope="row">${esc(label)}</th>${loaded.map(p=>`<td>${p.failed?'—':cell(p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="form-actions"><button type="button" class="button outline" data-compare-clear>Жагсаалт цэвэрлэх</button></div>`);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-compare-toggle],[data-compare-open],[data-compare-remove],[data-compare-clear]');if(!b)return;
    e.preventDefault();
    if(b.dataset.compareToggle)toggle(b);
    else if(b.hasAttribute('data-compare-open'))show();
    else if(b.dataset.compareRemove){write(read().filter(p=>p.id!==b.dataset.compareRemove));show();}
    else{write([]);show();}
  });
  window.addEventListener('storage',e=>{if(e.key===KEY)sync();});
  new MutationObserver(()=>{if(document.querySelector('[data-compare-toggle]:not([aria-pressed])'))sync();}).observe(document.body,{childList:true,subtree:true});
  sync();
  return {sync,has,count:()=>read().length};
})();

// Header search: recent searches and matching categories, keyboard accessible.
(()=>{
  const form=document.querySelector('#search-form'),input=document.querySelector('#search');if(!form||!input)return;
  const KEY='gostore-recent-searches-v1',list=document.createElement('div');
  list.id='search-suggest';list.className='search-suggest';list.setAttribute('role','listbox');list.setAttribute('aria-label','Хайлтын санал');list.hidden=true;form.append(list);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls','search-suggest');input.setAttribute('aria-expanded','false');
  const recent=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(s=>typeof s==='string'&&s.length<=100&&!window.productPolicyBlocked(s)).slice(0,6):[];}catch{return [];}};
  const remember=q=>{q=q.trim();if(!q||/^https?:/i.test(q))return;try{localStorage.setItem(KEY,JSON.stringify([q,...recent().filter(s=>s.toLocaleLowerCase('mn')!==q.toLocaleLowerCase('mn'))].slice(0,6)));}catch{}};
  let options=[],active=-1;
  function build(){
    const q=input.value.trim().toLocaleLowerCase('mn');options=[];
    if(q){
      options.push({type:'search',label:`«${input.value.trim()}» гэж хайх`,query:input.value.trim()});
      for(const c of typeof categories!=='undefined'?categories:[]){
        if([c.name,c.query].join(' ').toLocaleLowerCase('mn').includes(q))options.push({type:'category',label:c.name,hint:'Ангилал',id:c.id,query:c.query});
        for(const child of c.children||[])if([child.name,child.query].join(' ').toLocaleLowerCase('mn').includes(q))options.push({type:'query',label:child.name,hint:c.name,id:c.id,query:child.query});
      }
      options=options.slice(0,8);
    }else options=recent().map(s=>({type:'search',label:s,hint:'Сүүлд хайсан',query:s,recent:true}));
    active=-1;render();
  }
  function render(){
    list.hidden=!options.length;input.setAttribute('aria-expanded',String(!list.hidden));input.removeAttribute('aria-activedescendant');
    list.innerHTML=(options.length&&options[0].recent?'<div class="search-suggest-head"><span>Сүүлд хайсан</span><button type="button" data-suggest-clear>Цэвэрлэх</button></div>':'')+options.map((o,i)=>`<div class="search-suggest-item${i===active?' active':''}" role="option" id="suggest-${i}" data-suggest="${i}" aria-selected="${i===active}"><span>${esc(o.label)}</span>${o.hint&&!o.recent?`<small>${esc(o.hint)}</small>`:''}</div>`).join('');
    if(active>=0)input.setAttribute('aria-activedescendant','suggest-'+active);
  }
  function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function choose(o){
    close();input.value=o.type==='search'?o.query:'';remember(o.type==='search'?o.query:o.label);
    const productView=document.documentElement.classList.contains('product-view');
    if(o.type==='search'){if(productView){location.assign('/?q='+encodeURIComponent(o.query)+'#supplier-catalog');return;}form.requestSubmit();return;}
    if(productView){location.assign(o.type==='category'?'/?category='+encodeURIComponent(o.id)+'#supplier-catalog':'/?q='+encodeURIComponent(o.query)+'#supplier-catalog');return;}
    if(o.type==='category'&&typeof filterCategory==='function'){filterCategory(o.id);return;}
    window.supplierBrowse?.(o.query,false,o.id);if(typeof scrollCatalog==='function')scrollCatalog();
  }
  input.addEventListener('focus',build);input.addEventListener('input',build);
  input.addEventListener('keydown',e=>{
    if(list.hidden&&e.key==='ArrowDown'){build();return;}
    if(list.hidden)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+options.length+1)%(options.length+1);if(active===options.length)active=-1;render();}
    else if(e.key==='Enter'&&active>=0){e.preventDefault();choose(options[active]);}
    else if(e.key==='Escape'){e.preventDefault();close();}
  });
  list.addEventListener('mousedown',e=>e.preventDefault());
  list.addEventListener('click',e=>{if(e.target.closest('[data-suggest-clear]')){try{localStorage.removeItem(KEY);}catch{}build();input.focus();return;}const item=e.target.closest('[data-suggest]');if(item)choose(options[Number(item.dataset.suggest)]);});
  input.addEventListener('blur',()=>setTimeout(close,120));
  form.addEventListener('submit',()=>{remember(input.value);close();},true);
})();

// Warm product details when a shopper is about to open a product (hover, touch, keyboard focus),
// so the slow first supplier lookup happens before the click. Bounded to protect the API quota.
(()=>{
  const seen=new Set(),MAX=4;let timer=null,active=false;
  const idOf=a=>{const m=(a.getAttribute('href')||'').match(/^\/v\/((?:tb-)?\d{5,20})\/?$/);return m?(m[1].startsWith('tb-')?m[1]:'abb-'+m[1]):null;};
  const warm=a=>{const id=idOf(a),connection=navigator.connection;if(active||document.hidden||connection?.saveData||/^(slow-2g|2g|3g)$/.test(connection?.effectiveType||'')||!id||seen.has(id)||seen.size>=MAX||!window.supplierApi)return;seen.add(id);active=true;supplierApi('supplier-product',{id}).catch(()=>{}).finally(()=>active=false);};
  document.addEventListener('pointerover',e=>{const a=e.target.closest?.('a[href^="/v/"]');if(!a||e.pointerType==='touch')return;clearTimeout(timer);timer=setTimeout(()=>warm(a),350);},{passive:true});
  document.addEventListener('pointerout',e=>{if(e.target.closest?.('a[href^="/v/"]'))clearTimeout(timer);},{passive:true});
  document.addEventListener('touchstart',e=>{const a=e.target.closest?.('a[href^="/v/"]');if(a)warm(a);},{passive:true});
  document.addEventListener('focusin',e=>{const a=e.target.closest?.('a[href^="/v/"]');if(a)warm(a);});
})();
