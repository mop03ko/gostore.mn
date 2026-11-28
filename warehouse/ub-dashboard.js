'use strict';
// Presentation only: retain the existing receipt, sorting and handover handlers.
function ubOrderWorkflow(order){
  if(cityRole()!=='ulaanbaatar'||order.status==='cancelled')return '';
  const stages={ulaanbaatar_unsorted:1,ulaanbaatar:1,ready_pickup:2,ready_delivery:2,out_for_delivery:3,completed:4};
  const active=stages[order.status]??0;
  const delivery=(order.fulfillment?.method||order.requested_method)==='delivery'||['ready_delivery','out_for_delivery'].includes(order.status);
  const steps=[
    ['Хүлээн авах','Багцын код'],
    ['Ангилах','Зураг, тавиур'],
    [delivery?'Хүргэлтэд гаргах':'Агуулахаас олгох',delivery?'Хүргэгчид өгөх':'Авах код'],
    ['Дуусгах','Хүлээлгэн өгсөн']
  ];
  const messages=[
    order.batch_id&&!order.read_only?'Багцыг нээж, энэ захиалгын кодыг тулгана.':'Агуулахад ирэхэд багц болон захиалгын кодыг тулгана.',
    'Зургийг бүртгэж, тавиур болон хүлээлгэн өгөх хэлбэрийг сонгоно.',
    delivery?'Төлбөр баталгаажсан захиалгыг хүргэгчид шилжүүлнэ.':'Хэрэглэгчийн авах кодыг шалгаж, барааг хүлээлгэн өгнө.',
    'Хэрэглэгч бараагаа авсны дараа хүлээлгэн өгснийг батална.',
    'Захиалгыг хэрэглэгчид хүлээлгэн өгсөн.'
  ];
  const actions=['Хүлээн авах бүртгэл','Ангилах маягт руу',delivery?'Хүргэлтийн бүртгэл рүү':'Олгох бүртгэл рүү','Баталгаажуулах маягт руу'];
  const due=Number(order.billing?.due||order.flags?.unpaid||0);
  const controls=!order.read_only&&active<4&&(active>0||order.next_status);
  const action=!order.read_only&&active===0&&order.batch_id
    ?`<button type="button" class="ub-workflow-action" data-batch="${esc(order.batch_id)}">Багц нээх <span aria-hidden="true">→</span></button>`
    :controls?`<a class="ub-workflow-action" href="#ub-workflow-action" data-ub-workflow-jump>${actions[active]} <span aria-hidden="true">↓</span></a>`:'';
  return `<section class="ub-workflow" aria-labelledby="ub-workflow-title">
    <div class="ub-workflow-heading"><h3 id="ub-workflow-title">Захиалгын ажиллагаа</h3><span>${active===4?'Дууссан':`Алхам ${active+1} / ${steps.length}`}</span></div>
    <ol class="ub-workflow-steps">${steps.map(([name,hint],i)=>{
      const state=i<active?'done':i===active?'current':'pending';
      return `<li class="ub-workflow-step" data-state="${state}" ${state==='current'?'aria-current="step"':''}><span class="ub-workflow-marker" aria-hidden="true">${state==='done'?'✓':i+1}</span><strong>${name}</strong><small>${hint}</small><span class="ub-workflow-sr">${state==='done'?'Гүйцэтгэсэн':state==='pending'?'Хүлээгдэж буй':''}</span></li>`;
    }).join('')}</ol>
    <div class="ub-workflow-next" data-complete="${active===4}"><div><strong>${esc(statusText(order.status,order))}</strong><p>${messages[active]}</p>${active>=2&&active<4&&due>0?`<small class="ub-workflow-due">Төлбөрийн үлдэгдэл ${ubMoney(due)}</small>`:''}</div>${action}</div>
  </section>`;
}

document.addEventListener('click',event=>{
  if(!event.target.closest('[data-ub-workflow-jump]'))return;
  const target=document.getElementById('ub-workflow-action');
  if(!target)return;
  event.preventDefault();
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'start'});
});

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
