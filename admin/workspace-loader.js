'use strict';

// Keep native admin login, role routing and the full order editor in charge.
window.ADMIN_EXTRA_TITLES.work='Захиалгын ажлын хэсэг';
(function(){
  let loaded, mounted;
  const base='/admin/workspace/';
  const version='20261128-workspace-1';
  function mount(){
    const element=document.getElementById('admin-workspace');
    if(!element||element===mounted?.element)return;
    let style=document.getElementById('workspace-css');
    if(!style){
      style=document.createElement('link');style.id='workspace-css';style.rel='stylesheet';
      style.href=base+'workspace.css?v='+version;document.head.append(style);
    }
    loaded??=import(base+'workspace.js?v='+version);
    loaded.then(module=>{
      if(!element.isConnected)return;
      mounted?.dispose();
      mounted={element,dispose:module.mountWorkspace(element,{
        api,
        labels:statuses,
        openLegacy:async id=>{
          const {order}=await api('admin-order&id='+encodeURIComponent(id));
          const index=data.orders.findIndex(item=>item.id===id);
          if(index<0)data.orders.push(order);else data.orders[index]=order;
          editOrder(id);
        },
      })};
    }).catch(()=>{
      loaded=null;
      if(!element.isConnected)return;
      const retry=document.createElement('button');retry.type='button';retry.className='quiet';retry.textContent='Ажлын хэсгийг дахин ачаалах';
      retry.addEventListener('click',mount,{once:true});element.replaceChildren(retry);
    });
  }
  window.AdminExtra.pages.work={
    html:()=>'<div id="admin-workspace" class="admin-workspace"><p role="status">Захиалгын ажлын хэсэг ачаалж байна…</p></div>',
    load:mount,
  };
  const observer=new MutationObserver(()=>{
    if(mounted&&(!mounted.element.isConnected||document.getElementById('app').hidden)){mounted.dispose();mounted=null;}
  });
  const content=document.getElementById('content');
  if(content)observer.observe(content,{childList:true});
  const app=document.getElementById('app');
  if(app)observer.observe(app,{attributes:true,attributeFilter:['hidden']});
})();
