'use strict';
// One-time Google Drive authorisation for the daily database backup (see docs/backup.md).
// Usage: node scripts/drive-backup-authorize.cjs <client_id> <client_secret> [output.json]
// Opens Google's consent page (scope drive.file: only files this app creates), receives the code on a
// local loopback port with PKCE, creates a "gostore.mn backups" folder and writes the server
// configuration file. Tokens and the client secret are written only to that file, never printed.
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const [clientId,clientSecret,out=path.join(__dirname,'..','tmp','backup-drive.json')]=process.argv.slice(2);
if(!/\.apps\.googleusercontent\.com$/.test(clientId||'')||!clientSecret){console.error('Usage: node scripts/drive-backup-authorize.cjs <client_id>.apps.googleusercontent.com <client_secret> [output.json]');process.exit(2);}
const b64=b=>b.toString('base64url'),verifier=b64(crypto.randomBytes(48)),state=b64(crypto.randomBytes(24));
const challenge=b64(crypto.createHash('sha256').update(verifier).digest());
async function json(url,options){const r=await fetch(url,options),body=await r.json().catch(()=>({}));if(!r.ok)throw Error(url.split('?')[0]+' '+r.status+' '+(body.error_description||body.error?.message||body.error||''));return body;}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');if(url.pathname!=='/'){res.writeHead(404).end();return;}
  const done=(code,text)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'}).end(text);server.close();};
  try{
    if(url.searchParams.get('state')!==state)throw Error('State mismatch');if(url.searchParams.get('error'))throw Error('Consent refused: '+url.searchParams.get('error'));
    const redirect='http://127.0.0.1:'+server.address().port;
    const token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:url.searchParams.get('code')||'',client_id:clientId,client_secret:clientSecret,redirect_uri:redirect,code_verifier:verifier})});
    if(!token.refresh_token)throw Error('Google returned no refresh token; remove the app under myaccount.google.com/permissions and run again');
    const folder=await json('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({name:'gostore.mn backups',mimeType:'application/vnd.google-apps.folder'})});
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({client_id:clientId,client_secret:clientSecret,refresh_token:token.refresh_token,folder_id:folder.id},null,1),{mode:0o600});
    console.log('Authorised. Drive folder "'+folder.name+'" ('+folder.id+') created. Server configuration written to '+out+' (keep it private; it is not a Git file).');
    done(200,'gostore.mn backup authorised. You can close this tab.');
  }catch(e){console.error('Authorisation failed: '+e.message);done(400,'Authorisation failed. See the terminal.');process.exitCode=1;}
});
server.listen(0,'127.0.0.1',()=>{
  const auth='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:clientId,redirect_uri:'http://127.0.0.1:'+server.address().port,response_type:'code',scope:'https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'});
  console.log('Opening Google consent in the browser. If it does not open, visit:\n'+auth);
  if(process.platform==='win32')execFile('rundll32',['url.dll,FileProtocolHandler',auth]);else execFile(process.platform==='darwin'?'open':'xdg-open',[auth]);
});
setTimeout(()=>{console.error('Timed out waiting for consent.');server.close();process.exitCode=1;},10*60*1000).unref();
