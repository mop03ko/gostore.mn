'use strict';
function customerSecurityHtml(c){
  if(c.login==='deleted'||data.admin?.role!=='owner'||!c.credential_version)return '';
  const types=[...(c.email?[['password','Имэйлийн нууц үг',c.email]]:[]),...(c.login_phone?[['pin','Утасны PIN',c.login_phone]]:[])];
  return `<details class="customer-section customer-security"><summary>Нууц үг / PIN сэргээх</summary><p class="muted">Шинэ нууц үг тохируулахад хэрэглэгч бүх төхөөрөмжөөс гарна. Хуучин нууц үгийг харах боломжгүй.</p>${types.map(([kind,label,login])=>`<form data-customer-reset data-kind="${kind}"><input type="hidden" name="id" value="${esc(c.id)}"><input type="hidden" name="operation" value="reset-credential"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="expected_version" value="${c.credential_version}"><input type="hidden" name="expected_login" value="${esc(login)}"><h3>${label}</h3><p>${esc(login)}</p><div class="form-grid"><label>Шинэ ${kind==='pin'?'4 оронтой PIN':'нууц үг'}<input name="new_password" type="password" autocomplete="new-password" ${kind==='pin'?'inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4"':'minlength="10" maxlength="72"'} required></label><label>Давтан оруулах<input name="password_confirm" type="password" autocomplete="new-password" ${kind==='pin'?'inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4"':'minlength="10" maxlength="72"'} required></label></div><p class="muted">${kind==='pin'?'4 оронтой тоо оруулна.':'10-аас доошгүй тэмдэгт, 72 байтаас ихгүй байна.'} Шинэ мэдээллийг хэрэглэгчид дамжуулна уу.</p><p class="error" role="alert"></p><button type="submit" class="primary">${kind==='pin'?'PIN шинэчлэх':'Нууц үг шинэчлэх'}</button></form>`).join('')}</details>`;
}
// Capture only this form; the shared profile handler retains its normal behavior.
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.matches('[data-customer-reset]'))return;
  event.preventDefault();event.stopImmediatePropagation();
  const button=form.querySelector('button'),error=form.querySelector('.error');if(button.disabled)return;
  const body=Object.fromEntries(new FormData(form));body.expected_version=Number(body.expected_version);
  if(body.new_password!==body.password_confirm){error.textContent='Нууц үг / PIN давталт таарахгүй байна.';return;}
  button.disabled=true;error.textContent='';const view=adminTrackingView;
  try{
    const result=await api('admin-customer-save',body);form.reset();
    if(view===adminTrackingView&&$('#editor').open)customerEditor(result);
    toast('Нэвтрэх мэдээлэл шинэчлэгдлээ. Хэрэглэгч дахин нэвтэрнэ.');
  }catch(e){error.textContent=e.message;}
  finally{button.disabled=false;body.new_password='';body.password_confirm='';}
},true);
