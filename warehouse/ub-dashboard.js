'use strict';
// Presentation only: retain the existing receipt, sorting and handover handlers.
(()=>{
  const overview=document.getElementById('ub-overview'),app=document.getElementById('app');
  if(!overview||!app)return;
  const main=app.querySelector('main'),scan=main.querySelector('.scan-panel');
  const actions=document.createElement('section');
  actions.className='ub-workbench';actions.hidden=true;
  actions.setAttribute('aria-labelledby','ub-workbench-title');
  actions.innerHTML='<div class="ub-workbench-heading"><div><span class="eyebrow">ӨДӨР ТУТМЫН АЖИЛ</span><h2 id="ub-workbench-title">Ачаагаа дарааллаар нь боловсруулъя</h2></div><span class="ub-workbench-note">Хүлээн авах → Ангилах → Олгох</span></div><div class="ub-quick-actions"><button type="button" class="quiet" data-ub-shortcut="scan"><span class="ub-step" aria-hidden="true">01</span><span><strong>Хүлээн авах</strong><small>Багц / захиалгын код</small></span></button><button type="button" class="quiet" data-ub-shortcut="sort"><span class="ub-step" aria-hidden="true">02</span><span><strong>Ангилах</strong><small>Зураг, тавиур, тооцоо</small></span></button></div>';
  main.querySelector('.welcome').after(actions);
  const destinations=['handover-open','delivery-open'].map(id=>{
    const node=document.getElementById(id),anchor=document.createComment(id+' original position');
    node.before(anchor);return {node,anchor};
  });
  actions.addEventListener('click',event=>{
    const key=event.target.closest('[data-ub-shortcut]')?.dataset.ubShortcut;
    if(key==='scan'){scan.scrollIntoView({block:'center'});document.getElementById('scan-code').focus({preventScroll:true});}
    if(key==='sort')document.getElementById('received-stat').click();
  });
  let active;
  function sync(){
    const next=!overview.hidden&&!app.hidden;
    if(next===active)return;active=next;
    document.body.classList.toggle('ub-dashboard',active);actions.hidden=!active;
    for(const {node,anchor} of destinations){
      if(active)actions.querySelector('.ub-quick-actions').append(node);
      else anchor.after(node);
    }
    if(active)actions.after(scan);
    else overview.after(scan);
  }
  const observer=new MutationObserver(sync);
  observer.observe(overview,{attributes:true,attributeFilter:['hidden']});
  observer.observe(app,{attributes:true,attributeFilter:['hidden']});
  sync();
})();
