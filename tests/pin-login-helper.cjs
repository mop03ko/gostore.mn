// Web sign-in for browser tests: a phone + PIN customer (99112233 / 0123) seeded by phone-auth-fixtures.php
// into the isolated test data directory, signed in through the storefront's PIN form.
const {spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const phone='99112233',pin='0123';
function seedPinCustomer(){
  const r=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','tests/phone-auth-fixtures.php'],{encoding:'utf8',windowsHide:true,env:process.env});
  assert.equal(r.status,0,r.stdout+r.stderr);
}
async function pinLogin(page){
  const form=page.locator('#customer-pin-login-form');await form.waitFor();
  await form.locator('[name=phone]').fill(phone);await form.locator('[name=pin]').fill(pin);await form.locator('[type=submit]').click();
}
module.exports={seedPinCustomer,pinLogin,phone,pin};
