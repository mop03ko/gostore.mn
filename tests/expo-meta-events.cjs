const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('../gostoremn/node_modules/typescript');
function load(file,modules,dev=false){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!modules[n])throw Error(n);return modules[n]},__DEV__:dev});return exports;}
const settle=()=>new Promise(r=>setTimeout(r,20));
// Values created inside the vm realm are copied so they compare equal to literals here.
const plain=v=>JSON.parse(JSON.stringify(v));
function world(os,att='undetermined'){
 const calls=[],secure=new Map(),disk=new Map(),asked=[];
 const logger={AppEvents:{ViewedContent:'fb_mobile_content_view',AddedToCart:'fb_mobile_add_to_cart',InitiatedCheckout:'fb_mobile_initiated_checkout'},
  AppEventParams:{ContentType:'fb_content_type',Currency:'fb_currency',ContentID:'fb_content_id',Content:'fb_content',NumItems:'fb_num_items'},
  logEvent:(...a)=>calls.push(['event',...plain(a)]),logPurchase:(...a)=>calls.push(['purchase',...plain(a)])};
 const settings={setAutoLogAppEventsEnabled:v=>calls.push(['autolog',v]),setAdvertiserIDCollectionEnabled:v=>calls.push(['adid',v]),setAdvertiserTrackingEnabled:async v=>{calls.push(['ate',v]);return true;}};
 const permission=status=>({status,granted:status==='granted',canAskAgain:true});let status=att;
 const modules={'expo-constants':{__esModule:true,default:{executionEnvironment:'standalone'},ExecutionEnvironment:{StoreClient:'storeClient'}},
  'expo-secure-store':{getItemAsync:async k=>secure.get(k),setItemAsync:async(k,v)=>secure.set(k,v)},
  '@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{disk.set(k,v);}}},
  'react-native':{Platform:{OS:os},AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},
  'react-native-fbsdk-next':{Settings:settings,AppEventsLogger:logger},
  'expo-tracking-transparency':{PermissionStatus:{UNDETERMINED:'undetermined'},getTrackingPermissionsAsync:async()=>permission(status),requestTrackingPermissionsAsync:async()=>{asked.push(1);status='granted';return permission(status);}}};
 return {calls,secure,disk,asked,modules,open:(dev=false,mods=modules)=>load('gostoremn/src/lib/meta-events.native.ts',mods,dev)};
}
(async()=>{
 const w=world('ios'),app=w.open();
 app.metaViewedProduct('tb-123456',49500.4);app.metaAddedToCart('tb-123456',2,99000);app.metaInitiatedCheckout([{id:'tb-123456',sku:'s1',qty:2},{id:'tb-777777',sku:'s2',qty:1}],151000);await settle();
 assert.deepEqual(w.calls.filter(c=>c[0]==='autolog'||c[0]==='adid'),[['autolog',true],['adid',true]]);
 const events=w.calls.filter(c=>c[0]==='event');assert.equal(events.length,3);
 assert.deepEqual(events[0].slice(1),['fb_mobile_content_view',49500,{fb_content_type:'product',fb_currency:'MNT',fb_content_id:'tb-123456'}]);
 assert.deepEqual(events[1].slice(1),['fb_mobile_add_to_cart',99000,{fb_content_type:'product',fb_currency:'MNT',fb_content_id:'tb-123456',fb_content:'[{"id":"tb-123456","quantity":2}]'}]);
 assert.deepEqual(events[2].slice(1),['fb_mobile_initiated_checkout',151000,{fb_content_type:'product',fb_currency:'MNT',fb_content:'[{"id":"tb-123456","quantity":2},{"id":"tb-777777","quantity":1}]',fb_num_items:3}]);
 app.metaViewedProduct('tb-123456',null);await settle();assert.deepEqual(w.calls.filter(c=>c[0]==='event')[3].slice(1),['fb_mobile_content_view',{fb_content_type:'product',fb_currency:'MNT',fb_content_id:'tb-123456'}]);

 // Purchases: only orders created in this app, once, even when two checks race or the app restarts.
 const lines=[{id:'tb-123456',qty:2}];
 await app.metaPurchased('GS-WEB-1',99000,lines);assert.equal(w.calls.filter(c=>c[0]==='purchase').length,0);
 await app.metaOrderPlaced('GS-APP-1');await app.metaOrderPlaced('GS-APP-2');
 await Promise.all([app.metaPurchased('GS-APP-1',99000.2,lines),app.metaPurchased('GS-APP-1',99000.2,lines)]);
 let bought=w.calls.filter(c=>c[0]==='purchase');assert.equal(bought.length,1);
 assert.deepEqual(bought[0].slice(1),[99000,'MNT',{fb_content_type:'product',fb_content:'[{"id":"tb-123456","quantity":2}]',fb_num_items:2}]);
 const reopened=w.open();await reopened.metaPurchased('GS-APP-1',99000,lines);assert.equal(w.calls.filter(c=>c[0]==='purchase').length,1);
 await reopened.metaPurchased('GS-APP-2',50000,lines);assert.equal(w.calls.filter(c=>c[0]==='purchase').length,2);
 assert.ok(!JSON.stringify(w.calls).includes('GS-'),'order numbers never reach Meta');

 // iOS tracking permission: asked once, answer passed to the SDK; no prompt on Android.
 await app.requestMetaTracking();await app.requestMetaTracking();assert.equal(w.asked.length,1);assert.deepEqual(w.calls.filter(c=>c[0]==='ate').map(c=>c[1]),[true,true]);
 const android=world('android'),droid=android.open();await droid.requestMetaTracking();assert.equal(android.asked.length,0);assert.equal(android.calls.filter(c=>c[0]==='ate').length,0);

 // Opt-out: stops automatic and explicit events, clears the tracking flag and survives a restart.
 const before=w.calls.filter(c=>c[0]==='event'||c[0]==='purchase').length;
 await app.setMetaEnabled(false);assert.equal(await app.metaEnabled(),false);assert.equal(w.secure.get('gostore-analytics-enabled'),'0');
 assert.deepEqual(w.calls.slice(-3),[['autolog',false],['adid',false],['ate',false]]);
 app.metaViewedProduct('tb-123456',1000);await app.metaOrderPlaced('GS-APP-3');await app.metaPurchased('GS-APP-3',1000,lines);await settle();
 assert.equal(w.calls.filter(c=>c[0]==='event'||c[0]==='purchase').length,before);
 const off=w.open();assert.equal(await off.metaEnabled(),false);assert.deepEqual(w.calls.slice(-2),[['autolog',false],['adid',false]]);
 off.metaAddedToCart('tb-123456',1,1000);await off.requestMetaTracking();await settle();assert.equal(w.calls.filter(c=>c[0]==='event'||c[0]==='purchase').length,before);assert.equal(w.asked.length,1);
 await off.setMetaEnabled(true);assert.equal(await off.metaEnabled(),true);assert.equal(w.secure.get('gostore-analytics-enabled'),'1');

 // Development builds and Expo Go never load the native SDK; a broken SDK never breaks shopping.
 const d=world('ios'),{['react-native-fbsdk-next']:_sdk,['expo-tracking-transparency']:_att,...bare}=d.modules,dev=d.open(true,bare);
 dev.metaViewedProduct('tb-123456',1000);await dev.metaOrderPlaced('GS-APP-9');await dev.metaPurchased('GS-APP-9',1000,lines);await dev.requestMetaTracking();await settle();assert.equal(await dev.metaEnabled(),false);assert.equal(d.calls.length,0);
 const broken=world('android').open(false,bare);broken.metaViewedProduct('tb-123456',1000);await broken.metaOrderPlaced('GS-APP-9');await broken.metaPurchased('GS-APP-9',1000,lines);await settle();assert.equal(await broken.metaEnabled(),false);

 // Web keeps the same interface as no-ops.
 const web=load('gostoremn/src/lib/meta-events.ts',{});assert.deepEqual(Object.keys(web).sort(),Object.keys(app).sort());assert.equal(web.metaAvailable,false);

 // Build configuration: the SDK is configured for both stores and the tracking prompt has a reason.
 const config=JSON.parse(fs.readFileSync('gostoremn/app.json','utf8')).expo,plugin=n=>config.plugins.find(p=>Array.isArray(p)&&p[0]===n)?.[1];
 const meta=plugin('react-native-fbsdk-next');assert.match(meta.appID,/^\d{10,20}$/);assert.equal(meta.scheme,'fb'+meta.appID);assert.equal(meta.isAutoInitEnabled,true);assert.equal(meta.autoLogAppEventsEnabled,true);assert.equal(meta.advertiserIDCollectionEnabled,true);
 assert.ok(plugin('expo-tracking-transparency').userTrackingPermission.length>40);
 assert.match(meta.clientToken,/^[0-9a-f]{32}$/,'Set the Meta client token (App Dashboard → Settings → Advanced) in gostoremn/app.json before building.');
 console.log('PASS Meta App Events: shopping events without personal data, once-only purchases, iOS tracking prompt, opt-out persistence, development guard, web no-ops, build config.');
})().catch(e=>{console.error(e);process.exit(1)});
