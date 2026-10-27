'use strict';
// Keeps a signed-in shopper's cart and saved products in step across devices.
// Each list is merged against the snapshot of the last sync: a side that did not change takes
// the other side's list, and edits on both sides are unioned (this device first). Checkout
// still re-prices every line on the server, so stored prices are display hints only.
(()=>{
  const CART=window.taobaoCart?.key||'gostore-taobao-cart-v1',FAV='gostore-taobao-favorites-v1',MARK='gostore-state-sync-v1';
  const LIMIT={[CART]:30,[FAV]:100},KEY={[CART]:i=>i.id+'|'+i.sku,[FAV]:p=>p.id};
  const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[];}catch{return [];}};
  const hash=v=>{const s=JSON.stringify(v);let h=5381;for(let i=0;i<s.length;i++)h=(Math.imul(h,33)^s.charCodeAt(i))>>>0;return h.toString(36)+':'+s.length;};
  const mark=()=>{try{return JSON.parse(localStorage.getItem(MARK)||'null');}catch{return null;}};
  const setMark=m=>{try{m?localStorage.setItem(MARK,JSON.stringify(m)):localStorage.removeItem(MARK);}catch{}};
  const union=(k,a,b)=>{const seen=new Set();return [...a,...b].filter(x=>{const id=KEY[k](x);if(seen.has(id))return false;seen.add(id);return true;}).slice(0,LIMIT[k]);};
  // The request body is capped at 64 KB, so saved cards travel with only the fields a card needs.
  const card=p=>({id:p.id,provider:p.provider,provider_label:p.provider_label,name:String(p.name||'').slice(0,160),image:p.image,url:p.url,cny:p.cny,mnt:p.mnt,approx_cny:p.approx_cny,approx_mnt:p.approx_mnt,min_qty:p.min_qty,step:p.step,sellable:p.sellable,sold_count:p.sold_count,sales_30_days:p.sales_30_days,price_status:p.price_status,variants:[]});
  const outgoing=(k,items)=>k===FAV?items.map(card):items;
  let user=window.customerAccount?.user||null,timer=null,syncing=null,lastSync=0,loggingOut=false;

  function apply(k,items){
    try{localStorage.setItem(k,JSON.stringify(items));}catch{return;}
    // Reuse the existing listeners that refresh counts, cards and the cart page.
    window.dispatchEvent(new StorageEvent('storage',{key:k}));
    if(k===CART)window.dispatchEvent(new Event('gostore-cart-changed'));
    window.updateCounts?.();
  }
  async function push(lists){
    const body={},sent={};for(const k of lists){const items=read(k);sent[k]=hash(items);body[k===CART?'cart':'favorites']=outgoing(k,items);}
    const r=await shopApi('customer-state-save',body);
    // Mark what was sent, not what is stored now: edits made while the request was in flight
    // must still differ from the mark so the next debounce pushes them.
    const m=mark();if(m&&m.customer===user?.id){m.version=r.version;Object.assign(m,sent);setMark(m);}
    if(lists.some(k=>hash(read(k))!==sent[k]))changedLocally();
  }
  async function sync(){
    if(!user||syncing)return syncing;
    const id=user.id;
    syncing=(async()=>{
      try{
        const server=await shopApi('customer-state');if(user?.id!==id)return;
        const m=mark(),fresh=!m||m.customer!==id,remoteChanged=fresh||m.version!==server.version,changed=[];
        for(const [k,remote] of [[CART,server.cart||[]],[FAV,server.favorites||[]]]){
          const local=read(k),localChanged=fresh||hash(local)!==m[k];
          if(!localChanged&&!remoteChanged)continue;
          if(!localChanged){apply(k,remote);continue;}
          const merged=remoteChanged?union(k,local,remote):local;
          if(hash(merged)!==hash(local))apply(k,merged);
          if(hash(outgoing(k,merged))!==hash(remote))changed.push(k);
        }
        setMark({customer:id,version:server.version,[CART]:hash(read(CART)),[FAV]:hash(read(FAV))});
        if(changed.length)await push(changed);
        lastSync=Date.now();renderPending(server.pending||[]);
      }catch{}finally{syncing=null;}
    })();
    return syncing;
  }
  function changedLocally(){
    if(!user)return;clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;const m=mark();if(!m||m.customer!==user?.id)return sync();const lists=[CART,FAV].filter(k=>hash(read(k))!==m[k]);if(lists.length)push(lists).catch(()=>{});},800);
  }
  function flush(){if(!timer)return;clearTimeout(timer);timer=null;const m=mark();if(!m||m.customer!==user?.id)return;const lists=[CART,FAV].filter(k=>hash(read(k))!==m[k]);if(lists.length)push(lists).catch(()=>{});}

  // Unpaid checkouts get a reminder until they are paid, expire or are dismissed for this tab.
  function renderPending(pending){
    document.querySelector('.pending-pay')?.remove();
    let dismissed=[];try{dismissed=JSON.parse(sessionStorage.getItem('gostore-pending-dismissed')||'[]');}catch{}
    const o=pending.find(x=>!dismissed.includes(x.id));
    if(!o||document.documentElement.matches('.product-view'))return;
    const due=new Date(o.payment_due),time=due.toLocaleString('mn-MN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    const bar=document.createElement('aside');bar.className='pending-pay';bar.setAttribute('aria-label','Төлбөр хүлээж буй захиалга');
    bar.innerHTML=`<p><strong>Төлбөр хүлээж байна</strong><span>${esc(o.id)} · ${money(o.amount)} · ${esc(time)} хүртэл</span></p><button type="button" class="button blue" data-server-order="${esc(o.id)}">Төлөх</button><button type="button" class="icon-button" data-pending-dismiss="${esc(o.id)}" aria-label="Сануулга хаах">×</button>`;
    document.body.append(bar);
  }
  document.addEventListener('click',e=>{
    const dismiss=e.target.closest('[data-pending-dismiss]');
    if(dismiss){try{const list=JSON.parse(sessionStorage.getItem('gostore-pending-dismissed')||'[]');list.push(dismiss.dataset.pendingDismiss);sessionStorage.setItem('gostore-pending-dismissed',JSON.stringify(list.slice(-20)));}catch{}dismiss.closest('.pending-pay').remove();return;}
    if(e.target.closest('.pending-pay [data-server-order]'))e.target.closest('.pending-pay').remove();
    // Send unsaved edits before the logout request ends the session.
    if(e.target.closest('[data-customer-logout]')){loggingOut=true;flush();setTimeout(()=>{loggingOut=false;},10000);}
  },true);

  const setUser=window.customerAccount.setUser;
  window.customerAccount.setUser=next=>{
    const previous=user;user=next||null;setUser(next);
    if(user&&user.id!==previous?.id){sync();return;}
    if(!user&&previous){
      document.querySelector('.pending-pay')?.remove();
      const m=mark();
      // After an explicit logout, synced lists stay in the account instead of on a shared device.
      if(loggingOut&&m?.customer===previous.id&&hash(read(CART))===m[CART]&&hash(read(FAV))===m[FAV]){apply(CART,[]);apply(FAV,[]);}
      setMark(null);loggingOut=false;
    }
  };
  window.addEventListener('gostore-cart-changed',changedLocally);
  window.addEventListener('gostore-favorites-changed',changedLocally);
  window.addEventListener('storage',e=>{if(e.key===MARK||e.key===null)return;if(e.key===CART||e.key===FAV)changedLocally();});
  // Pick up edits from other devices when the shopper comes back to this tab.
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user&&Date.now()-lastSync>60000)sync();});
  if(user)sync();
})();
