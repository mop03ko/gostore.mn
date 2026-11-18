const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Both staff variants use persistent WKWebView cookies',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../App.tsx'),'utf8');
 assert.match(source,/sharedCookiesEnabled\s/);assert.match(source,/incognito=\{false\}/);
 assert.match(source,/\n\s+cacheEnabled\s*\n/);assert.doesNotMatch(source,/clearCookies|removeAllCookies/);
});
