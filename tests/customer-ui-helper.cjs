// Create a real disposable customer session, only against an isolated local test server.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async(page,base)=>{
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const session=await(await page.request.get(base+'/api/index.php?action=customer-me')).json();
 const response=await page.request.post(base+'/api/index.php?action=customer-register',{headers:{'X-CSRF-Token':session.csrf},data:{name:'UI customer',email:'ui-'+crypto.randomBytes(8).toString('hex')+'@example.com',password:'Ui-test-password-2026',password_confirm:'Ui-test-password-2026',phone:'99112233'}});
 assert.equal(response.status(),201,await response.text());return (await response.json()).customer;
};
