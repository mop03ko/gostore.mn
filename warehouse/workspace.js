'use strict';
// Shared warehouse workbench. Shortcuts call the existing, permission-checked flows.
(()=>{
 const app=document.getElementById('app'),main=app?.querySelector('main');if(!main)return;
 const scan=main.querySelector(':scope > .scan-panel'),pack=document.getElementById('create-batch');
 const originalPack=document.createComment('Packing action original position');pack.before(originalPack);
 const work=document.createElement('section');work.className='erenhot-workbench';work.hidden=true;
 work.setAttribute('aria-labelledby','erenhot-workbench-title');
 work.innerHTML='<div class="workspace-heading"><div><span class="eyebrow">今日工作</span><h2 id="erenhot-workbench-title">收货 → 装包 → 发货</h2></div><small>装包后，实际发车时再确认出库</small></div><div class="erenhot-actions"><button type="button" class="quiet" data-workspace-action="receive"><span class="workspace-step">01</span><span><strong>收货登记</strong><small>订单 / 快递单号</small></span></button><button type="button" class="quiet" data-workspace-action="dispatch"><span class="workspace-step">03</span><span><strong>确认发货</strong><small>已装包，待实际出库</small></span><b data-workspace-count="packed_batches">0</b></button><button type="button" class="quiet" data-workspace-action="alerts"><span class="workspace-step">!</span><span><strong>到货提醒</strong><small>已签收未登记 / 超时</small></span><b data-workspace-count="alerts">0</b></button></div>';
 main.querySelector('.welcome').after(work);
 const nav=document.createElement('nav');nav.className='warehouse-dock';nav.hidden=true;
 nav.innerHTML='<button type="button" data-workspace-action="home"><span aria-hidden="true">⌂</span><small></small></button><button type="button" data-workspace-action="orders"><span aria-hidden="true">▤</span><small></small></button><button type="button" data-workspace-action="camera"><span aria-hidden="true">▣</span><small></small></button><button type="button" data-workspace-action="batches"><span aria-hidden="true">▦</span><small></small></button>';
 app.append(nav);
 const feedback=document.createElement('div');feedback.className='workspace-list-feedback';
 feedback.innerHTML='<span role="status" data-workspace-status></span><button type="button" class="quiet" data-workspace-action="reset" hidden></button><button type="button" class="quiet" data-workspace-action="retry" hidden></button>';
 document.getElementById('search-form').after(feedback);
 let role='',visible=false,lastSuccess='';
 const text=(mn,zh)=>cityRole()==='erenhot'?zh:mn;
 function syncRole(){
  const next=cityRole(),shown=!app.hidden;if(next===role&&shown===visible)return;
  role=next;visible=shown;document.body.classList.toggle('warehouse-workspace',shown);
  document.body.classList.toggle('erenhot-workspace',shown&&role==='erenhot');
  work.hidden=!shown||role!=='erenhot';nav.hidden=!shown;
  if(!work.hidden){work.querySelector('.erenhot-actions').children[0].after(pack);work.after(scan);}
  else originalPack.after(pack);
  const labels={home:text('Ажил','工作台'),orders:text('Захиалга','订单'),camera:text('Уншуулах','扫码'),batches:text('Багц','包裹')};
  nav.setAttribute('aria-label',text('Агуулахын үндсэн үйлдэл','仓库快捷操作'));
  nav.querySelectorAll('button').forEach(b=>b.querySelector('small').textContent=labels[b.dataset.workspaceAction]);
  feedback.querySelector('[data-workspace-action=reset]').textContent=text('Шүүлтүүр цэвэрлэх','清除筛选');
  feedback.querySelector('[data-workspace-action=retry]').textContent=text('Дахин оролдох','重试');
  if(!shown)lastSuccess='';syncList();connectionState();
 }
 function syncList(){
  const busy=document.getElementById('records').getAttribute('aria-busy')==='true';
  const error=document.getElementById('list-error').textContent.trim();
  const filtered=!!(query||month||status!=='all');
  feedback.querySelector('[data-workspace-action=reset]').hidden=!filtered;
  feedback.querySelector('[data-workspace-action=retry]').hidden=!error;
  feedback.querySelector('[data-workspace-action=retry]').disabled=busy;
  const info=feedback.querySelector('[data-workspace-status]');
  info.textContent=busy?text('Жагсаалтыг шинэчилж байна…','正在更新列表…'):error?text('Жагсаалт шинэчлэгдсэнгүй. Дахин оролдоно уу.','列表未更新，请重试。'):filtered?text('Шүүлтүүр идэвхтэй','已应用筛选')+(month?' · '+month:'')+(query?' · '+query:''):lastSuccess?text('Шинэчилсэн · ','已更新 · ')+lastSuccess:'';
  feedback.classList.toggle('has-error',!!error);
  for(const b of nav.querySelectorAll('button')){
   const active=b.dataset.workspaceAction===tab;
   if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  }
  work.querySelectorAll('[data-workspace-count]').forEach(n=>{const source=document.querySelector('#status-tabs [data-count="'+n.dataset.workspaceCount+'"]');n.textContent=source?.textContent||'0';});
 }
 document.addEventListener('click',event=>{
  const action=event.target.closest('[data-workspace-action]')?.dataset.workspaceAction;if(!action||app.hidden)return;
  if(action==='receive'){scan.scrollIntoView({block:'center'});document.getElementById('scan-code').focus({preventScroll:true});}
  if(action==='camera')document.getElementById('qr-open').click();
  if(action==='home')main.querySelector('.welcome').scrollIntoView({block:'start'});
  if(action==='dispatch')document.querySelector('#status-tabs [data-status="packed"]').click();
  if(action==='alerts')document.querySelector('#status-tabs [data-status="alerts"]').click();
  if(action==='orders'||action==='batches'){
   document.getElementById(action+'-tab').click();document.getElementById('order-list-panel').scrollIntoView({block:'start'});
  }
  if(action==='reset'){
   document.getElementById('search').value='';document.getElementById('month-filter').value='';document.getElementById('status-filter').value='all';
   document.getElementById('search-form').requestSubmit();
  }
  if(action==='retry')document.getElementById('refresh').click();
 });
 const roleObserver=new MutationObserver(syncRole);roleObserver.observe(app,{attributes:true,attributeFilter:['hidden']});roleObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 const listObserver=new MutationObserver(()=>{
  if(document.getElementById('records').getAttribute('aria-busy')==='false'&&!document.getElementById('list-error').textContent.trim())lastSuccess=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  syncList();
 });
 listObserver.observe(document.getElementById('records'),{attributes:true,attributeFilter:['aria-busy']});
 listObserver.observe(document.getElementById('status-tabs'),{subtree:true,childList:true,characterData:true});
 // Network loss is informational only; no automatic replay of receipt or dispatch requests.
 const connection=document.createElement('p');connection.className='workspace-offline';connection.setAttribute('role','status');main.prepend(connection);
 function connectionState(){connection.hidden=navigator.onLine;connection.textContent=text('Интернэт холболт тасарсан. Холболт сэргэсний дараа жагсаалтаа шинэчилж, барааны төлөвийг шалгана уу.','网络已断开。恢复连接后，请刷新列表并核对订单状态。');}
 window.addEventListener('offline',connectionState);window.addEventListener('online',connectionState);
 document.addEventListener('DOMContentLoaded',()=>{syncRole();connectionState();},{once:true});syncRole();connectionState();
})();
