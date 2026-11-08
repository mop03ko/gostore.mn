'use strict';
// Promotional popup on the home page (set on the admin «Мэдэгдэл илгээх» page). Each popup appears at
// most once a day on this browser, after the page has loaded, and never over another dialog or page.
(()=>{
  if(location.pathname!=='/'||location.search)return;
  const key='gostore-promo-seen-v1',d=new Date(),today=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  const seen=()=>{try{return localStorage.getItem(key);}catch{return null;}};
  const remember=id=>{try{localStorage.setItem(key,id+':'+today);}catch{}};
  async function show(){
    let popup=null;
    try{const r=await fetch('/api/index.php?action=promo-popup',{credentials:'omit'});if(r.ok)popup=(await r.json()).popup;}catch{return;}
    if(!popup||seen()===popup.id+':'+today)return;
    // Only on the home page as first shown, and not over a dialog or the sign-in page.
    if(location.pathname!=='/'||location.search||document.querySelector('dialog[open]')||document.documentElement.classList.contains('auth-view-open'))return;
    const external=/^https:\/\//.test(popup.link),link=popup.link&&(external||/^\/(?!\/)/.test(popup.link))?popup.link:'';
    const dialog=document.createElement('dialog');dialog.className='promo-popup';
    dialog.setAttribute(popup.title?'aria-labelledby':'aria-label',popup.title?'promo-popup-title':'Урамшуулал');
    const close=document.createElement('button');close.type='button';close.className='promo-popup-close';close.setAttribute('aria-label','Хаах');close.textContent='×';
    const anchor=()=>{const a=document.createElement('a');a.href=link;if(external){a.target='_blank';a.rel='noopener';}a.addEventListener('click',()=>dialog.close());return a;};
    if(popup.image){
      const img=document.createElement('img');img.src=popup.image;img.alt=popup.title||'Урамшуулал';img.decoding='async';
      const media=link?anchor():document.createElement('div');media.className='promo-popup-media';media.append(img);dialog.append(media);
    }
    const copy=document.createElement('div');copy.className='promo-popup-copy';
    if(popup.title){const h=document.createElement('h2');h.id='promo-popup-title';h.textContent=popup.title;copy.append(h);}
    if(popup.text){const p=document.createElement('p');p.textContent=popup.text;copy.append(p);}
    if(link){const a=anchor();a.className='button yellow';a.textContent=popup.button||'Дэлгэрэнгүй';copy.append(a);}
    if(copy.childElementCount)dialog.append(copy);
    dialog.prepend(close);
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    dialog.addEventListener('close',()=>{dialog.remove();document.body.classList.remove('modal-open');});
    document.body.append(dialog);remember(popup.id);dialog.showModal();document.body.classList.add('modal-open');close.focus({preventScroll:true});
  }
  const start=()=>setTimeout(show,1200);
  if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});
})();
