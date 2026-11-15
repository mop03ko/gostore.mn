const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../lib/bridge.ts'),'utf8').match(/export const bridge = `([\s\S]*)`;/)[1];
function setup(path='/admin/',fail=false){
 const messages=[],calls=[],app={hidden:false};
 const context={window:{ReactNativeWebView:{postMessage:s=>messages.push(JSON.parse(s))}},location:{origin:'https://gostore.mn',pathname:path},document:{getElementById:id=>id==='app'?app:null,addEventListener(){},querySelector(){return null},documentElement:{style:{}}},MutationObserver:class{observe(){}},setTimeout,clearTimeout,AbortController,fetch:async(url,opts)=>{calls.push({url,opts});return {ok:!fail,json:async()=>fail?{error:'Unauthorized'}:opts.method?{ok:true}:{csrf:'private-csrf'}};}};
 vm.runInNewContext(source,context);return {...context,messages,calls};
}
test('push registration uses same-origin CSRF; credentials never cross native bridge',async()=>{
 const c=setup();await c.window.gostoreStaffPush({id:'1',variant:'admin',action:'register',token:'ExpoPushToken[test]'});
 assert.equal(c.calls.length,2);assert.equal(c.calls[1].opts.headers['X-CSRF-Token'],'private-csrf');assert.equal(c.calls[1].opts.credentials,'same-origin');assert.equal(c.messages.at(-1).ok,true);assert.ok(!JSON.stringify(c.messages).includes('private-csrf'));
});
test('wrong panel, arbitrary action and unauthorized server cannot register',async()=>{
 const c=setup('/warehouse/ulaanbaatar/');await c.window.gostoreStaffPush({id:'1',variant:'admin',action:'register'});assert.equal(c.calls.length,0);
 await c.window.gostoreStaffPush({id:'2',variant:'warehouse',action:'send-all'});assert.equal(c.calls.length,0);
 const failed=setup('/admin/',true);await failed.window.gostoreStaffPush({id:'3',variant:'admin',action:'test'});assert.equal(failed.calls.length,1);assert.equal(failed.messages.at(-1).ok,false);
});
