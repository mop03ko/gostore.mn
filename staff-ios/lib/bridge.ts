// UI state, native push registration results and explicit print actions cross this bridge.
// Session cookies, passwords and API credentials remain inside WKWebView.
export const bridge = `(()=>{
 if(window.__gostoreStaffBridge)return;window.__gostoreStaffBridge=true;
 const send=value=>window.ReactNativeWebView?.postMessage(JSON.stringify(value));
 window.gostoreStaffPush=async(request)=>{
  if(!request||!['admin','warehouse'].includes(request.variant)||!['register','unregister','test'].includes(request.action))return;
  const expected=request.variant==='admin'?'/admin/':'/warehouse/ulaanbaatar/';
  if(location.origin!=='https://gostore.mn'||!location.pathname.startsWith(expected))return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const url='/api/staff-push.php?variant='+request.variant;
   const session=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const auth=await session.json();if(!session.ok||!auth.csrf)throw Error(auth.error||'Нэвтэрнэ үү.');
   const response=await fetch(url+'&action='+request.action,{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrf},body:JSON.stringify({token:request.token})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Мэдэгдлийн холболт амжилтгүй.');
   send({type:'push-result',id:request.id,ok:true});
  }catch(e){send({type:'push-result',id:request.id,ok:false,error:String(e.message||'Холболт амжилтгүй').slice(0,180)});}
  finally{clearTimeout(timer);}
 };
 let last='',tap=0;document.addEventListener('click',e=>{if(e.isTrusted)tap=Date.now();},true);
 const state=()=>{const app=document.getElementById('app'),auth=!!app&&!app.hidden;
 const next=JSON.stringify({type:'state',authenticated:auth});if(next!==last){last=next;window.ReactNativeWebView?.postMessage(next);}};
 const app=document.getElementById('app');if(app)new MutationObserver(state).observe(app,{attributes:true,attributeFilter:['hidden']});state();
 window.print=()=>{if(Date.now()-tap>5000)return;const area=document.getElementById('print-area');if(!area||!area.innerHTML.trim())return;
 const styles=Array.from(document.querySelectorAll('link[rel=stylesheet],style')).map(s=>s.outerHTML).join('');
 send({type:'print',html:'<!doctype html><html><head><base href="https://gostore.mn/warehouse/">'+styles+'</head><body>'+area.outerHTML+'</body></html>'});};
 if(document.querySelector('#qr-scanner'))window.gostoreWarehouseNativeScanner='ios';
 document.documentElement.style.webkitTextSizeAdjust='100%';
})();true;`;
