'use strict';
// The head bootstrap applies the initial theme before paint; this handles controls
// and live changes without depending on catalog, authentication or payment calls.
(()=>{
  const key='gostore-theme',system=matchMedia('(prefers-color-scheme: dark)');
  let preference=null;
  try{const saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')preference=saved;}catch{}
  function render(){
    const theme=preference||(system.matches?'dark':'light'),dark=theme==='dark';
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111114':'#132344');
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
      button.setAttribute('aria-pressed',String(dark));
      button.title=dark?'Цайвар горимд шилжих':'Бараан горимд шилжих';
    });
  }
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.addEventListener('click',()=>{
    preference=document.documentElement.dataset.theme==='dark'?'light':'dark';
    try{localStorage.setItem(key,preference);}catch{}
    render();
  }));
  system.addEventListener('change',()=>{if(!preference)render();});
  addEventListener('storage',event=>{
    if(event.key!==key&&event.key!==null)return;
    preference=event.newValue==='light'||event.newValue==='dark'?event.newValue:null;
    render();
  });
  render();
})();
