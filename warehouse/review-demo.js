'use strict';
// Explicit, public training mode. Data and photos exist only in this page's memory.
(()=>{
  const now=()=>new Date().toISOString(),copy=v=>JSON.parse(JSON.stringify(v));
  const directory=[{location:'erenhot',role:'erenhot',name:'Эрээн агуулах'},{location:'ulaanbaatar',role:'ulaanbaatar',name:'Улаанбаатар агуулах'}];
  const names={erenhot:'Эрээн агуулах',ulaanbaatar:'Улаанбаатар агуулах'};
  const stages=['confirmed','erenhot','erenhot_dispatched','ulaanbaatar_unsorted','ready_pickup','ready_delivery'];
  const orders=stages.map((status,i)=>({id:`GS-DEMO0${i+1}`,title:['Дэвтэр / Notebook','Ширээний гэрэл / Desk lamp','Цүнх / Bag','Аяга / Cup','Тавиур / Shelf','Гутал / Shoes'][i],customer:`Демо хэрэглэгч ${i+1}`,status,created:now(),items:[{name:`Жишээ бараа ${i+1}`,variant:'Demo',qty:1}],warehouse_names:names,history:[{status:'confirmed',at:now()},{status,at:now()}],read_only:i<2,next_status:null,logistics:{version:1,photos:[],issues:[],shelf:i>3?'A-01':''},...(i>=3?{contact:{phone:'00000000',address:'Демо хаяг / Sample address'},requested_method:i===5?'delivery':'pickup'}:{}),...(i>3?{fulfillment:{method:i===5?'delivery':'pickup'}}:{})}));
  orders[2].batch_id='GB-DEMO01';
  const batch={id:'GB-DEMO01',status:'dispatched',version:1,created:now(),source:'erenhot',destination:'ulaanbaatar',source_name:names.erenhot,destination_name:names.ulaanbaatar,note:'Демо тээврийн багц / Sample transport batch',order_count:1,piece_count:1,scanned:[],history:[{event:'dispatched',at:now()}]};
  const photos=new Map();let authenticated=true;
  const fail=message=>{throw Error(message);};
  const get=id=>orders.find(o=>o.id===id)||fail('Зөвхөн GS-DEMO01…06 жишээ код ашиглана уу.');
  const batchView=()=>({...batch,orders:orders.filter(o=>o.batch_id===batch.id),unsorted_count:orders.filter(o=>o.batch_id===batch.id&&o.status==='ulaanbaatar_unsorted').length});
  const transition=(o,status)=>{o.status=status;o.history.push({status,at:now()});o.logistics.version++;};
  const requirePhoto=o=>{if(!o.logistics.photos.some(p=>p.location==='ulaanbaatar'))fail('Эхлээд демо зураг бүртгэнэ үү. / Add a demo receipt photo first.');};
  function list(params){
    const q=(params.get('q')||'').toLowerCase(),status=params.get('status')||'all',start=Number(params.get('offset')||0);
    const filtered=orders.filter(o=>(!q||(o.id+' '+o.title+' '+o.customer).toLowerCase().includes(q))&&(status==='all'||(status==='waiting'?['erenhot_dispatched','zamyn_uud'].includes(o.status):status==='pending_sort'?['ulaanbaatar_unsorted','ulaanbaatar'].includes(o.status):o.status===status)));
    const count=(...s)=>orders.filter(o=>s.includes(o.status)).length;
    const totals=s=>({orders:count(...s),quantity:count(...s)});
    return {orders:filtered.slice(start,start+50),total:filtered.length,more:filtered.length>start+50,location:'ulaanbaatar',email:'Demo · Local sample data',counts:{unpaid:0,stale:0,waiting:count('erenhot_dispatched','zamyn_uud'),received:count('ulaanbaatar'),unsorted:count('ulaanbaatar_unsorted'),ready:count('erenhot_ready'),dispatched:count('erenhot_dispatched'),completed:count('completed')},overview:{ordered:{orders:orders.length,quantity:orders.length},erenhot:totals(['erenhot','erenhot_ready']),ulaanbaatar:totals(['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'])}};
  }
  function handle(action,params,b){
    if(action==='warehouse-session')return {authenticated,location:'ulaanbaatar',warehouses:directory,csrf:'demo-only'};
    if(action==='warehouse-logout'){authenticated=false;location.replace('/warehouse/ulaanbaatar/');return {ok:true};}
    if(action==='warehouse-orders')return list(params);
    if(action==='warehouse-batches'){const status=params.get('status')||'all',rows=status==='all'||status===batch.status?[batchView()]:[];return {batches:rows,total:rows.length,more:false,location:'ulaanbaatar'};}
    if(action==='warehouse-batch'){if(params.get('id')!==batch.id)fail('Жишээ багц: GB-DEMO01');return {batch:batchView()};}
    if(action==='warehouse-order')return {order:get(params.get('id'))};
    if(action==='warehouse-exceptions')return {issues:[]};
    if(action==='warehouse-batch-scan'){
      if(b.id!==batch.id||b.order_id!==orders[2].id)fail('Энэ багцад GS-DEMO03 байна.');
      if(!batch.scanned.includes(b.order_id))batch.scanned.push(b.order_id);batch.version++;return {batch:batchView()};
    }
    if(action==='warehouse-batch-receive'){
      if(b.id!==batch.id||batch.status!=='dispatched')fail('Багцын төлөвийг шалгана уу.');
      if(!batch.scanned.includes(orders[2].id))fail('GS-DEMO03 кодыг эхлээд тулгана уу.');
      batch.status='received';batch.version++;batch.history.push({event:'received',at:now()});transition(orders[2],'ulaanbaatar_unsorted');orders[2].contact={phone:'00000000',address:'Демо хаяг'};return {batch:batchView()};
    }
    // Ulaanbaatar counter handover and courier runs (one-step flow); the demo pickup code is 12345678.
    const card=o=>({id:o.id,customer:o.customer,phone:o.contact?.phone||'',status:o.status,shelf:o.logistics.shelf||'',pieces:1,address:o.contact?.address||'',due:0,refund_due:0,reason:o.status==='ready_pickup'?'':o.status==='ready_delivery'?'delivery':o.status==='out_for_delivery'?'out_for_delivery':'not_sorted'});
    if(action==='warehouse-handover-lookup'){
      const q=(params.get('q')||'').trim().toUpperCase(),digits=q.replace(/\D/g,'');
      const found=orders.filter(o=>['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery'].includes(o.status)&&(o.id===q||digits==='12345678'||(digits.length>=6&&(o.contact?.phone||'').replace(/\D/g,'').endsWith(digits))));
      if(!found.length)fail('Энэ агуулахад тохирох захиалга олдсонгүй.');return {orders:found.map(o=>({...card(o),verified:digits==='12345678'&&o.status==='ready_pickup'}))};
    }
    if(action==='warehouse-handover'){
      for(const i of b.items||[]){if(get(i.id).status!=='ready_pickup')fail('Захиалгыг хүлээлгэн өгөх боломжгүй.');if(i.code!=='12345678')fail('Демо авах код: 12345678');}
      return {orders:(b.items||[]).map(i=>{const o=get(i.id);o.fulfillment={...o.fulfillment,received_by:b.received_by};transition(o,'completed');return o;})};
    }
    if(action==='warehouse-delivery-list')return {orders:orders.filter(o=>o.status==='ready_delivery').map(o=>({...card(o),ready:true,reason:''})),couriers:[{name:'Демо хүргэгч',phone:'00000000'}]};
    if(action==='warehouse-delivery-dispatch')return {orders:(b.ids||[]).map(id=>{const o=get(id);if(o.status!=='ready_delivery')fail('Захиалга хүргэлтэд бэлэн биш байна.');o.fulfillment={...o.fulfillment,courier_name:b.courier_name,courier_phone:b.courier_phone};transition(o,'out_for_delivery');return o;})};
    const o=get(b.id);
    if(o.read_only||['completed','cancelled'].includes(o.status))fail('Энэ жишээ захиалга зөвхөн харах төлөвтэй.');
    if(action==='warehouse-photo-upload'){
      const file=b.image;if(!(file instanceof Blob)||!file.type.startsWith('image/'))fail('Зураг сонгоно уу.');
      if(o.logistics.photos.length>=12)fail('Демо зураг 12 хүртэл байна.');
      const id=crypto.randomUUID();photos.set(id,URL.createObjectURL(file));o.logistics.photos.push({id,location:'ulaanbaatar',warehouse_name:names.ulaanbaatar,at:now()});
    }else if(action==='warehouse-shelf'){o.logistics.shelf=String(b.shelf).slice(0,50);
    }else if(action==='warehouse-measure'){
      const m=Object.fromEntries(['weight_kg','length_cm','width_cm','height_cm','pieces'].map(k=>[k,Number(b[k])]));if(Object.values(m).some(v=>!Number.isFinite(v)||v<=0))fail('Эерэг хэмжээс оруулна уу.');m.volume_m3=m.length_cm*m.width_cm*m.height_cm/1e6;o.logistics.measurement=m;
    }else if(action==='warehouse-issue'){o.logistics.issues.push({id:crypto.randomUUID(),kind:b.kind,note:String(b.note).slice(0,1000),state:'open'});
    }else if(action==='warehouse-issue-resolve'){const issue=o.logistics.issues.find(i=>i.id===b.issue_id);if(!issue)fail('Зөрчил олдсонгүй.');issue.state='resolved';issue.resolution=String(b.resolution).slice(0,1000);
    }else if(action==='warehouse-sort'){
      if(b.expected_status!==o.status)fail('Төлөв өөрчлөгдсөн. Дахин нээнэ үү.');
      if(!['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'].includes(o.status)||b.checked!==true||!['pickup','delivery'].includes(b.method)||!String(b.shelf||'').trim())fail('Ангилах мэдээллийг шалгана уу.');
      requirePhoto(o);o.logistics.shelf=String(b.shelf).slice(0,50);o.fulfillment={method:b.method,contact_phone:b.contact_phone,address:b.address,sorted_at:now()};o.contact={phone:b.contact_phone,address:b.address};
      const next=b.method==='delivery'?'ready_delivery':'ready_pickup';if(o.status!==next)transition(o,next);
      if(o.batch_id&&batchView().unsorted_count===0)batch.status='sorted';
    }else if(action==='warehouse-fulfillment-update'){
      if(b.expected_status!==o.status)fail('Төлөв өөрчлөгдсөн. Дахин нээнэ үү.');
      if(b.operation==='sort'){
        if(!['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'].includes(o.status)||!b.checked||!['pickup','delivery'].includes(b.method))fail('Ангилах мэдээллийг шалгана уу.');requirePhoto(o);o.fulfillment={method:b.method};o.contact={phone:b.contact_phone,address:b.address};transition(o,b.method==='delivery'?'ready_delivery':'ready_pickup');
        if(o.batch_id&&batchView().unsorted_count===0)batch.status='sorted';
      }else if(b.operation==='dispatch_delivery'&&o.status==='ready_delivery'){o.fulfillment={...o.fulfillment,courier_name:b.courier_name,courier_phone:b.courier_phone};transition(o,'out_for_delivery');
      }else if(b.operation==='complete'&&['ready_pickup','out_for_delivery'].includes(o.status)){
        if(b.pickup_code!=='12345678')fail('Демо авах код: 12345678');o.fulfillment={...o.fulfillment,received_by:b.received_by};transition(o,'completed');
      }else fail('Энэ төлөвт уг үйлдэл боломжгүй.');
    }else fail('Энэ үйлдэл демо горимд идэвхгүй. / Unavailable in demo mode.');
    o.logistics.version++;return {order:o};
  }
  // Never delegate to the original fetch. CSP independently blocks network requests.
  window.fetch=async(input,options={})=>{
    try{
      const url=new URL(typeof input==='string'?input:input.url,document.baseURI);
      if(url.origin!==location.origin||url.pathname!=='/api/index.php')throw Error('Demo network access is disabled.');
      const b=options.body instanceof FormData?Object.fromEntries(options.body):options.body?JSON.parse(options.body):{};
      return new Response(JSON.stringify(copy(handle(url.searchParams.get('action'),url.searchParams,b))),{headers:{'Content-Type':'application/json'}});
    }catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{'Content-Type':'application/json'}});}
  };
  window.GOStoreWarehouseDemo={photoUrl:id=>photos.get(id)||''};
  document.addEventListener('DOMContentLoaded',()=>{
    const banner=document.createElement('section');banner.className='receipt-info';banner.id='demo-banner';banner.setAttribute('role','status');
    banner.innerHTML='<strong>ДЕМО / DEMO — зөвхөн жишээ өгөгдөл</strong><p>All changes and photos stay on this device until reload. No real orders or payments.</p><p>Багц / Batch: <b>GB-DEMO01</b> · Доторх захиалга / Order: <b>GS-DEMO03</b> · Авах код / Pickup code: <b>12345678</b></p><p>Scan → receive → sort (photo, shelf) → hand over. Reload to reset.</p><a href="/warehouse/ulaanbaatar/">Демо горимоос гарах / Exit demo</a>';
    document.body.prepend(banner);
  });
})();
