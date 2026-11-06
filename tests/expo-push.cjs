const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('../gostoremn/node_modules/typescript');
const source=ts.transpileModule(fs.readFileSync('gostoremn/src/lib/push.native.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 const storage=new Map(),calls=[];let allowed=true,permission='granted',prompt=0,responseListener,lastResponse=null;
 const notifications={AndroidImportance:{DEFAULT:3},setNotificationHandler(){},setNotificationChannelAsync:async()=>{},getPermissionsAsync:async()=>({status:permission}),requestPermissionsAsync:async()=>{prompt++;return {status:permission}},getExpoPushTokenAsync:async()=>({data:'ExponentPushToken[abcdefghijklmnop]'}),addNotificationResponseReceivedListener:f=>(responseListener=f,{remove(){}}),getLastNotificationResponseAsync:async()=>lastResponse,clearLastNotificationResponseAsync:async()=>{},addPushTokenListener:()=>({remove(){}})};
 const modules={'react-native':{Platform:{OS:'android'}},'expo-constants':{__esModule:true,default:{executionEnvironment:'standalone',easConfig:{projectId:'test'}},ExecutionEnvironment:{StoreClient:'storeClient'}},'expo-device':{isDevice:true},'expo-notifications':notifications,'expo-secure-store':{getItemAsync:async k=>storage.get(k),setItemAsync:async(k,v)=>storage.set(k,v),deleteItemAsync:async k=>storage.delete(k)},'./api':{api:async(a,b)=>{calls.push([a,b]);return {enabled:allowed}}}};
 const exports={};vm.runInNewContext(source,{exports,require:n=>modules[n]});
 await exports.enablePush(false);assert.equal(prompt,0);assert.ok(await exports.pushOptedIn());assert.equal(calls.at(-1)[0],'customer-push-register');
 await exports.disablePush();assert.equal(calls.at(-1)[0],'customer-push-unregister');assert.equal(await exports.pushOptedIn(),false);
 permission='denied';await assert.rejects(exports.enablePush(false));assert.equal(prompt,0,'Passive renewal never prompts');
 await assert.rejects(exports.enablePush(true));assert.equal(prompt,1,'Only explicit opt-in prompts');
 allowed=false;await assert.rejects(exports.enablePush(true));assert.equal(prompt,1,'Unconfigured service does not request permission');
 allowed=true;permission='granted';const before=calls.filter(x=>x[0]==='customer-push-register').length;await exports.enablePush(false,()=>false);assert.equal(calls.filter(x=>x[0]==='customer-push-register').length,before,'Cancelled owner never registers');
 let opened=0;const stop=exports.watchPush(()=>opened++);await Promise.resolve();const response=(screen,id)=>({notification:{request:{identifier:id,content:{data:{screen}}}}});responseListener(response('https://evil.example','a'));assert.equal(opened,0);responseListener(response('notifications','b'));responseListener(response('notifications','b'));assert.equal(opened,1);stop();responseListener(response('notifications','c'));assert.equal(opened,1);
 console.log('PASS native push: explicit permission only, disabled setup, token registration/removal, account cancellation and navigation allowlist.');
})().catch(e=>{console.error(e);process.exit(1)});
