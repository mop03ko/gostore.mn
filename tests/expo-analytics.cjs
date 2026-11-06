const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('../gostoremn/node_modules/typescript');
function load(file,modules,dev=false){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!modules[n])throw Error(n);return modules[n]},__DEV__:dev});return exports;}
(async()=>{
 const routes=load('gostoremn/src/lib/analytics-screens.ts',{});
 assert.equal(routes.analyticsScreen(['(tabs)','account']),'account');
 assert.equal(routes.analyticsScreen(['order','[id]']),'order');
 assert.equal(routes.analyticsScreen(['order','GS-private']),null);
 assert.equal(routes.analyticsScreen(['search?phone=123']),null);
 const calls=[],storage=new Map();const sdk={getAnalytics:()=>({}),setConsent:async(_,v)=>calls.push(['consent',v]),setAnalyticsCollectionEnabled:async(_,v)=>calls.push(['enabled',v]),resetAnalyticsData:async()=>calls.push(['reset']),logScreenView:async(_,v)=>calls.push(['screen',v])};
 const modules={'expo-constants':{default:{executionEnvironment:'standalone'},ExecutionEnvironment:{StoreClient:'storeClient'}},'expo-secure-store':{getItemAsync:async k=>storage.get(k),setItemAsync:async(k,v)=>storage.set(k,v)},'@react-native-firebase/analytics':sdk};
 const app=load('gostoremn/src/lib/analytics.ios.ts',modules);
 await Promise.all([app.trackScreen('home'),app.trackScreen('home')]);assert.equal(calls.filter(c=>c[0]==='screen').length,1);
 assert.equal(calls.find(c=>c[0]==='consent')[1].ad_storage,false);
 await app.setAnalyticsEnabled(false);await app.trackScreen('cart');assert.equal(calls.filter(c=>c[0]==='screen').length,1);assert.ok(calls.some(c=>c[0]==='reset'));
 const reopened=load('gostoremn/src/lib/analytics.ios.ts',modules);await reopened.trackScreen('home');assert.equal(await reopened.analyticsEnabled(),false);
 const dev=load('gostoremn/src/lib/analytics.ios.ts',{'expo-constants':modules['expo-constants'],'expo-secure-store':modules['expo-secure-store']},true);await dev.trackScreen('home');assert.equal(await dev.analyticsEnabled(),false);
 console.log('PASS Analytics: route allowlist, no query/IDs, screen deduplication, opt-out persistence/reset, development guard.');
})().catch(e=>{console.error(e);process.exit(1)});
