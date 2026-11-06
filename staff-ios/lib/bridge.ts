// Only notifications about UI state and explicit print actions cross this bridge.
// Session cookies, passwords and API credentials remain inside WKWebView.
export const bridge = `(()=>{
 if(window.__gostoreStaffBridge)return;window.__gostoreStaffBridge=true;
 const send=value=>window.ReactNativeWebView?.postMessage(JSON.stringify(value));
 let last='',tap=0;document.addEventListener('click',e=>{if(e.isTrusted)tap=Date.now();},true);
 const state=()=>{const app=document.getElementById('app'),auth=!!app&&!app.hidden;
 const next=JSON.stringify({type:'state',authenticated:auth});if(next!==last){last=next;window.ReactNativeWebView?.postMessage(next);}};
 const app=document.getElementById('app');if(app)new MutationObserver(state).observe(app,{attributes:true,attributeFilter:['hidden']});state();
 window.print=()=>{if(Date.now()-tap>5000)return;const area=document.getElementById('print-area');if(!area||!area.innerHTML.trim())return;
 const styles=Array.from(document.querySelectorAll('link[rel=stylesheet],style')).map(s=>s.outerHTML).join('');
 send({type:'print',html:'<!doctype html><html><head><base href="https://gostore.mn/warehouse/">'+styles+'</head><body>'+area.outerHTML+'</body></html>'});};
 document.documentElement.style.webkitTextSizeAdjust='100%';
})();true;`;
