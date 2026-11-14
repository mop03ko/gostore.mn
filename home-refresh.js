'use strict';
// Keep visual overrides on the actual home route, including browser Back / in-place navigation.
(()=>{
 const root=document.documentElement;
 const sync=()=>{const home=/^\/(?:index\.html)?$/.test(location.pathname)&&!/[?&](?:q|category|image)=|[?&](?:filter=saved|sale=11\.11)(?:&|$)/.test(location.search)&&!root.matches('.listing-view,.product-view,.account-view,.store-page-view,.auth-view-open,.eleven-sale-view,.official-stores-view');if(root.classList.contains('home-refresh')!==home)root.classList.toggle('home-refresh',home);};
 sync();new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});addEventListener('popstate',sync);
 document.querySelector('.home-services')?.addEventListener('click',e=>{const button=e.target.closest('[data-home-discovery]');if(!button)return;const tab=document.querySelector('[role="tab"][data-discovery-tab="'+button.dataset.homeDiscovery+'"]');if(!tab)return;tab.click();tab.focus({preventScroll:true});document.querySelector('#discovery-home')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
})();
